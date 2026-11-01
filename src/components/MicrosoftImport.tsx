import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../auth'
import { useStore } from '../store'
import { MS_DIRECTORY_SCOPES, supabase, uploadAsset } from '../lib/supabase'
import { TEMPLATES, uid } from '../lib/templates'
import type { Employee } from '../types'
import { Field, Modal, Toggle, useToast } from './ui'
import { MicrosoftLogo } from '../pages/Auth'

interface MsUser {
  id: string
  displayName: string
  jobTitle: string | null
  department: string | null
  mail: string | null
  userPrincipalName: string
  businessPhones: string[]
  mobilePhone: string | null
  accountEnabled?: boolean
  userType?: string | null
}

const GRAPH = 'https://graph.microsoft.com/v1.0'
const RETURN_TO = '/team?import=microsoft'

class GraphError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function graph<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url.startsWith('http') ? url : `${GRAPH}${url}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new GraphError(res.status, body?.error?.message ?? res.statusText)
  }
  return res.json() as Promise<T>
}

async function fetchDirectory(token: string) {
  const select = 'id,displayName,jobTitle,department,mail,userPrincipalName,businessPhones,mobilePhone,accountEnabled,userType'
  let next: string | undefined = `/users?$select=${select}&$top=999`
  const out: MsUser[] = []
  while (next) {
    const page: { value: MsUser[]; '@odata.nextLink'?: string } = await graph(token, next)
    out.push(...page.value)
    next = page['@odata.nextLink']
  }
  // Real mailboxes only: skip disabled accounts, guests and external (#EXT#) identities.
  return out
    .filter((u) => u.accountEnabled !== false && u.userType !== 'Guest' && !u.userPrincipalName.includes('#EXT#') && (u.mail || u.userPrincipalName))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

async function fetchPhoto(token: string, id: string): Promise<Blob | null> {
  const res = await fetch(`${GRAPH}/users/${id}/photos/240x240/$value`, { headers: { Authorization: `Bearer ${token}` } })
  return res.ok ? res.blob() : null
}

/** Ask Microsoft for directory access. Email/password users link a Microsoft identity instead of switching accounts. */
export async function connectMicrosoftDirectory(hasAzureIdentity: boolean) {
  const options = { scopes: MS_DIRECTORY_SCOPES, redirectTo: `${location.origin}${RETURN_TO}` }
  const { error } = hasAzureIdentity
    ? await supabase.auth.signInWithOAuth({ provider: 'azure', options })
    : await supabase.auth.linkIdentity({ provider: 'azure', options })
  return error
}

type Phase = { k: 'checking' } | { k: 'connect'; reason?: string } | { k: 'pick' } | { k: 'importing'; done: number; total: number } | { k: 'error'; msg: string }

export default function MicrosoftImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, user } = useAuth()
  const store = useStore()
  const toast = useToast()
  const [phase, setPhase] = useState<Phase>({ k: 'checking' })
  const [people, setPeople] = useState<MsUser[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('All')
  const [tpl, setTpl] = useState(store.brand.defaultTemplateId)
  const [photos, setPhotos] = useState(true)

  const token = session?.provider_token ?? null
  const hasAzure = Boolean(user?.identities?.some((i) => i.provider === 'azure'))
  const existing = useMemo(() => new Set(store.employees.map((e) => e.email.toLowerCase())), [store.employees])

  useEffect(() => {
    if (!open) return
    // provider_token only exists right after a Microsoft sign-in, so without it we must reconnect.
    if (!token) { setPhase({ k: 'connect' }); return }
    let live = true
    setPhase({ k: 'checking' })
    ;(async () => {
      try {
        const [users, org] = await Promise.all([fetchDirectory(token), graph<{ value: { id: string }[] }>(token, '/organization?$select=id')])
        if (!live) return
        setPeople(users)
        // Pre-select people who aren't in the workspace yet; re-syncs keep existing people selected too.
        setSel(new Set(users.map((u) => u.id)))
        if (org.value[0]?.id && org.value[0].id !== store.org.msTenantId) store.setTenant(org.value[0].id)
        setPhase({ k: 'pick' })
      } catch (e) {
        if (!live) return
        const status = e instanceof GraphError ? e.status : 0
        if (status === 401 || status === 403) setPhase({ k: 'connect', reason: status === 403 ? 'Directory access hasn’t been approved for your organisation yet.' : 'Your Microsoft session expired.' })
        else setPhase({ k: 'error', msg: (e as Error).message })
      }
    })()
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token])

  const depts = useMemo(() => ['All', ...[...new Set(people.map((p) => p.department).filter(Boolean) as string[])].sort()], [people])
  const list = people.filter((p) => (dept === 'All' || p.department === dept) && `${p.displayName} ${p.mail ?? ''} ${p.jobTitle ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  const allOn = list.length > 0 && list.every((p) => sel.has(p.id))

  const run = async () => {
    if (!token) return
    const chosen = people.filter((p) => sel.has(p.id))
    setPhase({ k: 'importing', done: 0, total: chosen.length })
    const rows: Employee[] = []
    let done = 0
    // Photos are fetched four at a time so large tenants don't hit Graph throttling.
    const queue = [...chosen]
    const worker = async () => {
      while (queue.length) {
        const u = queue.shift()!
        let photo = ''
        if (photos) {
          try {
            const blob = await fetchPhoto(token, u.id)
            if (blob) photo = await uploadAsset(store.org.id, blob, `ms-${u.id.slice(0, 8)}`)
          } catch { /* a missing photo shouldn't block the import */ }
        }
        rows.push({
          id: uid(), fullName: u.displayName, title: u.jobTitle ?? '', department: u.department ?? '',
          email: (u.mail || u.userPrincipalName).toLowerCase(), phone: u.businessPhones?.[0] || u.mobilePhone || '',
          photo, templateId: tpl, status: 'active', source: 'microsoft', externalId: u.id, updatedAt: Date.now(),
        })
        setPhase({ k: 'importing', done: ++done, total: chosen.length })
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, chosen.length) }, worker))
    await store.upsertEmployees(rows)
    const added = rows.filter((r) => !existing.has(r.email)).length
    toast(`Synced ${rows.length} people from Microsoft 365${added ? ` · ${added} new` : ''}`)
    onClose()
  }

  return (
    <Modal open={open} onClose={phase.k === 'importing' ? () => {} : onClose} width={720}
      title="Import from Microsoft 365" subtitle="Pull names, titles, departments, phones and photos from Microsoft Entra ID."
      footer={phase.k === 'pick' ? (
        <>
          <button className="btn btn-line" onClick={onClose}>Cancel</button>
          <button className="btn btn-ink" disabled={!sel.size} onClick={run}><MicrosoftLogo size={14} /> Import {sel.size} {sel.size === 1 ? 'person' : 'people'}</button>
        </>
      ) : undefined}>
      {phase.k === 'checking' && <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> Reading your directory…</div>}

      {phase.k === 'connect' && (
        <div className="py-2">
          {phase.reason && <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-butter-soft px-3.5 py-3 text-sm text-[#6b4e0e]"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {phase.reason}</div>}
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-line bg-white"><MicrosoftLogo size={22} /></span>
            <div>
              <h3 className="h-display text-xl">Connect your Microsoft 365 directory</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">You'll sign in with Microsoft and approve read-only access to your organisation's user list. Inkwell never sends email or changes anything in Microsoft 365.</p>
            </div>
          </div>
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-line bg-paper/50 px-3.5 py-3 text-sm text-ink-3">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-pine" />
            <span>The first time, sign in as a <strong>Microsoft 365 admin</strong> and tick <strong>“Consent on behalf of your organization”</strong>. After that, anyone in your workspace can re-sync.</span>
          </div>
          <button className="btn btn-ink mt-5 h-11 w-full" onClick={async () => { const e = await connectMicrosoftDirectory(hasAzure); if (e) setPhase({ k: 'error', msg: e.message }) }}>
            <MicrosoftLogo /> Continue with Microsoft
          </button>
        </div>
      )}

      {phase.k === 'error' && (
        <div className="py-6 text-center">
          <AlertTriangle className="mx-auto text-clay" />
          <p className="mt-3 text-sm text-ink-3">{phase.msg}</p>
          <button className="btn btn-line mt-5" onClick={() => setPhase({ k: 'connect' })}><RefreshCw size={14} /> Try again</button>
        </div>
      )}

      {phase.k === 'importing' && (
        <div className="py-12 text-center">
          <Loader2 className="mx-auto animate-spin text-clay" />
          <p className="mt-3 text-sm font-semibold">Importing {phase.done} of {phase.total}…</p>
          <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-pine transition-all" style={{ width: `${(phase.done / Math.max(phase.total, 1)) * 100}%` }} /></div>
        </div>
      )}

      {phase.k === 'pick' && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input className="input pl-9" placeholder={`Search ${people.length} people`} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input w-auto" value={dept} onChange={(e) => setDept(e.target.value)}>{depts.map((d) => <option key={d}>{d}</option>)}</select>
          </div>
          <div className="rounded-xl border border-line">
            <button className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left text-xs font-semibold text-muted" onClick={() => {
              const next = new Set(sel)
              list.forEach((p) => (allOn ? next.delete(p.id) : next.add(p.id)))
              setSel(next)
            }}>
              <Box on={allOn} /> {allOn ? 'Deselect' : 'Select'} {list.length} shown
            </button>
            <div className="scroll-thin max-h-[300px] divide-y divide-line overflow-y-auto">
              {list.map((p) => {
                const email = (p.mail || p.userPrincipalName).toLowerCase()
                return (
                  <button key={p.id} className={clsx('flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition', sel.has(p.id) ? 'bg-clay-soft/30' : 'hover:bg-paper/60')} onClick={() => {
                    const next = new Set(sel)
                    next.has(p.id) ? next.delete(p.id) : next.add(p.id)
                    setSel(next)
                  }}>
                    <Box on={sel.has(p.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.displayName}</span>
                      <span className="block truncate text-xs text-muted">{[p.jobTitle, p.department, email].filter(Boolean).join(' · ')}</span>
                    </span>
                    {existing.has(email) && <span className="tag bg-pine-soft text-pine">Will update</span>}
                  </button>
                )
              })}
              {!list.length && <p className="py-8 text-center text-sm text-muted">No one matches.</p>}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Template for new people">
              <select className="input" value={tpl} onChange={(e) => setTpl(e.target.value)}>{TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </Field>
            <div className="pt-[22px]"><Toggle on={photos} onChange={setPhotos} label="Import profile photos" /></div>
          </div>
        </>
      )}
    </Modal>
  )
}

function Box({ on }: { on: boolean }) {
  return <span className={clsx('grid size-[18px] shrink-0 place-items-center rounded-[5px] border', on ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-surface')}>{on && <Check size={12} strokeWidth={3} />}</span>
}
