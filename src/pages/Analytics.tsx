import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, Users } from 'lucide-react'
import { useStore } from '../store'
import { templateById } from '../lib/templates'
import { Empty, PageHeader } from '../components/ui'

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-ink px-3 py-2 text-xs text-paper shadow-pop">
      <div className="mb-1 font-semibold">{label}</div>
      {payload.map((p) => <div key={p.name} className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}: <strong>{p.value}</strong></div>)}
    </div>
  )
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

export default function Insights() {
  const { employees, signatures, campaigns, brand } = useStore()
  const today = new Date().toISOString().slice(0, 10)

  const byDept = useMemo(() => {
    const m = new Map<string, { name: string; onBrand: number; missing: number }>()
    employees.forEach((e) => {
      const k = e.department || 'No department'
      const row = m.get(k) ?? { name: k, onBrand: 0, missing: 0 }
      if (e.templateId && e.status === 'active') row.onBrand++
      else row.missing++
      m.set(k, row)
    })
    return [...m.values()].sort((a, b) => b.onBrand + b.missing - (a.onBrand + a.missing))
  }, [employees])

  const byTemplate = useMemo(() => {
    const m = new Map<string, number>()
    employees.forEach((e) => { const t = e.templateId ?? brand.defaultTemplateId; m.set(t, (m.get(t) ?? 0) + 1) })
    signatures.forEach((s) => m.set(s.templateId, (m.get(s.templateId) ?? 0) + 1))
    return [...m.entries()].map(([id, n]) => ({ name: templateById(id).name, n })).sort((a, b) => b.n - a.n)
  }, [employees, signatures, brand.defaultTemplateId])

  const total = employees.length
  const completeness = [
    { label: 'Job title', n: employees.filter((e) => e.title).length },
    { label: 'Phone number', n: employees.filter((e) => e.phone).length },
    { label: 'Profile photo', n: employees.filter((e) => e.photo).length },
    { label: 'Department', n: employees.filter((e) => e.department).length },
  ]
  const sources = (['microsoft', 'csv', 'manual'] as const).map((k) => ({ k, label: { microsoft: 'Microsoft 365', csv: 'CSV import', manual: 'Added manually' }[k], n: employees.filter((e) => e.source === k).length }))
  const live = campaigns.filter((c) => c.active && c.start <= today && (!c.end || c.end >= today))
  const covered = employees.filter((e) => e.templateId && e.status === 'active').length

  if (!total && !signatures.length)
    return (
      <>
        <PageHeader eyebrow="Workspace" title="Insights" subtitle="See signature coverage, profile completeness and campaign reach across your company." />
        <Empty icon={<BarChart3 />} title="Nothing to report yet" body="Insights fill in as you add people and signatures." action={<Link to="/team" className="btn btn-ink"><Users size={15} /> Add your team</Link>} />
      </>
    )

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Insights" subtitle="Signature coverage, profile completeness and campaign reach across your company." />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['People', total],
          ['On-brand coverage', `${pct(covered, total)}%`],
          ['Departments', byDept.filter((d) => d.name !== 'No department').length],
          ['Live campaigns', live.length],
        ].map(([l, v]) => (
          <div key={l} className="card p-5">
            <div className="text-xs font-medium text-muted">{l}</div>
            <div className="h-display mt-1 text-3xl">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="h-display text-xl">Coverage by department</h2>
            <div className="flex gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-pine" /> On brand</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-line-2" /> Needs a signature</span>
            </div>
          </div>
          {byDept.length ? (
            <div style={{ height: Math.max(160, byDept.length * 38) }}>
              <ResponsiveContainer>
                <BarChart data={byDept} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#44403c' }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: '#efe9dd' }} />
                  <Bar name="On brand" dataKey="onBrand" stackId="a" fill="#0f766e" barSize={14} />
                  <Bar name="Needs a signature" dataKey="missing" stackId="a" fill="#d9d0c1" radius={[0, 6, 6, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-muted">Add people to see coverage.</p>}
        </section>

        <section className="card p-5">
          <h2 className="h-display mb-4 text-xl">Profile completeness</h2>
          <p className="-mt-2 mb-4 text-sm text-muted">Complete profiles make better signatures.</p>
          <div className="space-y-3.5">
            {completeness.map((c) => (
              <div key={c.label}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{c.label}</span><span className="text-muted">{c.n}/{total} · {pct(c.n, total)}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-clay" style={{ width: `${pct(c.n, total)}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="h-display mb-4 text-xl">Templates in use</h2>
          <div className="space-y-2.5">
            {byTemplate.map((t) => (
              <div key={t.name} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 font-medium">{t.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-ink" style={{ width: `${pct(t.n, byTemplate[0].n)}%` }} /></div>
                <span className="w-8 text-right tabular-nums text-muted">{t.n}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="h-display mb-4 text-xl">Where people came from</h2>
          <div className="space-y-2.5">
            {sources.map((s) => (
              <div key={s.k} className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-sm">
                <span className="font-medium">{s.label}</span>
                <span className="tabular-nums text-muted">{s.n}</span>
              </div>
            ))}
          </div>
          <h3 className="eyebrow mb-2 mt-6">Live campaign reach</h3>
          {live.length ? live.map((c) => {
            const reach = c.departments.length ? employees.filter((e) => c.departments.includes(e.department)).length : total
            return <div key={c.id} className="flex items-center justify-between py-1.5 text-sm"><span className="truncate font-medium">{c.name}</span><span className="text-muted">{reach} people</span></div>
          }) : <p className="text-sm text-muted">No campaigns running right now.</p>}
        </section>
      </div>
    </>
  )
}
