import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { AlertTriangle, Check, ChevronDown, Copy, Loader2, Mail, Play, Send, ShieldCheck, Smartphone, Trash2, X } from 'lucide-react'
import { useAuth } from '../auth'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { copyText, timeAgo } from '../lib/io'
import { CLIENT_LABEL, removeScript, setupScript } from '../lib/relayScript'
import { Modal, PageHeader, Toggle, useToast } from '../components/ui'
import { MicrosoftLogo } from './Auth'

type StepState = 'pending' | 'running' | 'done' | 'waiting' | 'error'
interface RelayInfo {
  host?: string
  status: 'not_setup' | 'setting_up' | 'active' | 'removing' | 'removed' | 'error'
  purpose?: 'setup' | 'remove'
  steps: Record<string, { state: StepState; detail?: string; at?: string }>
  warnings?: string[]
  adminUpn?: string
  activeAt?: string
}
interface Scope { mode: 'test' | 'departments' | 'all'; departments: string[]; paused: boolean; testEmails: string[] }
interface RelayEvent { id: number; sender: string; client: string | null; status: string; ms: number | null; created_at: string }

const DEFAULT_SCOPE: Scope = { mode: 'test', departments: [], paused: false, testEmails: [] }
const EMPTY: RelayInfo = { status: 'not_setup', steps: {} }

const STEP_LABEL: Record<string, string> = {
  host: 'Reserve your private relay address',
  domain: 'Add the relay domain to Microsoft 365',
  verify: 'Verify the domain',
  accepted: 'Wait for Exchange to accept the domain',
  cert: 'Issue the TLS certificate',
  inbound: 'Create the inbound connector',
  outbound: 'Create the outbound connector',
  rule: 'Create the routing rule',
}
const REMOVE_LABEL: Record<string, string> = {
  rule: 'Remove the routing rule',
  outbound: 'Remove the outbound connector',
  inbound: 'Remove the inbound connector',
  domain: 'Remove the relay domain',
  dns: 'Clean up DNS',
}

async function api(orgId: string, action: string, extra: Record<string, unknown> = {}) {
  const { data } = await supabase.auth.getSession()
  const res = await fetch('/api/exchange/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify({ orgId, action, ...extra }),
  })
  const body = await res.json().catch(() => ({ error: res.status === 404 ? 'Mail routing runs on the deployed site, not the local dev server.' : `Server error ${res.status}` }))
  if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`)
  return body as { url?: string; relay?: RelayInfo }
}

export default function MailRouting() {
  const { org, role, employees } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const isAdmin = role !== 'member'
  const [relay, setRelay] = useState<RelayInfo>(EMPTY)
  const [scope, setScope] = useState<Scope>(DEFAULT_SCOPE)
  const [events, setEvents] = useState<RelayEvent[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const alive = useRef(true)
  const running = useRef(false)

  const load = useCallback(async () => {
    const [{ data: o }, { data: ev }] = await Promise.all([
      supabase.from('organizations').select('relay, relay_scope').eq('id', org.id).single(),
      supabase.from('relay_events').select('id, sender, client, status, ms, created_at').eq('org_id', org.id).order('created_at', { ascending: false }).limit(40),
    ])
    if (o) {
      setRelay((o.relay as RelayInfo | null) ?? EMPTY)
      setScope({ ...DEFAULT_SCOPE, ...((o.relay_scope as Partial<Scope> | null) ?? {}) })
    }
    setEvents((ev as RelayEvent[] | null) ?? [])
    setLoaded(true)
  }, [org.id])

  useEffect(() => {
    alive.current = true
    load()
    return () => { alive.current = false }
  }, [load])

  // Drive setup/removal: call `step` until it's finished, pausing while Microsoft catches up.
  const drive = useCallback(async () => {
    if (running.current) return
    running.current = true
    try {
      for (let i = 0; i < 120 && alive.current; i++) {
        const { relay: r } = await api(org.id, 'step')
        if (!r) break
        setRelay(r)
        if (r.status !== 'setting_up' && r.status !== 'removing') break
        const waiting = Object.values(r.steps).some((s) => s.state === 'waiting')
        await new Promise((res) => setTimeout(res, waiting ? 15_000 : 1000))
      }
    } catch (e) {
      toast((e as Error).message)
    } finally {
      running.current = false
      if (alive.current) load()
    }
  }, [org.id, load, toast])

  useEffect(() => {
    if (loaded && isAdmin && (relay.status === 'setting_up' || relay.status === 'removing')) drive()
  }, [loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live test feed.
  useEffect(() => {
    if (relay.status !== 'active') return
    const t = setInterval(load, 10_000)
    return () => clearInterval(t)
  }, [relay.status, load])

  const start = async (purpose: 'setup' | 'remove') => {
    setBusy(true)
    try {
      const { url } = await api(org.id, 'start', { purpose })
      if (url) location.href = url
    } catch (e) {
      toast((e as Error).message)
      setBusy(false)
    }
  }

  const saveScope = async (next: Scope) => {
    setScope(next)
    const { error } = await supabase.from('organizations').update({ relay_scope: next }).eq('id', org.id)
    if (error) toast(`Couldn’t save: ${error.message}`)
  }

  const departments = useMemo(() => [...new Set(employees.map((e) => e.department.trim()).filter(Boolean))].sort(), [employees])
  const active = relay.status === 'active'
  const inProgress = relay.status === 'setting_up' || relay.status === 'removing'
  const connected = Boolean(org.msTenantId)

  if (!loaded) return <div className="grid place-items-center py-24 text-muted"><Loader2 className="animate-spin" /></div>

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Server-side signatures"
        title={<>Every email, every device</>}
        subtitle="Route your Microsoft 365 mail through Inkwell and signatures are added after people hit send — on phones, laptops and the web. Change a signature here and the next email carries it."
      />

      {!isAdmin && <Notice tone="info">Only workspace admins can change mail routing. You can see its status here.</Notice>}

      <StepCard n={1} title="Connect Microsoft 365" done={connected}>
        {connected ? (
          <p className="text-sm text-muted">Your directory is connected, so Inkwell knows who each sender is.</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Import your people from Microsoft 365 first.</p>
            <Link to="/team?connect=microsoft" className="btn btn-ink btn-sm"><MicrosoftLogo /> Connect Microsoft 365</Link>
          </div>
        )}
      </StepCard>

      <StepCard n={2} title="Set up mail routing" done={active} locked={!connected}>
        {relay.status === 'not_setup' || relay.status === 'removed' ? (
          <>
            <p className="text-sm leading-relaxed text-muted">
              A Microsoft 365 <strong className="text-ink-3">Global</strong> or <strong className="text-ink-3">Exchange administrator</strong> signs in once.
              Inkwell then adds its relay domain, two connectors and one routing rule — nothing else in your tenant changes, and Inkwell keeps no admin access afterwards.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-ink-3">
              <Li>Starts in <strong>test mode</strong>: only you get server-side signatures until you roll out.</Li>
              <Li>If Inkwell is ever unreachable, Microsoft holds and retries mail — nothing is lost.</Li>
              <Li>Pause or remove it from this page at any time.</Li>
            </ul>
            <button disabled={!isAdmin || !connected || busy} onClick={() => start('setup')} className="btn btn-ink mt-5">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <MicrosoftLogo />} Sign in as Microsoft 365 admin
            </button>
          </>
        ) : (
          <>
            {relay.host && <p className="mb-3 text-xs text-muted">Relay address <code className="rounded bg-paper-2 px-1.5 py-0.5 font-mono text-ink-3">{relay.host}</code>{relay.adminUpn && <> · set up by {relay.adminUpn}</>}</p>}
            {(inProgress || relay.status === 'error') && <Checklist relay={relay} />}
            {active && <p className="flex items-center gap-2 text-sm font-medium text-pine"><ShieldCheck size={16} /> Mail routing is on{relay.activeAt && <span className="font-normal text-muted">since {new Date(relay.activeAt).toLocaleDateString()}</span>}</p>}
            {relay.status === 'error' && isAdmin && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => drive()} className="btn btn-line btn-sm"><Play size={14} /> Retry</button>
                <button onClick={() => start(relay.purpose ?? 'setup')} disabled={busy} className="btn btn-ink btn-sm"><MicrosoftLogo /> Sign in again and continue</button>
              </div>
            )}
          </>
        )}
        {(relay.warnings ?? []).map((w) => <Notice key={w} tone="warn">{w}</Notice>)}
        {relay.host && <Script title="Prefer PowerShell? The same changes as a script" text={setupScript(relay.host)} />}
      </StepCard>

      <StepCard n={3} title="Test it yourself" done={active && events.some((e) => e.status === 'signed')} locked={!active}>
        <p className="text-sm text-muted">Send an email to any outside address from your phone and from your laptop. Each app ticks off here as Inkwell signs it.</p>
        <ClientTicks events={events} />
        <TestUsers emails={scope.testEmails} disabled={!isAdmin} onChange={(testEmails) => saveScope({ ...scope, testEmails })} suggestion={user?.email ?? ''} />
        {events.length > 0 && <EventList events={events} />}
      </StepCard>

      <StepCard n={4} title="Roll out" done={active && scope.mode !== 'test'} locked={!active}>
        <p className="mb-3 text-sm text-muted">Choose who gets server-side signatures. This changes instantly — Microsoft 365 doesn’t need to be touched again.</p>
        <div className="seg mb-4">
          {(['test', 'departments', 'all'] as const).map((m) => (
            <button key={m} disabled={!isAdmin} data-on={scope.mode === m} onClick={() => saveScope({ ...scope, mode: m })}>
              {m === 'test' ? 'Test people only' : m === 'departments' ? 'Chosen departments' : 'Everyone'}
            </button>
          ))}
        </div>
        {scope.mode === 'departments' && (
          departments.length ? (
            <div className="flex flex-wrap gap-2">
              {departments.map((d) => {
                const on = scope.departments.some((x) => x.toLowerCase() === d.toLowerCase())
                return (
                  <button key={d} disabled={!isAdmin} onClick={() => saveScope({ ...scope, departments: on ? scope.departments.filter((x) => x.toLowerCase() !== d.toLowerCase()) : [...scope.departments, d] })}
                    className={clsx('chip', on && '!border-pine !bg-pine-soft !text-pine')}>
                    {on && <Check size={12} />} {d}
                  </button>
                )
              })}
            </div>
          ) : <p className="text-sm text-muted">No departments found on your people yet.</p>
        )}
        {scope.mode === 'all' && <p className="text-sm text-ink-3">Everyone in your directory now gets their signature on every email.</p>}
      </StepCard>

      <StepCard n={5} title="Tell your team" locked={!active}>
        <p className="text-sm text-muted">So signatures don’t appear twice, staff should delete the signature saved in Outlook, Outlook mobile and their phone’s mail app.</p>
        <Script title="Message to send your team" open text={STAFF_MESSAGE} />
      </StepCard>

      {(active || relay.status === 'error') && isAdmin && (
        <div className="card mt-6 space-y-3 p-5">
          <Toggle on={scope.paused} onChange={(paused) => saveScope({ ...scope, paused })} label={scope.paused ? 'Paused — mail goes out without Inkwell signatures' : 'Pause signatures'} desc="Mail still flows normally. Turn back on any time." />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
            <span>
              <span className="block text-sm font-semibold">Remove mail routing</span>
              <span className="block text-xs text-muted">Signs in as admin again and deletes everything Inkwell added to Microsoft 365.</span>
            </span>
            <button onClick={() => setConfirmRemove(true)} className="btn btn-line btn-sm text-clay-ink"><Trash2 size={14} /> Remove</button>
          </div>
          <Script title="Emergency removal script" text={removeScript(relay.host)} />
        </div>
      )}

      <Modal open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remove mail routing?" subtitle="Mail will go straight out from Microsoft 365 again, without server-side signatures."
        footer={<><button className="btn btn-ghost" onClick={() => setConfirmRemove(false)}>Cancel</button><button className="btn btn-clay" disabled={busy} onClick={() => start('remove')}><MicrosoftLogo /> Sign in and remove</button></>}>
        <p className="text-sm text-muted">Tip: if you only want to stop signatures for a while, use <strong>Pause</strong> instead — it needs no admin sign-in.</p>
      </Modal>
    </div>
  )
}

const STAFF_MESSAGE = `Hi team,

From today our email signatures are added automatically after you press Send — on your phone, laptop and Outlook on the web. Your signature will always be up to date.

Please delete the signature saved in your mail apps so it doesn't appear twice:
• Outlook (Windows/Mac): Settings › Signatures › delete, and set "New messages" and "Replies" to (none)
• Outlook on the web: Settings › Mail › Compose and reply › delete the signature
• Outlook mobile: Settings › Signature › clear it (including "Get Outlook for iOS/Android")
• iPhone Mail: Settings › Apps › Mail › Signature › clear it

You won't see the signature while writing — it's added on the way out. Thanks!`

// ---------------------------------------------------------------- pieces

function StepCard({ n, title, done, locked, children }: { n: number; title: string; done?: boolean; locked?: boolean; children: ReactNode }) {
  return (
    <section className={clsx('card mb-4 p-5 md:p-6', locked && 'opacity-55')}>
      <div className="mb-3 flex items-center gap-3">
        <span className={clsx('grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold', done ? 'bg-pine text-white' : 'bg-paper-2 text-ink-3')}>
          {done ? <Check size={15} strokeWidth={3} /> : n}
        </span>
        <h2 className="h-display text-xl">{title}</h2>
      </div>
      <div className={clsx(locked && 'pointer-events-none')}>{children}</div>
    </section>
  )
}

const Li = ({ children }: { children: ReactNode }) => <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-pine" /><span>{children}</span></li>

function Notice({ tone, children }: { tone: 'warn' | 'info'; children: ReactNode }) {
  return (
    <div className={clsx('mt-3 flex gap-2 rounded-xl px-3.5 py-2.5 text-sm', tone === 'warn' ? 'bg-butter-soft text-ink-3' : 'bg-paper-2 text-muted')}>
      {tone === 'warn' && <AlertTriangle size={16} className="mt-0.5 shrink-0 text-clay-ink" />}<span>{children}</span>
    </div>
  )
}

function Checklist({ relay }: { relay: RelayInfo }) {
  const labels = relay.purpose === 'remove' ? REMOVE_LABEL : STEP_LABEL
  return (
    <ol className="space-y-2">
      {Object.keys(labels).filter((id) => relay.steps[id]).map((id) => {
        const s = relay.steps[id]
        return (
          <li key={id} className="flex gap-3 text-sm">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center">
              {s.state === 'done' ? <Check size={16} strokeWidth={3} className="text-pine" />
                : s.state === 'running' || s.state === 'waiting' ? <Loader2 size={15} className="animate-spin text-clay" />
                : s.state === 'error' ? <X size={16} strokeWidth={3} className="text-clay-ink" />
                : <span className="size-2 rounded-full bg-line-2" />}
            </span>
            <span>
              <span className={clsx(s.state === 'pending' ? 'text-faint' : 'text-ink-2', 'font-medium')}>{labels[id]}</span>
              {s.detail && <span className={clsx('block text-xs', s.state === 'error' ? 'text-clay-ink' : 'text-muted')}>{s.detail}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function ClientTicks({ events }: { events: RelayEvent[] }) {
  const seen = new Map<string, RelayEvent>()
  for (const e of [...events].reverse()) if (e.status === 'signed') seen.set(e.client ?? 'other', e)
  const want = [
    { key: 'outlook-mobile', label: 'Phone (Outlook)', icon: Smartphone, alt: ['apple-mail'] },
    { key: 'outlook-desktop', label: 'Laptop (Outlook)', icon: Mail, alt: ['outlook-mac'] },
    { key: 'other', label: 'Outlook on the web', icon: Send, alt: [] as string[] },
  ]
  return (
    <div className="my-4 grid gap-2 sm:grid-cols-3">
      {want.map((w) => {
        const hit = seen.get(w.key) ?? w.alt.map((a) => seen.get(a)).find(Boolean)
        const Icon = w.icon
        return (
          <div key={w.key} className={clsx('flex items-center gap-2.5 rounded-xl border px-3 py-2.5', hit ? 'border-pine/40 bg-pine-soft' : 'border-line')}>
            <Icon size={16} className={hit ? 'text-pine' : 'text-faint'} />
            <span className="text-sm">
              <span className="block font-medium">{w.label}</span>
              <span className="block text-xs text-muted">{hit ? `✓ ${CLIENT_LABEL[hit.client ?? 'other'] ?? hit.client} · ${timeAgo(Date.parse(hit.created_at))}` : 'Waiting for an email…'}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

function TestUsers({ emails, onChange, disabled, suggestion }: { emails: string[]; onChange: (e: string[]) => void; disabled: boolean; suggestion: string }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const e = draft.trim().toLowerCase()
    if (!e.includes('@') || emails.includes(e)) return
    onChange([...emails, e])
    setDraft('')
  }
  return (
    <div>
      <span className="field-label">Test people</span>
      <div className="flex flex-wrap items-center gap-2">
        {emails.map((e) => (
          <span key={e} className="chip">{e}{!disabled && <button aria-label={`Remove ${e}`} onClick={() => onChange(emails.filter((x) => x !== e))}><X size={12} /></button>}</span>
        ))}
        {!emails.length && suggestion && !disabled && <button className="chip" onClick={() => onChange([suggestion.toLowerCase()])}>+ {suggestion}</button>}
        {!disabled && (
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} onBlur={add}
            placeholder="Add an email…" className="input !h-8 w-48 !text-sm" />
        )}
      </div>
    </div>
  )
}

function EventList({ events }: { events: RelayEvent[] }) {
  const tone: Record<string, string> = { signed: 'text-pine', skipped: 'text-muted', passthrough: 'text-muted', failed_open: 'text-clay-ink', deferred: 'text-clay-ink', rejected: 'text-clay-ink' }
  const label: Record<string, string> = { signed: 'Signed', skipped: 'Not in rollout', passthrough: 'Left as is', failed_open: 'Sent unsigned', deferred: 'Retrying', rejected: 'Too large' }
  return (
    <div className="mt-5">
      <span className="field-label">Recent emails</span>
      <div className="divide-y divide-line rounded-xl border border-line text-sm">
        {events.slice(0, 12).map((e) => (
          <div key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-3.5 py-2">
            <span className="min-w-0 truncate">{e.sender}</span>
            <span className="flex items-center gap-3 text-xs text-muted">
              <span>{CLIENT_LABEL[e.client ?? 'other'] ?? e.client}</span>
              <span className={clsx('font-medium', tone[e.status])}>{label[e.status] ?? e.status}</span>
              <span>{timeAgo(Date.parse(e.created_at))}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Script({ title, text, open: initial }: { title: string; text: string; open?: boolean }) {
  const [open, setOpen] = useState(Boolean(initial))
  const toast = useToast()
  return (
    <div className="mt-4">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
        <ChevronDown size={14} className={clsx('transition', open && 'rotate-180')} /> {title}
      </button>
      {open && (
        <div className="relative mt-2">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-ink p-4 pr-12 font-mono text-[12px] leading-relaxed text-paper">{text}</pre>
          <button className="btn btn-icon btn-sm absolute right-2 top-2 !bg-ink-2 !text-paper" aria-label="Copy" onClick={async () => { await copyText(text); toast('Copied') }}><Copy size={14} /></button>
        </div>
      )}
    </div>
  )
}

/** Microsoft sends the admin back here after sign-in. */
export function ExchangeCallback() {
  const { org } = useStore()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const once = useRef(false)
  useEffect(() => {
    if (once.current) return
    once.current = true
    const msErr = params.get('error_description') || params.get('error')
    if (msErr) return setError(msErr.split(/\r?\n/)[0])
    // Back from the admin-consent page: continue to the admin sign-in.
    if (params.get('admin_consent')) {
      if (params.get('admin_consent')?.toLowerCase() !== 'true') return setError('Admin approval was not granted.')
      api(org.id, 'authorize', { state: params.get('state') })
        .then(({ url }) => { if (url) location.href = url })
        .catch((e) => setError((e as Error).message))
      return
    }
    api(org.id, 'callback', { code: params.get('code'), state: params.get('state') })
      .then(() => navigate('/mail-routing', { replace: true }))
      .catch((e) => setError((e as Error).message))
  }, [org.id, params, navigate])
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      {error ? (
        <>
          <AlertTriangle className="mx-auto text-clay" />
          <h1 className="h-display mt-3 text-2xl">Sign-in didn’t complete</h1>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <Link to="/mail-routing" className="btn btn-ink mt-6">Back to mail routing</Link>
        </>
      ) : (
        <>
          <Loader2 className="mx-auto animate-spin text-clay" />
          <p className="mt-3 text-sm text-muted">Finishing Microsoft sign-in…</p>
        </>
      )}
    </div>
  )
}

