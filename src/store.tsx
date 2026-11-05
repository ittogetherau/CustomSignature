import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { BrandKit, Campaign, Employee, Organization, Role, Signature } from './types'
import { DEFAULT_BRAND } from './lib/teamSignature'
export { DEFAULT_BRAND }
import { supabase } from './lib/supabase'
import { uid } from './lib/templates'
import { useToast } from './components/ui'

// ---------- row mapping ----------

type SignatureRow = { id: string; org_id: string; label: string; template_id: string; data: Pick<Signature, 'fields' | 'socials' | 'design' | 'extras'>; created_at: string; updated_at: string }
type EmployeeRow = { id: string; org_id: string; full_name: string; title: string; department: string; email: string; phone: string; photo: string; template_id: string | null; status: Employee['status']; source: Employee['source']; external_id: string | null; signature_sent_at?: string | null; updated_at: string }
type CampaignRow = { id: string; org_id: string; data: Omit<Campaign, 'id'> }

const fromSig = (r: SignatureRow): Signature => ({ id: r.id, label: r.label, templateId: r.template_id, ...r.data, createdAt: Date.parse(r.created_at), updatedAt: Date.parse(r.updated_at) })
const toSig = (s: Signature, orgId: string, ownerId?: string) => ({
  id: s.id, org_id: orgId, label: s.label, template_id: s.templateId,
  data: { fields: s.fields, socials: s.socials, design: s.design, extras: s.extras },
  ...(ownerId ? { owner_id: ownerId } : {}),
})
const fromEmp = (r: EmployeeRow): Employee => ({ id: r.id, fullName: r.full_name, title: r.title, department: r.department, email: r.email, phone: r.phone, photo: r.photo, templateId: r.template_id, status: r.status, source: r.source, externalId: r.external_id, sentAt: r.signature_sent_at ? Date.parse(r.signature_sent_at) : null, updatedAt: Date.parse(r.updated_at) })
const toEmp = (e: Employee, orgId: string) => ({ id: e.id, org_id: orgId, full_name: e.fullName, title: e.title, department: e.department, email: e.email.toLowerCase(), phone: e.phone, photo: e.photo, template_id: e.templateId, status: e.status, source: e.source, external_id: e.externalId })
const fromCamp = (r: CampaignRow): Campaign => ({ ...r.data, id: r.id })
const toCamp = (c: Campaign, orgId: string) => { const { id, ...data } = c; return { id, org_id: orgId, data } }


// ---------- store ----------

interface State {
  signatures: Signature[]
  employees: Employee[]
  campaigns: Campaign[]
  brand: BrandKit
}

interface Store extends State {
  org: Organization
  role: Role
  loading: boolean
  saveSignature: (s: Signature) => void
  deleteSignature: (id: string) => void
  duplicateSignature: (id: string) => Signature | undefined
  upsertEmployees: (list: Employee[]) => Promise<void>
  updateEmployee: (id: string, patch: Partial<Employee>) => void
  deleteEmployees: (ids: string[]) => void
  markSent: (ids: string[]) => void
  saveCampaign: (c: Campaign) => void
  deleteCampaign: (id: string) => void
  setBrand: (b: BrandKit) => void
  /** Re-read org metadata (e.g. after the server ran a Microsoft sync). */
  refreshOrg: () => Promise<void>
  reload: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ org: initialOrg, role, userId, children }: { org: Organization & { brand: BrandKit }; role: Role; userId: string; children: ReactNode }) {
  const toast = useToast()
  const [org, setOrg] = useState<Organization>({ id: initialOrg.id, name: initialOrg.name, msTenantId: initialOrg.msTenantId, msSyncedAt: initialOrg.msSyncedAt, msSyncStatus: initialOrg.msSyncStatus })
  const [state, setState] = useState<State>({ signatures: [], employees: [], campaigns: [], brand: { ...DEFAULT_BRAND, ...initialOrg.brand } })
  const [loading, setLoading] = useState(true)
  const stateRef = useRef(state)
  stateRef.current = state
  const orgId = org.id

  const reload = useCallback(async () => {
    const [s, e, c] = await Promise.all([
      supabase.from('signatures').select('*').eq('org_id', orgId).order('updated_at', { ascending: false }),
      supabase.from('employees').select('*').eq('org_id', orgId).order('full_name'),
      supabase.from('campaigns').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    ])
    const err = s.error || e.error || c.error
    if (err) toast(`Couldn't load workspace: ${err.message}`)
    setState((st) => ({
      ...st,
      signatures: (s.data as SignatureRow[] | null)?.map(fromSig) ?? st.signatures,
      employees: (e.data as EmployeeRow[] | null)?.map(fromEmp) ?? st.employees,
      campaigns: (c.data as CampaignRow[] | null)?.map(fromCamp) ?? st.campaigns,
    }))
    setLoading(false)
  }, [orgId, toast])

  useEffect(() => { reload() }, [reload])

  const store = useMemo<Store>(() => {
    const patch = (fn: (s: State) => Partial<State>) => setState((s) => ({ ...s, ...fn(s) }))
    // Optimistic writes: update the UI now, roll back by reloading if the database refuses.
    const write = async (label: string, op: PromiseLike<{ error: { message: string } | null }>) => {
      const { error } = await op
      if (error) {
        toast(`${label} failed: ${error.message}`)
        reload()
      }
    }

    return {
      ...state,
      org,
      role,
      loading,
      reload,
      saveSignature: (sig) => {
        const next = { ...sig, updatedAt: Date.now() }
        const exists = stateRef.current.signatures.some((x) => x.id === sig.id)
        patch((s) => ({ signatures: exists ? s.signatures.map((x) => (x.id === sig.id ? next : x)) : [next, ...s.signatures] }))
        write('Saving signature', supabase.from('signatures').upsert(toSig(next, orgId, exists ? undefined : userId)))
      },
      deleteSignature: (id) => {
        patch((s) => ({ signatures: s.signatures.filter((x) => x.id !== id) }))
        write('Deleting signature', supabase.from('signatures').delete().eq('id', id))
      },
      duplicateSignature: (id) => {
        const src = stateRef.current.signatures.find((x) => x.id === id)
        if (!src) return
        const copy: Signature = { ...structuredClone(src), id: uid(), label: `${src.label} (copy)`, createdAt: Date.now(), updatedAt: Date.now() }
        patch((s) => ({ signatures: [copy, ...s.signatures] }))
        write('Duplicating signature', supabase.from('signatures').insert(toSig(copy, orgId, userId)))
        return copy
      },
      upsertEmployees: async (list) => {
        // Match on email so re-imports update people instead of duplicating them.
        const byEmail = new Map(stateRef.current.employees.map((e) => [e.email.toLowerCase(), e]))
        const merged = list.map((e) => {
          const prev = byEmail.get(e.email.toLowerCase())
          return prev ? { ...prev, ...e, id: prev.id, photo: e.photo || prev.photo, templateId: e.templateId ?? prev.templateId } : e
        })
        const { error } = await supabase.from('employees').upsert(merged.map((e) => toEmp(e, orgId)), { onConflict: 'org_id,email' })
        if (error) { toast(`Import failed: ${error.message}`); return }
        await reload()
      },
      updateEmployee: (id, p) => {
        const cur = stateRef.current.employees.find((e) => e.id === id)
        if (!cur) return
        const next = { ...cur, ...p, updatedAt: Date.now() }
        patch((s) => ({ employees: s.employees.map((e) => (e.id === id ? next : e)) }))
        write('Updating person', supabase.from('employees').update(toEmp(next, orgId)).eq('id', id))
      },
      deleteEmployees: (ids) => {
        patch((s) => ({ employees: s.employees.filter((e) => !ids.includes(e.id)) }))
        write('Removing people', supabase.from('employees').delete().in('id', ids))
      },
      markSent: (ids) => {
        const now = Date.now()
        patch((s) => ({ employees: s.employees.map((e) => (ids.includes(e.id) ? { ...e, sentAt: now } : e)) }))
        write('Recording sent signatures', supabase.from('employees').update({ signature_sent_at: new Date(now).toISOString() }).in('id', ids))
      },
      saveCampaign: (c) => {
        patch((s) => ({ campaigns: s.campaigns.some((x) => x.id === c.id) ? s.campaigns.map((x) => (x.id === c.id ? c : x)) : [c, ...s.campaigns] }))
        write('Saving campaign', supabase.from('campaigns').upsert(toCamp(c, orgId)))
      },
      deleteCampaign: (id) => {
        const affected = stateRef.current.signatures.filter((x) => x.extras.campaignId === id).map((x) => ({ ...x, extras: { ...x.extras, campaignId: null } }))
        patch((s) => ({
          campaigns: s.campaigns.filter((x) => x.id !== id),
          signatures: s.signatures.map((x) => affected.find((a) => a.id === x.id) ?? x),
        }))
        write('Deleting campaign', supabase.from('campaigns').delete().eq('id', id))
        if (affected.length) write('Detaching banner', supabase.from('signatures').upsert(affected.map((a) => toSig(a, orgId))))
      },
      setBrand: (brand) => {
        patch(() => ({ brand }))
        const name = brand.company.trim() || org.name
        setOrg((o) => ({ ...o, name }))
        write('Saving brand kit', supabase.from('organizations').update({ brand, name }).eq('id', orgId))
      },
      refreshOrg: async () => {
        const { data } = await supabase.from('organizations').select('name, ms_tenant_id, ms_synced_at, ms_sync_status').eq('id', orgId).single()
        if (data) setOrg((o) => ({ ...o, name: data.name, msTenantId: data.ms_tenant_id, msSyncedAt: data.ms_synced_at ? Date.parse(data.ms_synced_at) : null, msSyncStatus: data.ms_sync_status }))
      },
    }
  }, [state, org, role, loading, orgId, userId, reload, toast])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
