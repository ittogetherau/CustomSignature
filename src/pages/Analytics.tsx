import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Info } from 'lucide-react'
import { useStore } from '../store'
import { CLIENTS, LINK_BREAKDOWN, series } from '../lib/analytics'
import { compact } from '../lib/io'
import { templateById } from '../lib/templates'
import { PageHeader } from '../components/ui'

const RANGES = { '7d': 7, '30d': 30, '90d': 90 } as const

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-ink px-3 py-2 text-xs text-paper shadow-pop">
      <div className="mb-1 font-semibold">{label}</div>
      {payload.map((p) => <div key={p.name} className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}: <strong>{p.value.toLocaleString()}</strong></div>)}
    </div>
  )
}

export default function Analytics() {
  const { signatures, campaigns, employees } = useStore()
  const [range, setRange] = useState<keyof typeof RANGES>('30d')
  const days = RANGES[range]
  const factor = days / 30

  const totalImp = (signatures.reduce((a, s) => a + s.stats.impressions, 0) + employees.length * 1400) * factor
  const totalClk = (signatures.reduce((a, s) => a + s.stats.clicks, 0) + employees.length * 70) * factor
  const data = useMemo(() => series(days, totalImp, totalClk, days), [days, totalImp, totalClk])

  const byDept = useMemo(() => {
    const m = new Map<string, number>()
    employees.forEach((e, i) => m.set(e.department || 'Other', (m.get(e.department || 'Other') ?? 0) + Math.round((900 + ((i * 397) % 800)) * factor)))
    return [...m.entries()].map(([name, clicks]) => ({ name, clicks: Math.round(clicks / 12) })).sort((a, b) => b.clicks - a.clicks)
  }, [employees, factor])

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Analytics"
        subtitle="Impressions, clicks and engagement across every signature and campaign."
        actions={<div className="seg">{(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => <button key={r} data-on={range === r} onClick={() => setRange(r)}>Last {r}</button>)}</div>}
      />

      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-butter bg-butter-soft px-4 py-3 text-sm text-[#6b4e0e]">
        <Info size={16} className="mt-0.5 shrink-0" />
        Demo data. Real tracking needs hosted images and redirect links on a server — this local build simulates the numbers so you can see the reports.
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Impressions', compact(totalImp), '+18.2%'],
          ['Link clicks', compact(totalClk), '+24.6%'],
          ['Click-through rate', `${((totalClk / Math.max(totalImp, 1)) * 100).toFixed(2)}%`, '+0.6pt'],
          ['Banner clicks', compact(campaigns.reduce((a, c) => a + c.clicks, 0) * factor), '+31.0%'],
        ].map(([l, v, d]) => (
          <div key={l} className="card p-5">
            <div className="text-xs font-medium text-muted">{l}</div>
            <div className="mt-1 flex items-baseline gap-2"><span className="h-display text-3xl">{v}</span><span className="text-xs font-semibold text-pine">{d}</span></div>
          </div>
        ))}
      </div>

      <section className="card mb-5 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="h-display text-xl">Engagement over time</h2>
          <div className="flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ink" /> Impressions</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-clay" /> Clicks ×10</span>
          </div>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer>
            <AreaChart data={data.map((d) => ({ ...d, clicks10: d.clicks * 10 }))} margin={{ left: -12, right: 8 }}>
              <defs>
                <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1c1917" stopOpacity={0.16} /><stop offset="1" stopColor="#1c1917" stopOpacity={0} /></linearGradient>
                <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e2643b" stopOpacity={0.3} /><stop offset="1" stopColor="#e2643b" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid stroke="#e7e0d4" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} tickFormatter={compact} />
              <Tooltip content={<ChartTip />} />
              <Area name="Impressions" dataKey="impressions" stroke="#1c1917" strokeWidth={2} fill="url(#gi)" />
              <Area name="Clicks ×10" dataKey="clicks10" stroke="#e2643b" strokeWidth={2} fill="url(#gc)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="h-display mb-4 text-xl">Top links</h2>
          <div className="space-y-3">
            {LINK_BREAKDOWN.map((l) => (
              <div key={l.name}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{l.name}</span><span className="text-muted">{compact(totalClk * l.share)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-clay" style={{ width: `${l.share * 100 / 0.31}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="h-display mb-2 text-xl">Clicks by department</h2>
          <div className="h-[230px]">
            <ResponsiveContainer>
              <BarChart data={byDept} layout="vertical" margin={{ left: 8, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#44403c' }} tickLine={false} axisLine={false} width={86} />
                <Tooltip content={<ChartTip />} cursor={{ fill: '#efe9dd' }} />
                <Bar name="Clicks" dataKey="clicks" fill="#0f766e" radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="h-display mb-4 text-xl">Opened in</h2>
          <div className="mb-5 flex h-3 overflow-hidden rounded-full">
            {CLIENTS.map((c, i) => <div key={c.name} style={{ width: `${c.share * 100}%`, background: ['#1c1917', '#e2643b', '#0f766e', '#d9d0c1'][i] }} />)}
          </div>
          <div className="space-y-2.5">
            {CLIENTS.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2.5 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: ['#1c1917', '#e2643b', '#0f766e', '#d9d0c1'][i] }} />
                <span className="flex-1 font-medium">{c.name}</span>
                <span className="text-muted">{Math.round(c.share * 100)}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card mt-5 overflow-hidden">
        <div className="border-b border-line px-5 py-4"><h2 className="h-display text-xl">By signature</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Signature</th><th className="py-2.5 font-medium">Template</th><th className="py-2.5 text-right font-medium">Impressions</th><th className="py-2.5 text-right font-medium">Clicks</th><th className="px-5 py-2.5 text-right font-medium">CTR</th></tr></thead>
            <tbody>
              {signatures.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-semibold">{s.label}</td>
                  <td className="py-3 text-muted">{templateById(s.templateId).name}</td>
                  <td className="py-3 text-right tabular-nums">{Math.round(s.stats.impressions * factor).toLocaleString()}</td>
                  <td className="py-3 text-right tabular-nums">{Math.round(s.stats.clicks * factor).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{s.stats.impressions ? ((s.stats.clicks / s.stats.impressions) * 100).toFixed(1) : '0.0'}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
