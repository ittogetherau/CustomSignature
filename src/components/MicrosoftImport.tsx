import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Copy, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth'
import { useStore } from '../store'
import { MS_LOGIN_SCOPES, supabase } from '../lib/supabase'
import { copyText } from '../lib/io'
import { Modal, useToast } from './ui'
import { MicrosoftLogo } from '../pages/Auth'

type Result = { total: number; added: number; updated: number; left: number; photos: number }
type Phase =
  | { k: 'working' }
  | { k: 'synced'; r: Result }
  | { k: 'consent'; url: string }
  | { k: 'link' }
  | { k: 'error'; msg: string }

const RETURN_TO = '/team?connect=microsoft'

/** Ask the server to connect/sync this workspace's Microsoft 365 directory. */
export async function requestMicrosoftSync(orgId: string) {
  const { data } = await supabase.auth.getSession()
  const res = await fetch('/api/microsoft/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify({ orgId }),
  })
  const body = await res.json().catch(() => ({ error: res.status === 404 ? 'Microsoft sync runs on the deployed site, not the local dev server.' : `Server error ${res.status}` }))
  if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`)
  return body as ({ status: 'synced' } & Result) | { status: 'consent_required'; consentUrl: string } | { status: 'link_required' }
}

/** Connect a Microsoft work account to the current login (or sign in with it), then come back here. */
export async function linkMicrosoftAccount(hasAzureIdentity: boolean) {
  const options = { scopes: MS_LOGIN_SCOPES, redirectTo: `${location.origin}${RETURN_TO}` }
  const { error } = hasAzureIdentity
    ? await supabase.auth.signInWithOAuth({ provider: 'azure', options })
    : await supabase.auth.linkIdentity({ provider: 'azure', options })
  return error
}

export default function MicrosoftConnect({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const store = useStore()
  const toast = useToast()
  const [phase, setPhase] = useState<Phase>({ k: 'working' })
  const hasAzure = Boolean(user?.identities?.some((i) => i.provider === 'azure'))

  const run = useCallback(async () => {
    setPhase({ k: 'working' })
    try {
      const r = await requestMicrosoftSync(store.org.id)
      if (r.status === 'synced') {
        await Promise.all([store.reload(), store.refreshOrg()])
        setPhase({ k: 'synced', r })
      } else if (r.status === 'consent_required') setPhase({ k: 'consent', url: r.consentUrl })
      else setPhase({ k: 'link' })
    } catch (e) {
      setPhase({ k: 'error', msg: (e as Error).message })
    }
  }, [store])

  useEffect(() => { if (open) run() }, [open, run])

  return (
    <Modal open={open} onClose={onClose} width={560} title="Microsoft 365" subtitle="Your directory syncs automatically every day once connected.">
      {phase.k === 'working' && (
        <div className="flex flex-col items-center gap-3 py-14 text-sm text-muted">
          <Loader2 className="animate-spin text-clay" />
          Syncing with Microsoft 365… this can take up to a minute for large teams.
        </div>
      )}

      {phase.k === 'synced' && (
        <div className="py-2 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-pine text-white"><Check strokeWidth={3} /></span>
          <h3 className="h-display mt-4 text-2xl">Directory connected</h3>
          <p className="mt-1 text-sm text-muted">{phase.r.total} people synced from Microsoft 365.</p>
          <div className="mt-5 grid grid-cols-4 divide-x divide-line rounded-xl border border-line">
            {[['New', phase.r.added], ['Updated', phase.r.updated], ['Left', phase.r.left], ['Photos', phase.r.photos]].map(([l, v]) => (
              <div key={l} className="py-3"><div className="h-display text-xl">{v}</div><div className="text-[11px] text-muted">{l}</div></div>
            ))}
          </div>
          <p className="mt-4 text-xs text-faint">New starters, role changes and leavers update automatically each night. Remaining photos fill in over the next syncs.</p>
          <button className="btn btn-ink mt-5 w-full" onClick={() => { toast('Microsoft 365 connected'); onClose() }}>Done</button>
        </div>
      )}

      {phase.k === 'consent' && (
        <div>
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-line bg-white"><MicrosoftLogo size={22} /></span>
            <div>
              <h3 className="h-display text-xl">One approval from your Microsoft 365 admin</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">Inkwell needs read-only access to your company directory. It never sends email or changes anything in Microsoft 365.</p>
            </div>
          </div>
          <a href={phase.url} className="btn btn-ink mt-6 h-11 w-full"><ShieldCheck size={16} /> I'm an admin — approve for my organisation</a>
          <div className="mt-5 rounded-xl border border-line bg-paper/50 p-4">
            <div className="text-sm font-semibold">Not an admin?</div>
            <p className="mt-0.5 text-sm text-muted">Send this link to your IT admin. Once they approve, come back and press “Check again”.</p>
            <div className="mt-3 flex gap-2">
              <button className="btn btn-line btn-sm" onClick={async () => { await copyText(phase.url); toast('Approval link copied') }}><Copy size={13} /> Copy link for IT admin</button>
              <button className="btn btn-ghost btn-sm" onClick={run}><RefreshCw size={13} /> Check again</button>
            </div>
          </div>
        </div>
      )}

      {phase.k === 'link' && (
        <div>
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-line bg-white"><MicrosoftLogo size={22} /></span>
            <div>
              <h3 className="h-display text-xl">Sign in with your Microsoft work account</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">We use it to find your organisation's directory. {hasAzure ? 'Personal Microsoft accounts don’t have a company directory.' : 'It’s added to your existing login — nothing else changes.'}</p>
            </div>
          </div>
          <button className="btn btn-ink mt-6 h-11 w-full" onClick={async () => { const e = await linkMicrosoftAccount(hasAzure); if (e) setPhase({ k: 'error', msg: e.message }) }}>
            <MicrosoftLogo /> Continue with Microsoft
          </button>
        </div>
      )}

      {phase.k === 'error' && (
        <div className="py-6 text-center">
          <AlertTriangle className="mx-auto text-clay" />
          <p className="mx-auto mt-3 max-w-sm text-sm text-ink-3">{phase.msg}</p>
          <button className="btn btn-line mt-5" onClick={run}><RefreshCw size={14} /> Try again</button>
        </div>
      )}
    </Modal>
  )
}
