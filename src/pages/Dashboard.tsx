import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Copy, LayoutGrid, Megaphone, MousePointerClick, PenLine, Upload, Users, Eye, TrendingUp } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { useStore } from '../store'
import { renderSignature } from '../lib/render'
import { series } from '../lib/analytics'
import { compact, copyRich, timeAgo } from '../lib/io'
import { templateById } from '../lib/templates'
import { Avatar, SigThumb, useToast } from '../components/ui'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  const { signatures, employees, campaigns } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const primary = signatures[0]
  const first = primary?.fields.fullName.split(' ')[0] ?? 'there'

  const imp = signatures.reduce((a, s) => a + s.stats.impressions, 0) + campaigns.reduce((a, c) => a + c.impressions, 0) / 4
  const clicks = signatures.reduce((a, s) => a + s.stats.clicks, 0) + campaigns.reduce((a, c) => a + c.clicks, 0) / 4
  const covered = employees.filter((e) => e.templateId && e.status === 'active').length
  const coverage = employees.length ? Math.round((covered / employees.length) * 100) : 0
  const data = series(14, imp / 2, clicks / 2)
  const live = campaigns.find((c) => c.active)

  const stats = [
    { label: 'Impressions · 30d', value: compact(imp), delta: '+18%', icon: Eye, spark: data.map((d) => ({ v: d.impressions })) },
    { label: 'Link clicks · 30d', value: compact(clicks), delta: '+24%', icon: MousePointerClick, spark: data.map((d) => ({ v: d.clicks })) },
    { label: 'Click-through', value: `${((clicks / Math.max(imp, 1)) * 100).toFixed(1)}%`, delta: '+0.6pt', icon: TrendingUp, spark: data.map((d) => ({ v: d.clicks / Math.max(d.impressions, 1) })) },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="animate-rise">
          <div className="eyebrow mb-2">{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1 className="h-display text-[38px] leading-[1.05] md:text-[46px]">{greeting()}, {first}.</h1>
          <p className="mt-2 text-[15px] text-muted">Your signatures were seen <strong className="font-semibold text-ink">{compact(imp)}</strong> times this month.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/team" className="btn btn-line"><Users size={16} /> Roll out to team</Link>
          <Link to="/templates" className="btn btn-ink"><PenLine size={16} /> New signature</Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        {/* hero signature */}
        {primary && (
          <section className="card relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-pine opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-pine" /></span>
                <span className="text-sm font-semibold">{primary.label}</span>
                <span className="text-xs text-muted">· {templateById(primary.templateId).name} · edited {timeAgo(primary.updatedAt)}</span>
              </div>
              <div className="flex gap-1">
                <button className="btn btn-ghost btn-sm" onClick={async () => { await copyRich(renderSignature(primary, { campaigns })); toast('Signature copied') }}><Copy size={14} /> Copy</button>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/editor/${primary.id}`)}>Edit <ArrowRight size={14} /></button>
              </div>
            </div>
            <div className="relative bg-white px-6 py-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,#ece5d8_1px,transparent_0)] [background-size:18px_18px]" />
              <div className="relative"><SigThumb html={renderSignature(primary, { campaigns })} /></div>
            </div>
          </section>
        )}

        {/* stats */}
        <div className="grid gap-5">
          {stats.map(({ label, value, delta, icon: Icon, spark }, i) => (
            <div key={label} className="card flex animate-rise items-center gap-4 p-5" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-paper-2 text-ink-3"><Icon size={19} /></div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-muted">{label}</div>
                <div className="flex items-baseline gap-2">
                  <span className="h-display text-[28px] leading-tight">{value}</span>
                  <span className="text-xs font-semibold text-pine">{delta}</span>
                </div>
              </div>
              <div className="h-12 w-28 shrink-0">
                <ResponsiveContainer>
                  <AreaChart data={spark}>
                    <defs><linearGradient id={`sp${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e2643b" stopOpacity={0.35} /><stop offset="1" stopColor="#e2643b" stopOpacity={0} /></linearGradient></defs>
                    <Area dataKey="v" stroke="#e2643b" strokeWidth={2} fill={`url(#sp${i})`} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* team coverage */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="h-display text-xl">Team coverage</h2>
            <Link to="/team" className="text-xs font-semibold text-clay-ink hover:underline">Manage</Link>
          </div>
          <div className="mt-4 flex items-center gap-5">
            <div className="relative size-24 shrink-0">
              <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#efe9dd" strokeWidth="3.4" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#0f766e" strokeWidth="3.4" strokeLinecap="round" strokeDasharray={`${coverage} 100`} pathLength={100} />
              </svg>
              <div className="absolute inset-0 grid place-items-center"><span className="h-display text-2xl">{coverage}%</span></div>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-pine" /> {covered} on brand</div>
              <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-butter" /> {employees.filter((e) => e.status === 'outdated').length} outdated</div>
              <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-line-2" /> {employees.length - covered} not set up</div>
            </div>
          </div>
          <div className="mt-5 flex -space-x-2">
            {employees.slice(0, 8).map((e) => <Avatar key={e.id} name={e.fullName} photo={e.photo} size={30} />)}
            {employees.length > 8 && <span className="grid size-[30px] place-items-center rounded-full bg-paper-2 text-[11px] font-semibold ring-2 ring-surface">+{employees.length - 8}</span>}
          </div>
        </section>

        {/* live campaign */}
        <section className="card flex flex-col p-5">
          <div className="flex items-center justify-between">
            <h2 className="h-display text-xl">Live campaign</h2>
            <Link to="/campaigns" className="text-xs font-semibold text-clay-ink hover:underline">All campaigns</Link>
          </div>
          {live ? (
            <>
              <div className="mt-4 rounded-xl p-4 text-white" style={{ background: live.style === 'dark' ? `linear-gradient(120deg,#0f172a,${live.from})` : `linear-gradient(120deg,${live.from},${live.to})` }}>
                <div className="text-[15px] font-bold leading-snug">{live.headline}</div>
                <div className="mt-1 text-xs text-white/80">{live.subline}</div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div><div className="h-display text-lg">{compact(live.impressions)}</div><div className="text-[11px] text-muted">views</div></div>
                <div><div className="h-display text-lg">{compact(live.clicks)}</div><div className="text-[11px] text-muted">clicks</div></div>
                <div><div className="h-display text-lg">{((live.clicks / Math.max(live.impressions, 1)) * 100).toFixed(1)}%</div><div className="text-[11px] text-muted">CTR</div></div>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">No banner running. Promote an event or offer in every email you send.</p>
          )}
        </section>

        {/* quick actions */}
        <section className="card p-5">
          <h2 className="h-display text-xl">Quick actions</h2>
          <div className="mt-3 divide-y divide-line">
            {[
              { to: '/templates', icon: LayoutGrid, t: 'Browse 16 templates', d: 'Animated, corporate, minimal…' },
              { to: '/team', icon: Upload, t: 'Bulk import from CSV', d: 'Generate a signature per person' },
              { to: '/campaigns', icon: Megaphone, t: 'Launch a banner', d: 'Schedule by department' },
              { to: '/brand', icon: ArrowUpRight, t: 'Update brand kit', d: 'Logo, colours and legal text' },
            ].map(({ to, icon: Icon, t, d }) => (
              <Link key={to} to={to} className="group flex items-center gap-3 py-3">
                <span className="grid size-9 place-items-center rounded-lg bg-clay-soft text-clay-ink transition group-hover:bg-clay group-hover:text-white"><Icon size={16} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{t}</span><span className="block text-xs text-muted">{d}</span></span>
                <ArrowRight size={15} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
