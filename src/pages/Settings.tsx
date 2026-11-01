import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Copy, Loader2, Mail, Trash2, UserPlus } from 'lucide-react'
import { useAuth } from '../auth'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { copyText, timeAgo } from '../lib/io'
import type { Role } from '../types'
import { Avatar, Field, Modal, PageHeader, useToast } from '../components/ui'
import { MicrosoftLogo } from './Auth'

type Member = { user_id: string; email: string; full_name: string; role: Role; joined_at: string }
type Invite = { id: string; email: string; role: 'admin' | 'member'; created_at: string }

const ROLE_HELP: Record<Role, string> = {
  owner: 'Full control, including the workspace itself',
  admin: 'Manage brand kit, people, campaigns and members',
  member: 'Create and edit signatures and people',
}

export default function Settings() {
  const { org, role } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const isAdmin = role !== 'member'
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([
      supabase.rpc('workspace_members', { org: org.id }),
      isAdmin ? supabase.from('invitations').select('id,email,role,created_at').eq('org_id', org.id).order('created_at') : Promise.resolve({ data: [], error: null }),
    ])
    if (m.error) toast(`Couldn't load members: ${m.error.message}`)
    setMembers((m.data as Member[]) ?? [])
    setInvites((i.data as Invite[]) ?? [])
  }, [org.id, isAdmin, toast])

  useEffect(() => { load() }, [load])

  const owners = members.filter((m) => m.role === 'owner').length
  const signupLink = `${location.origin}/signup`

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Settings" subtitle="Who can access this workspace, and your own account." />

      <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="h-display text-xl">Members</h2>
              <p className="text-sm text-muted">People who can sign in and manage {org.name}'s signatures.</p>
            </div>
            {isAdmin && <button className="btn btn-ink btn-sm" onClick={() => setInviteOpen(true)}><UserPlus size={14} /> Invite</button>}
          </div>
          <div className="divide-y divide-line">
            {members.map((m) => {
              const me = m.user_id === user?.id
              const lockedOwner = m.role === 'owner' && owners <= 1
              return (
                <div key={m.user_id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={m.full_name || m.email} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{m.full_name || m.email.split('@')[0]} {me && <span className="font-normal text-muted">(you)</span>}</div>
                    <div className="truncate text-xs text-muted">{m.email}</div>
                  </div>
                  {isAdmin && !me && !lockedOwner && (role === 'owner' || m.role !== 'owner') ? (
                    <select className="h-8 rounded-lg border border-line-2 bg-surface px-2 text-sm" value={m.role} onChange={async (e) => {
                      const { error } = await supabase.from('memberships').update({ role: e.target.value }).eq('org_id', org.id).eq('user_id', m.user_id)
                      if (error) toast(error.message); else { toast('Role updated'); load() }
                    }}>
                      {role === 'owner' && <option value="owner">Owner</option>}
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  ) : <span className="tag bg-paper-2 capitalize text-ink-3">{m.role}</span>}
                  {isAdmin && !me && !lockedOwner && (role === 'owner' || m.role !== 'owner') && (
                    <button className="btn btn-ghost btn-sm btn-icon" aria-label="Remove member" onClick={async () => {
                      const { error } = await supabase.from('memberships').delete().eq('org_id', org.id).eq('user_id', m.user_id)
                      if (error) toast(error.message); else { toast(`Removed ${m.email}`); load() }
                    }}><Trash2 size={14} /></button>
                  )}
                </div>
              )
            })}
            {!members.length && <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-muted" /></div>}
          </div>

          {isAdmin && invites.length > 0 && (
            <>
              <div className="border-y border-line bg-paper/50 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted">Pending invitations</div>
              <div className="divide-y divide-line">
                {invites.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="grid size-[34px] place-items-center rounded-full bg-paper-2 text-muted"><Mail size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{i.email}</div>
                      <div className="text-xs text-muted">{i.role} · invited {timeAgo(Date.parse(i.created_at))}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={async () => { await copyText(signupLink); toast('Sign-up link copied') }}><Copy size={13} /> Link</button>
                    <button className="btn btn-ghost btn-sm btn-icon" aria-label="Revoke invitation" onClick={async () => {
                      const { error } = await supabase.from('invitations').delete().eq('id', i.id)
                      if (error) toast(error.message); else load()
                    }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <div className="space-y-5">
          <AccountCard />
          <section className="card p-5">
            <h2 className="h-display text-xl">Roles</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              {(Object.keys(ROLE_HELP) as Role[]).map((r) => <div key={r}><dt className="font-semibold capitalize">{r}</dt><dd className="text-muted">{ROLE_HELP[r]}</dd></div>)}
            </dl>
          </section>
          {!(role === 'owner' && owners <= 1) && (
            <section className="card p-5">
              <h2 className="h-display text-xl">Leave workspace</h2>
              <p className="mt-1 text-sm text-muted">You'll lose access to {org.name} until someone invites you again.</p>
              <button className="btn btn-line btn-sm mt-4 text-[#b91c1c]" onClick={() => setLeaveOpen(true)}>Leave {org.name}</button>
            </section>
          )}
        </div>
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onDone={load} signupLink={signupLink} />
      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title={`Leave ${org.name}?`} width={440}
        footer={<><button className="btn btn-line" onClick={() => setLeaveOpen(false)}>Cancel</button><button className="btn bg-[#b91c1c] text-white hover:bg-[#991b1b]" onClick={async () => {
          const { error } = await supabase.from('memberships').delete().eq('org_id', org.id).eq('user_id', user!.id)
          if (error) toast(error.message); else location.assign('/onboarding')
        }}>Leave</button></>}>
        <p className="text-sm text-muted">Signatures you created stay with the workspace.</p>
      </Modal>
    </>
  )
}

function InviteModal({ open, onClose, onDone, signupLink }: { open: boolean; onClose: () => void; onDone: () => void; signupLink: string }) {
  const { org } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [busy, setBusy] = useState(false)
  const list = emails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^\S+@\S+\.\S+$/.test(e))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.from('invitations').upsert(list.map((email) => ({ org_id: org.id, email, role, invited_by: user!.id })), { onConflict: 'org_id,email' })
    setBusy(false)
    if (error) return toast(error.message)
    await copyText(signupLink)
    toast(`Invited ${list.length} · sign-up link copied to share`)
    setEmails('')
    onDone()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite colleagues" subtitle="They join this workspace automatically when they sign up or sign in with the invited email." width={520}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email addresses" hint="Separate several with commas or new lines">
          <textarea className="input" rows={3} autoFocus placeholder="sam@company.com, lee@company.com" value={emails} onChange={(e) => setEmails(e.target.value)} />
        </Field>
        <div>
          <span className="field-label">Role</span>
          <div className="seg">
            <button type="button" data-on={role === 'member'} onClick={() => setRole('member')}>Member</button>
            <button type="button" data-on={role === 'admin'} onClick={() => setRole('admin')}>Admin</button>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl border border-line bg-paper/50 px-3.5 py-3 text-xs leading-relaxed text-ink-3">
          <MicrosoftLogo size={14} /> Colleagues can use “Continue with Microsoft” with their work account — the invite matches on email address.
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-line" onClick={onClose}>Cancel</button>
          <button className="btn btn-ink" disabled={!list.length || busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : `Invite ${list.length || ''}`}</button>
        </div>
      </form>
    </Modal>
  )
}

function AccountCard() {
  const { user } = useAuth()
  const toast = useToast()
  const [name, setName] = useState((user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string) || '')
  const [pw, setPw] = useState('')
  const hasPassword = user?.identities?.some((i) => i.provider === 'email')
  const hasMs = user?.identities?.some((i) => i.provider === 'azure')

  return (
    <section className="card p-5">
      <h2 className="h-display text-xl">Your account</h2>
      <p className="mt-1 flex items-center gap-2 text-sm text-muted">{user?.email} {hasMs && <span className="tag bg-paper-2 text-ink-3"><MicrosoftLogo size={10} /> Microsoft</span>}</p>
      <form className="mt-4 flex gap-2" onSubmit={async (e) => {
        e.preventDefault()
        const { error } = await supabase.auth.updateUser({ data: { full_name: name } })
        toast(error ? error.message : 'Name updated')
      }}>
        <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-line shrink-0">Save</button>
      </form>
      <form className="mt-3 flex gap-2" onSubmit={async (e) => {
        e.preventDefault()
        if (pw.length < 8) return toast('Use at least 8 characters')
        const { error } = await supabase.auth.updateUser({ password: pw })
        setPw('')
        toast(error ? error.message : hasPassword ? 'Password changed' : 'Password set — you can now sign in with email too')
      }}>
        <input className="input" type="password" autoComplete="new-password" placeholder={hasPassword ? 'New password' : 'Set a password'} value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="btn btn-line shrink-0">{hasPassword ? 'Change' : 'Set'}</button>
      </form>
    </section>
  )
}
