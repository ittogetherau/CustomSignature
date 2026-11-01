import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Copy, LayoutGrid, Megaphone, Palette, PenLine, Upload, Users, Megaphone as Mega, UserCheck } from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../store'
import { useAuth } from '../auth'
import { renderSignature } from '../lib/render'
import { copyRich, timeAgo } from '../lib/io'
import { TEMPLATES, templateById } from '../lib/templates'
import { Avatar, SigThumb, useToast } from '../components/ui'
import { MicrosoftLogo } from './Auth'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  const { signatures, employees, campaigns, brand, org, loading } = useStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const primary = signatures[0]
  const name = (user?.user_metadata?.full_name as string | undefined) || (user?.user_metadata?.name as string | undefined) || ''
  const first = name.split(' ')[0]

  const today = new Date().toISOString().slice(0, 10)
  const live = campaigns.filter((c) => c.active && c.start <= today && (!c.end || c.end >= today))
  const covered = employees.filter((e) => e.templateId && e.status === 'active').length
  const coverage = employees.length ? Math.round((covered / employees.length) * 100) : 0

  const steps = [
    { done: Boolean(brand.logo), label: 'Add your logo & brand colours', to: '/brand', icon: Palette },
    { done: signatures.length > 0, label: 'Design your first signature', to: '/templates', icon: PenLine },
    { done: employees.length > 0, label: 'Bring in your team', to: '/team', icon: Users, ms: true },
    { done: campaigns.length > 0, label: 'Launch a banner campaign', to: '/campaigns', icon: Megaphone },
  ]
  const doneCount = steps.filter((s) => s.done).length

  const stats = [
    { label: 'Signatures', value: signatures.length, icon: PenLine, to: '/signatures' },
    { label: 'People', value: employees.length, icon: Users, to: '/team' },
    { label: 'Team coverage', value: `${coverage}%`, icon: UserCheck, to: '/team' },
    { label: 'Live campaigns', value: live.length, icon: Mega, to: '/campaigns' },
  ]

  if (loading) return <div className="space-y-5">{[0, 1, 2].map((k) => <div key={k} className="card h-32 animate-pulse bg-paper-2/60" />)}</div>

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="animate-rise">
          <div className="eyebrow mb-2">{org.name}</div>
          <h1 className="h-display text-[38px] leading-[1.05] md:text-[46px]">{greeting()}{first ? `, ${first}` : ''}.</h1>
          <p className="mt-2 text-[15px] text-muted">{doneCount < steps.length ? "Let's get your company's signatures set up." : 'Your workspace at a glance.'}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/team" className="btn btn-line"><Users size={16} /> Roll out to team</Link>
          <Link to="/templates" className="btn btn-ink"><PenLine size={16} /> New signature</Link>
        </div>
      </div>

      {doneCount < steps.length && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="h-display text-xl">Getting started</h2>
              <p className="text-sm text-muted">{doneCount} of {steps.length} done — about five minutes in total.</p>
            </div>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-pine transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
          </div>
          <div className="grid divide-y divide-line md:grid-cols-4 md:divide-x md:divide-y-0">
            {steps.map(({ done, label, to, icon: Icon, ms }, k) => (
              <Link key={label} to={to} className={clsx('group flex items-start gap-3 p-5 transition', done ? 'bg-pine-soft/30' : 'hover:bg-paper/60')}>
                <span className={clsx('grid size-9 shrink-0 place-items-center rounded-full', done ? 'bg-pine text-white' : 'bg-paper-2 text-ink-3 group-hover:bg-clay group-hover:text-white')}>
                  {done ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
                </span>
                <span className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Step {k + 1}</span>
                  <span className={clsx('block text-sm font-semibold', done && 'text-muted line-through decoration-1')}>{label}</span>
                  {ms && !done && <span className="mt-1 flex items-center gap-1.5 text-xs text-muted"><MicrosoftLogo size={11} /> Microsoft 365 or CSV</span>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, to }, i) => (
          <Link key={label} to={to} className="card flex animate-rise items-center gap-4 p-5 transition hover:shadow-lift" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-paper-2 text-ink-3"><Icon size={19} /></div>
            <div>
              <div className="text-xs font-medium text-muted">{label}</div>
              <div className="h-display text-[28px] leading-tight">{value}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        {primary ? (
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div className="min-w-0">
                <span className="text-sm font-semibold">{primary.label}</span>
                <span className="text-xs text-muted"> · {templateById(primary.templateId).name} · edited {timeAgo(primary.updatedAt)}</span>
              </div>
              <div className="flex shrink-0 gap-1">
                <button className="btn btn-ghost btn-sm" onClick={async () => { await copyRich(renderSignature(primary, { campaigns })); toast('Signature copied') }}><Copy size={14} /> Copy</button>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/editor/${primary.id}`)}>Edit <ArrowRight size={14} /></button>
              </div>
            </div>
            <div className="relative bg-white px-6 py-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,#ece5d8_1px,transparent_0)] [background-size:18px_18px]" />
              <div className="relative"><SigThumb html={renderSignature(primary, { campaigns })} /></div>
            </div>
          </section>
        ) : (
          <section className="card flex flex-col items-center justify-center px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-clay-soft text-clay-ink"><PenLine /></span>
            <h2 className="h-display mt-4 text-2xl">Design your first signature</h2>
            <p className="mt-1 max-w-sm text-sm text-muted">Pick from {TEMPLATES.length} templates — your brand kit fills in the company details for you.</p>
            <Link to="/templates" className="btn btn-ink mt-5">Browse templates <ArrowRight size={15} /></Link>
          </section>
        )}

        <div className="grid gap-5">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="h-display text-xl">Team</h2>
              <Link to="/team" className="text-xs font-semibold text-clay-ink hover:underline">Manage</Link>
            </div>
            {employees.length ? (
              <>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-pine" style={{ width: `${coverage}%` }} /></div>
                <p className="mt-2 text-sm text-muted">{covered} of {employees.length} people have an on-brand signature.</p>
                <div className="mt-4 flex -space-x-2">
                  {employees.slice(0, 8).map((e) => <Avatar key={e.id} name={e.fullName} photo={e.photo} size={30} />)}
                  {employees.length > 8 && <span className="grid size-[30px] place-items-center rounded-full bg-paper-2 text-[11px] font-semibold ring-2 ring-surface">+{employees.length - 8}</span>}
                </div>
              </>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-muted">Import your people to generate everyone's signature at once.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/team?connect=microsoft" className="btn btn-line btn-sm"><MicrosoftLogo size={13} /> Connect Microsoft 365</Link>
                  <Link to="/team?import=csv" className="btn btn-ghost btn-sm"><Upload size={14} /> CSV</Link>
                </div>
              </div>
            )}
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="h-display text-xl">Campaigns</h2>
              <Link to="/campaigns" className="text-xs font-semibold text-clay-ink hover:underline">All campaigns</Link>
            </div>
            {live[0] ? (
              <div className="mt-4 rounded-xl p-4 text-white" style={{ background: live[0].style === 'dark' ? `linear-gradient(120deg,#0f172a,${live[0].from})` : `linear-gradient(120deg,${live[0].from},${live[0].to})` }}>
                <div className="text-[15px] font-bold leading-snug">{live[0].headline}</div>
                <div className="mt-1 text-xs text-white/80">{live[0].subline}</div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">No banner running. Promote an event or offer in every email your team sends.</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="h-display text-xl">Quick actions</h2>
            <div className="mt-2 divide-y divide-line">
              {[
                { to: '/templates', icon: LayoutGrid, t: 'Browse templates' },
                { to: '/brand', icon: Palette, t: 'Update brand kit' },
              ].map(({ to, icon: Icon, t }) => (
                <Link key={to} to={to} className="group flex items-center gap-3 py-2.5">
                  <span className="grid size-8 place-items-center rounded-lg bg-clay-soft text-clay-ink transition group-hover:bg-clay group-hover:text-white"><Icon size={15} /></span>
                  <span className="flex-1 text-sm font-semibold">{t}</span>
                  <ArrowRight size={15} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
