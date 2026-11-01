import { useEffect, useMemo, useRef, useState } from 'react'
import { useSignatureExport } from '../components/useExport'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Copy, Download, FileSpreadsheet, Plus, Search, Trash2, Upload, UserPlus, Wand2, Eye, Send, BarChart3 } from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../store'
import type { Employee, Signature } from '../types'
import { TEMPLATES, templateById, uid, DEFAULT_EXTRAS } from '../lib/templates'
import { renderSignature } from '../lib/render'
import { copyRich, download, parseCsv, timeAgo } from '../lib/io'
import { Avatar, Field, Modal, PageHeader, SigThumb, useToast } from '../components/ui'
import MicrosoftConnect from '../components/MicrosoftImport'
import SendSignatures, { takePendingSend, type PendingSend } from '../components/SendSignatures'
import { MicrosoftLogo } from './Auth'

const STATUS: Record<Employee['status'], { label: string; cls: string }> = {
  active: { label: 'On brand', cls: 'bg-pine-soft text-pine' },
  outdated: { label: 'Left directory', cls: 'bg-butter-soft text-[#8a6410]' },
  invited: { label: 'Invited', cls: 'bg-paper-2 text-muted' },
}

const CSV_TEMPLATE = `name,title,department,email,phone,photo
Jane Smith,Marketing Manager,Marketing,jane@yourcompany.com,+61 400 000 000,
`

/** Turn a person + the brand kit into a full signature. */
export function employeeSignature(e: Employee, brand: ReturnType<typeof useStore>['brand'], campaignId: string | null): Signature {
  const meta = templateById(e.templateId ?? brand.defaultTemplateId)
  return {
    id: e.id, label: e.fullName, templateId: meta.id,
    fields: { fullName: e.fullName, title: e.title, department: e.department, company: brand.company, pronouns: '', phone: e.phone || brand.phone, mobile: '', email: e.email, website: brand.website, address: '', photo: e.photo, logo: brand.logo, logoLight: brand.logoLight ?? '' },
    socials: brand.socials,
    design: { primary: brand.primary, accent: brand.accent, text: meta.design.text ?? '#0f172a', font: brand.font, photoShape: meta.design.photoShape ?? 'circle', size: 'md', iconStyle: meta.design.iconStyle ?? 'filled' },
    extras: { ...DEFAULT_EXTRAS, animations: meta.animated, verified: false, disclaimer: brand.disclaimer, campaignId },
    createdAt: e.updatedAt, updatedAt: e.updatedAt,
  }
}

export default function Team() {
  const store = useStore()
  const { employees, brand, campaigns } = store
  const toast = useToast()
  const exportSig = useSignatureExport()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('All')
  const [sel, setSel] = useState<string[]>([])
  const [params, setParams] = useSearchParams()
  const [importOpen, setImportOpen] = useState(params.get('import') === 'csv')
  const [msOpen, setMsOpen] = useState(params.get('import') === 'microsoft' || params.get('connect') === 'microsoft')
  useEffect(() => {
    // ?import=… deep links (dashboard buttons, the Microsoft OAuth return) open the matching dialog once.
    if (params.get('import') || params.get('connect') || params.get('send')) { params.delete('import'); params.delete('connect'); params.delete('send'); setParams(params, { replace: true }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [addOpen, setAddOpen] = useState(false)
  const [view, setView] = useState<Employee | null>(null)

  // Send via email. ?send=resume = back from the Microsoft "send as me" permission screen.
  const [sendIds, setSendIds] = useState<string[] | null>(null)
  const [resume, setResume] = useState<PendingSend | null>(null)
  const resumeRequested = useRef(params.get('send') === 'resume')
  useEffect(() => {
    if (!resumeRequested.current || store.loading) return
    resumeRequested.current = false
    const pending = takePendingSend()
    if (pending) { setResume(pending); setSendIds(pending.ids) }
  }, [store.loading])
  const openSend = (ids: string[]) => { setResume(null); setSendIds(ids) }

  const depts = useMemo(() => ['All', ...new Set(employees.map((e) => e.department).filter(Boolean))], [employees])
  const list = employees.filter((e) => (dept === 'All' || e.department === dept) && `${e.fullName} ${e.email} ${e.title}`.toLowerCase().includes(q.toLowerCase()))
  const allOn = list.length > 0 && list.every((e) => sel.includes(e.id))

  // Team signatures use Automatic banners: the renderer picks the live campaign for each person's department.
  const sigFor = (e: Employee) => employeeSignature(e, brand, null)

  const assign = (templateId: string) => {
    sel.forEach((id) => store.updateEmployee(id, { templateId, status: 'active' }))
    toast(`${templateById(templateId).name} assigned to ${sel.length} ${sel.length === 1 ? 'person' : 'people'}`)
    setSel([])
  }

  const exportAll = async () => {
    const targets = (sel.length ? employees.filter((e) => sel.includes(e.id)) : employees)
    let rendered: string[]
    try { rendered = await Promise.all(targets.map(async (e) => (await exportSig(sigFor(e), 'emp')).html)) } catch (err) { toast((err as Error).message); return }
    const body = targets.map((e, i) => `<section style="margin:0 0 40px;padding:0 0 32px;border-bottom:1px solid #eee;"><h3 style="font:600 13px Helvetica,Arial;color:#777;margin:0 0 14px;">${e.fullName} — ${e.email}</h3>${rendered[i]}</section>`).join('\n')
    download(`${brand.company.replace(/\s+/g, '-').toLowerCase()}-team-signatures.html`, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${brand.company} team signatures</title></head><body style="padding:32px;">${body}</body></html>`)
    toast(`Exported ${targets.length} signatures`)
  }

  return (
    <>
      <PageHeader
        eyebrow="Signature manager"
        title="Team manager"
        subtitle={store.org.msTenantId
          ? <span className="inline-flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-pine-soft px-2.5 py-0.5 text-xs font-semibold text-pine"><MicrosoftLogo size={11} /> Auto-sync on</span>{store.org.msSyncedAt ? `Last synced ${timeAgo(store.org.msSyncedAt)}` : 'Waiting for first sync'}{store.org.msSyncStatus && store.org.msSyncStatus !== 'ok' && <span className="text-clay-ink">· {store.org.msSyncStatus === 'consent_revoked' ? 'Microsoft access was revoked — reconnect' : 'Last sync failed'}</span>}</span>
          : 'One brand kit, every employee. Connect Microsoft 365 or import a CSV, and everyone gets a consistent, compliant signature.'}
        actions={<>
          <button className="btn btn-line" onClick={() => setMsOpen(true)}><MicrosoftLogo size={15} /> {store.org.msTenantId ? 'Sync now' : 'Connect Microsoft 365'}</button>
          <button className="btn btn-line" onClick={() => setImportOpen(true)}><Upload size={16} /> CSV import</button>
          <button className="btn btn-ink" onClick={() => setAddOpen(true)}><UserPlus size={16} /> Add person</button>
        </>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          ['Members', employees.length],
          ['On brand', employees.filter((e) => e.status === 'active' && e.templateId).length],
          ['Outdated', employees.filter((e) => e.status === 'outdated').length],
          ['Departments', depts.length - 1],
        ].map(([l, v]) => (
          <div key={l} className="card px-4 py-3.5"><div className="text-xs text-muted">{l}</div><div className="h-display text-2xl">{v}</div></div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
          <div className="relative w-full sm:w-60">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input className="input pl-9" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="scroll-thin flex flex-1 gap-1.5 overflow-x-auto">
            {depts.map((d) => <button key={d} className="chip shrink-0" data-on={dept === d} onClick={() => setDept(d)}>{d}</button>)}
          </div>
          <button className="btn btn-line btn-sm" onClick={exportAll}><Download size={14} /> Export {sel.length ? `${sel.length} selected` : 'all'}</button>
        </div>

        {sel.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-ink px-4 py-2.5 text-paper">
            <span className="text-sm font-semibold">{sel.length} selected</span>
            <span className="text-paper/40">·</span>
            <span className="text-sm text-paper/70">Assign template</span>
            <select className="h-8 rounded-lg border border-paper/20 bg-paper/10 px-2 text-sm text-paper outline-none" defaultValue="" onChange={(e) => e.target.value && assign(e.target.value)}>
              <option value="" disabled>Choose…</option>
              {TEMPLATES.map((t) => <option key={t.id} value={t.id} className="text-ink">{t.name}</option>)}
            </select>
            <button className="btn btn-clay btn-sm ml-auto" onClick={() => openSend(sel)}><Send size={14} /> Send via email</button>
            <button className="btn btn-sm text-paper/80 hover:bg-paper/10" onClick={() => { store.deleteEmployees(sel); toast(`Removed ${sel.length}`); setSel([]) }}><Trash2 size={14} /> Remove</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="w-10 py-2.5 pl-4"><Check0 on={allOn} onClick={() => setSel(allOn ? [] : list.map((e) => e.id))} /></th>
                <th className="py-2.5 font-medium">Person</th>
                <th className="py-2.5 font-medium">Department</th>
                <th className="py-2.5 font-medium">Template</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="py-2.5 font-medium">Updated</th>
                <th className="py-2.5 pr-4" />
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className={clsx('group border-b border-line last:border-0 transition', sel.includes(e.id) ? 'bg-clay-soft/40' : 'hover:bg-paper/60')}>
                  <td className="py-3 pl-4"><Check0 on={sel.includes(e.id)} onClick={() => setSel(sel.includes(e.id) ? sel.filter((x) => x !== e.id) : [...sel, e.id])} /></td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={e.fullName} photo={e.photo} size={34} />
                      <div><div className="font-semibold">{e.fullName}</div><div className="text-xs text-muted">{e.title} · {e.email}</div></div>
                    </div>
                  </td>
                  <td className="py-3 text-ink-3">{e.department || '—'}</td>
                  <td className="py-3">
                    <select className="h-8 rounded-lg border border-transparent bg-transparent pr-2 text-sm font-medium outline-none hover:border-line-2" value={e.templateId ?? ''} onChange={(ev) => store.updateEmployee(e.id, { templateId: ev.target.value || null, status: ev.target.value ? 'active' : e.status })}>
                      <option value="">Not assigned</option>
                      {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </td>
                  <td className="py-3">
                    <span className={clsx('tag', STATUS[e.status].cls)}>{STATUS[e.status].label}</span>
                    {e.sentAt && <div className="mt-1 flex items-center gap-1 text-[11px] text-muted"><Send size={10} /> Sent {timeAgo(e.sentAt)}</div>}
                  </td>
                  <td className="py-3 text-xs text-muted">{timeAgo(e.updatedAt)}</td>
                  <td className="py-3 pr-4 text-right">
                    <div className="flex justify-end gap-1 opacity-60 transition group-hover:opacity-100">
                      <button className="btn btn-ghost btn-sm" onClick={() => setView(e)}><Eye size={14} /> Preview</button>
                      {store.role !== 'member' && <button className="btn btn-ghost btn-sm btn-icon" aria-label="Click insights" title="Click insights" onClick={() => navigate(`/insights?person=${e.id}`)}><BarChart3 size={14} /></button>}
                      <button className="btn btn-ghost btn-sm btn-icon" aria-label="Email signature" title="Email signature" onClick={() => openSend([e.id])}><Send size={14} /></button>
                      <button className="btn btn-ghost btn-sm btn-icon" aria-label="Copy" onClick={async () => { try { await copyRich((await exportSig(sigFor(e), 'emp')).html); toast(`Copied ${e.fullName.split(' ')[0]}'s signature`) } catch (err) { toast((err as Error).message) } }}><Copy size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-14 text-center">
                  {employees.length ? <span className="text-muted">No one matches that search.</span> : (
                    <div className="mx-auto max-w-md">
                      <h3 className="h-display text-2xl">Bring in your team</h3>
                      <p className="mt-1 text-sm text-muted">Everyone you add gets a signature built from your brand kit. Re-sync any time people join or change roles.</p>
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <button className="btn btn-ink" onClick={() => setMsOpen(true)}><MicrosoftLogo size={15} /> Connect Microsoft 365</button>
                        <button className="btn btn-line" onClick={() => setImportOpen(true)}><Upload size={15} /> Upload CSV</button>
                        <button className="btn btn-ghost" onClick={() => setAddOpen(true)}><UserPlus size={15} /> Add one person</button>
                      </div>
                    </div>
                  )}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <MicrosoftConnect open={msOpen} onClose={() => setMsOpen(false)} />
      {sendIds && (
        <SendSignatures open key={resume ? 'resume' : sendIds.join()} people={employees.filter((e) => sendIds.includes(e.id))} sigFor={sigFor} resume={resume}
          onClose={() => { setSendIds(null); setResume(null); setSel([]) }} />
      )}
      <AddModal open={addOpen} onClose={() => setAddOpen(false)} />
      <Modal open={!!view} onClose={() => setView(null)} title={view?.fullName ?? ''} subtitle={view ? `${templateById(view.templateId ?? brand.defaultTemplateId).name} · generated from your brand kit` : ''} width={720}
        footer={view && <>
          <button className="btn btn-line" onClick={async () => { try { download(`${view.fullName.replace(/\s+/g, '-').toLowerCase()}.html`, (await exportSig(sigFor(view), 'emp')).doc) } catch (err) { toast((err as Error).message) } }}><Download size={15} /> Download</button>
          <button className="btn btn-clay" onClick={async () => { try { await copyRich((await exportSig(sigFor(view), 'emp')).html); toast('Copied') } catch (err) { toast((err as Error).message) } }}><Copy size={15} /> Copy signature</button>
        </>}>
        {view && <div className="overflow-x-auto rounded-xl border border-line bg-white p-6"><SigThumb html={renderSignature(sigFor(view), { campaigns })} align="left" /></div>}
      </Modal>
    </>
  )
}

function Check0({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={clsx('grid size-[18px] place-items-center rounded-[5px] border transition', on ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-surface hover:border-ink')} aria-label="Select">
      {on && <Check size={12} strokeWidth={3} />}
    </button>
  )
}

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore()
  const toast = useToast()
  const [text, setText] = useState('')
  const [tpl, setTpl] = useState(store.brand.defaultTemplateId)
  const file = useRef<HTMLInputElement>(null)
  const rows = parseCsv(text)
  const valid = rows.filter((r) => (r.name || r.fullname) && r.email)

  const run = () => {
    const list: Employee[] = valid.map((r) => ({
      id: uid(), fullName: r.name || r.fullname, title: r.title || r.jobtitle || '', department: r.department || r.team || '',
      email: r.email, phone: r.phone || r.mobile || '', photo: r.photo || '', templateId: tpl, status: 'active', source: 'csv', externalId: null, updatedAt: Date.now(),
    }))
    store.upsertEmployees(list)
    toast(`Created ${list.length} signatures`)
    setText('')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Bulk create signatures" subtitle="Paste or upload a CSV. Existing people (matched by email) are updated." width={680}
      footer={<><button className="btn btn-line" onClick={onClose}>Cancel</button><button className="btn btn-ink" disabled={!valid.length} onClick={run}><Wand2 size={15} /> Generate {valid.length || ''} signatures</button></>}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="btn btn-line btn-sm" onClick={() => file.current?.click()}><FileSpreadsheet size={14} /> Upload .csv</button>
        <button className="btn btn-ghost btn-sm" onClick={() => download('inkwell-people-template.csv', CSV_TEMPLATE, 'text/csv')}><Download size={14} /> CSV template</button>
        <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()) }} />
        <span className="ml-auto text-xs text-muted">Columns: name, title, department, email, phone, photo</span>
      </div>
      <textarea className="input font-mono text-xs" rows={7} placeholder={CSV_TEMPLATE} value={text} onChange={(e) => setText(e.target.value)} />
      <Field label="Template for everyone" className="mt-4">
        <select className="input" value={tpl} onChange={(e) => setTpl(e.target.value)}>{TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </Field>
      {rows.length > 0 && (
        <div className="mt-4 rounded-xl border border-line">
          <div className="border-b border-line px-3 py-2 text-xs font-semibold text-muted">{valid.length} of {rows.length} rows ready{rows.length > valid.length && ' — rows need a name and email'}</div>
          <div className="max-h-40 divide-y divide-line overflow-y-auto">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                {(r.name || r.fullname) && r.email ? <Check size={14} className="text-pine" /> : <span className="size-3.5 rounded-full bg-[#fca5a5]" />}
                <span className="font-medium">{r.name || r.fullname || '—'}</span>
                <span className="truncate text-muted">{r.title} · {r.email}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

function AddModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore()
  const toast = useToast()
  const blank = { fullName: '', title: '', department: '', email: '', phone: '' }
  const [f, setF] = useState(blank)
  const ok = f.fullName && /\S+@\S+/.test(f.email)
  const save = () => {
    store.upsertEmployees([{ id: uid(), ...f, photo: '', templateId: store.brand.defaultTemplateId, status: 'active', source: 'manual', externalId: null, updatedAt: Date.now() }])
    toast(`${f.fullName} added`)
    setF(blank)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Add a team member" subtitle="They'll get the default template from your brand kit." width={520}
      footer={<><button className="btn btn-line" onClick={onClose}>Cancel</button><button className="btn btn-ink" disabled={!ok} onClick={save}><Plus size={15} /> Add person</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name" className="col-span-2"><input className="input" autoFocus value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
        <Field label="Job title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Department"><input className="input" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} /></Field>
        <Field label="Work email"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
