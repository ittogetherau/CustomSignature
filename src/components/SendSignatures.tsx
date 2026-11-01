import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Loader2, Send, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { exportDocument, renderSignature } from '../lib/render'
import { MS_MAIL_SCOPES, MailAuthNeeded, buildSignatureEmail, sendViaGraph } from '../lib/signatureEmail'
import type { Employee, Signature } from '../types'
import { Avatar, Field, Modal, useToast } from './ui'
import { MicrosoftLogo } from '../pages/Auth'

const PENDING_KEY = 'inkwell.pendingSend'

export interface PendingSend { ids: string[]; subject: string; note: string }

export function takePendingSend(): PendingSend | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    sessionStorage.removeItem(PENDING_KEY)
    return raw ? (JSON.parse(raw) as PendingSend) : null
  } catch {
    return null
  }
}

type Phase = 'compose' | 'sending' | 'done'

export default function SendSignatures({ open, onClose, people, sigFor, resume }: {
  open: boolean
  onClose: () => void
  people: Employee[]
  sigFor: (e: Employee) => Signature
  /** Restored after the Microsoft permission round-trip: send immediately. */
  resume?: PendingSend | null
}) {
  const { user } = useAuth()
  const { org, brand, campaigns, markSent } = useStore()
  const toast = useToast()
  const senderName = (user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string) || user?.email || 'Your team'
  const [subject, setSubject] = useState(resume?.subject ?? `Your new ${brand.company || org.name} email signature`)
  const [note, setNote] = useState(resume?.note ?? '')
  const [phase, setPhase] = useState<Phase>('compose')
  const [done, setDone] = useState(0)
  const [failed, setFailed] = useState<{ name: string; reason: string }[]>([])
  const [needsAuth, setNeedsAuth] = useState(false)
  const started = useRef(false)
  const hasAzure = Boolean(user?.identities?.some((i) => i.provider === 'azure'))

  const first = people[0]
  const preview = useMemo(() => first ? buildSignatureEmail({
    to: first.email, name: first.fullName, note, senderName, company: brand.company || org.name,
    signatureHtml: renderSignature(sigFor(first), { campaigns, still: true }), attachmentHtml: '',
  }) : '', [first, note, senderName, brand.company, org.name, sigFor, campaigns])

  const connect = async () => {
    // Remember what we were doing; Microsoft redirects back to /team?send=resume.
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ids: people.map((p) => p.id), subject, note } satisfies PendingSend))
    const options = { scopes: MS_MAIL_SCOPES, redirectTo: `${location.origin}/team?send=resume` }
    const { error } = hasAzure
      ? await supabase.auth.signInWithOAuth({ provider: 'azure', options })
      : await supabase.auth.linkIdentity({ provider: 'azure', options })
    if (error) toast(error.message)
  }

  const send = async () => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.provider_token
    if (!token) { setNeedsAuth(true); return }
    setPhase('sending'); setDone(0); setFailed([])
    const ok: string[] = []
    const bad: { name: string; reason: string }[] = []
    for (const p of people) {
      const sig = sigFor(p)
      try {
        await sendViaGraph(token, {
          to: p.email, name: p.fullName, subject, note, senderName, company: brand.company || org.name,
          signatureHtml: renderSignature(sig, { campaigns }),
          attachmentHtml: exportDocument(sig, { campaigns }),
        })
        ok.push(p.id)
      } catch (e) {
        if (e instanceof MailAuthNeeded && ok.length === 0) { setPhase('compose'); setNeedsAuth(true); return }
        bad.push({ name: p.fullName, reason: e instanceof MailAuthNeeded ? 'Microsoft permission expired' : (e as Error).message })
      }
      setDone((n) => n + 1)
    }
    if (ok.length) markSent(ok)
    setFailed(bad)
    setPhase('done')
    toast(`Sent ${ok.length} signature${ok.length === 1 ? '' : 's'}${bad.length ? ` · ${bad.length} failed` : ''}`)
  }

  useEffect(() => {
    if (open && resume && !started.current) { started.current = true; send() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resume])

  return (
    <Modal open={open} onClose={phase === 'sending' ? () => {} : onClose} width={760}
      title={`Send signature${people.length === 1 ? '' : 's'} by email`}
      subtitle={`Each person gets their own signature and install steps, sent from you (${user?.email}).`}
      footer={phase === 'compose' ? (
        <>
          <button className="btn btn-line" onClick={onClose}>Cancel</button>
          <button className="btn btn-clay" disabled={!people.length} onClick={send}><Send size={15} /> Send {people.length} email{people.length === 1 ? '' : 's'}</button>
        </>
      ) : phase === 'done' ? <button className="btn btn-ink" onClick={onClose}>Done</button> : undefined}>

      {phase === 'compose' && (
        <div className="grid gap-5 md:grid-cols-[1fr_1.15fr]">
          <div className="space-y-4">
            {needsAuth && (
              <div className="rounded-xl border border-line bg-paper/60 p-4">
                <div className="flex items-start gap-2.5 text-sm"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-pine" /><span>Allow Inkwell to send these emails <strong>as you</strong> from Microsoft 365. Microsoft asks once; they’ll appear in your Sent Items.</span></div>
                <button className="btn btn-ink mt-3 w-full" onClick={connect}><MicrosoftLogo size={15} /> Continue with Microsoft</button>
              </div>
            )}
            <div>
              <span className="field-label">To · {people.length} {people.length === 1 ? 'person' : 'people'}</span>
              <div className="scroll-thin max-h-36 space-y-1.5 overflow-y-auto rounded-xl border border-line p-2">
                {people.map((p) => (
                  <div key={p.id} className="flex items-center gap-2.5 text-sm"><Avatar name={p.fullName} photo={p.photo} size={24} /><span className="truncate font-medium">{p.fullName}</span><span className="truncate text-xs text-muted">{p.email}</span></div>
                ))}
              </div>
            </div>
            <Field label="Subject"><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
            <Field label="Personal note (optional)" hint="Replaces the default intro line"><textarea className="input" rows={3} placeholder="Hi team — we've refreshed our email signatures…" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
          <div>
            <span className="field-label">Preview · {first?.fullName}</span>
            <div className="scroll-thin max-h-[420px] overflow-auto rounded-xl border border-line bg-white p-4 text-[13px]" dangerouslySetInnerHTML={{ __html: preview }} />
          </div>
        </div>
      )}

      {phase === 'sending' && (
        <div className="py-12 text-center">
          <Loader2 className="mx-auto animate-spin text-clay" />
          <p className="mt-3 text-sm font-semibold">Sending {Math.min(done + 1, people.length)} of {people.length}…</p>
          <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-pine transition-all" style={{ width: `${(done / Math.max(people.length, 1)) * 100}%` }} /></div>
        </div>
      )}

      {phase === 'done' && (
        <div className="py-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-pine text-white"><Check strokeWidth={3} /></span>
          <h3 className="h-display mt-4 text-2xl">{people.length - failed.length} sent</h3>
          <p className="mt-1 text-sm text-muted">From {user?.email}. Copies are in your Outlook Sent Items.</p>
          {failed.length > 0 && (
            <div className="mx-auto mt-5 max-w-md rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3 text-left text-sm text-[#991b1b]">
              <div className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle size={14} /> {failed.length} couldn’t be sent</div>
              {failed.map((f) => <div key={f.name}>{f.name} — {f.reason}</div>)}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
