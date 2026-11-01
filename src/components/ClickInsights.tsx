import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, Bot, Globe2, Loader2, Monitor, MousePointerClick, Smartphone, Tablet, UserRound } from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/io'
import { Avatar, Modal } from './ui'

interface Click {
  id: number
  person_type: 'sig' | 'emp'
  person_id: string
  kind: string
  url: string
  country: string | null
  region: string | null
  city: string | null
  device: string | null
  client: string | null
  is_bot: boolean
  created_at: string
}

const RANGES = { '7d': 7, '30d': 30, '90d': 90 } as const
const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null
const countryName = (c: string | null) => (c ? (regionNames?.of(c.toUpperCase()) ?? c) : 'Unknown')
const flag = (c: string | null) => (c && /^[a-z]{2}$/i.test(c) ? String.fromCodePoint(...[...c.toUpperCase()].map((ch) => 0x1f1a5 + ch.charCodeAt(0))) : '🌐')
const place = (c: Click) => [c.city, c.region, countryName(c.country)].filter(Boolean).join(', ')

function count<T>(rows: T[], key: (r: T) => string | null | undefined) {
  const m = new Map<string, number>()
  rows.forEach((r) => { const k = key(r) || 'Unknown'; m.set(k, (m.get(k) ?? 0) + 1) })
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

function daily(rows: Click[], days: number) {
  const out = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86_400_000)
    return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), clicks: 0 }
  })
  const idx = new Map(out.map((d, i) => [d.key, i]))
  rows.forEach((r) => { const i = idx.get(r.created_at.slice(0, 10)); if (i !== undefined) out[i].clicks++ })
  return out
}

function Bars({ rows, total, render }: { rows: [string, number][]; total: number; render?: (k: string) => React.ReactNode }) {
  if (!rows.length) return <p className="text-sm text-muted">No clicks yet.</p>
  return (
    <div className="space-y-2.5">
      {rows.slice(0, 8).map(([k, n]) => (
        <div key={k}>
          <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate font-medium">{render ? render(k) : k}</span><span className="shrink-0 tabular-nums text-muted">{n} · {Math.round((n / Math.max(total, 1)) * 100)}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-clay" style={{ width: `${(n / rows[0][1]) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

const DeviceIcon = ({ d }: { d: string }) => d === 'mobile' ? <Smartphone size={14} /> : d === 'tablet' ? <Tablet size={14} /> : <Monitor size={14} />

function Breakdown({ rows, days }: { rows: Click[]; days: number }) {
  const series = useMemo(() => daily(rows, days), [rows, days])
  const countries = count(rows, (r) => r.country)
  const places = count(rows, (r) => [r.city, r.region, r.country].filter(Boolean).join('|') || null)
  return (
    <>
      <section className="card mb-5 p-5">
        <h3 className="h-display mb-3 text-lg">Clicks per day</h3>
        <div className="h-[200px]">
          <ResponsiveContainer>
            <BarChart data={series} margin={{ left: -18, right: 6 }}>
              <CartesianGrid stroke="#e7e0d4" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: '#efe9dd' }} contentStyle={{ borderRadius: 12, border: '1px solid #e7e0d4', fontSize: 12 }} />
              <Bar dataKey="clicks" name="Clicks" fill="#e2643b" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5"><h3 className="h-display mb-4 text-lg">Links clicked</h3><Bars rows={count(rows, (r) => r.kind)} total={rows.length} /></section>
        <section className="card p-5"><h3 className="h-display mb-4 text-lg">Countries</h3><Bars rows={countries} total={rows.length} render={(k) => <>{flag(k === 'Unknown' ? null : k)} {countryName(k === 'Unknown' ? null : k)}</>} /></section>
        <section className="card p-5">
          <h3 className="h-display mb-4 text-lg">Cities & regions</h3>
          <Bars rows={places} total={rows.length} render={(k) => { const [city, region, country] = k.split('|'); return <>{flag(country ?? null)} {[city, region, country ? countryName(country) : ''].filter(Boolean).join(', ') || 'Unknown'}</> }} />
        </section>
        <section className="card p-5">
          <h3 className="h-display mb-4 text-lg">Devices & mail apps</h3>
          <div className="mb-5 grid grid-cols-3 gap-2">
            {(['desktop', 'mobile', 'tablet'] as const).map((d) => {
              const n = rows.filter((r) => r.device === d).length
              return <div key={d} className="rounded-xl border border-line p-3 text-center"><div className="flex justify-center text-muted"><DeviceIcon d={d} /></div><div className="h-display mt-1 text-xl">{n}</div><div className="text-[11px] capitalize text-muted">{d}</div></div>
            })}
          </div>
          <Bars rows={count(rows, (r) => r.client)} total={rows.length} />
        </section>
      </div>
    </>
  )
}

export default function ClickInsights() {
  const { org, role, employees, signatures, brand } = useStore()
  const [params, setParams] = useSearchParams()
  const [range, setRange] = useState<keyof typeof RANGES>('30d')
  const [rows, setRows] = useState<Click[] | null>(null)
  const [error, setError] = useState('')
  const [showBots, setShowBots] = useState(false)
  const personParam = params.get('person')
  const days = RANGES[range]

  useEffect(() => {
    let live = true
    setRows(null)
    const since = new Date(Date.now() - days * 86_400_000).toISOString()
    supabase.from('clicks').select('id,person_type,person_id,kind,url,country,region,city,device,client,is_bot,created_at')
      .eq('org_id', org.id).gte('created_at', since).order('created_at', { ascending: false }).limit(10000)
      .then(({ data, error: err }) => {
        if (!live) return
        if (err) { setError(err.message); setRows([]) } else setRows((data as Click[]) ?? [])
      })
    return () => { live = false }
  }, [org.id, days])

  const people = useMemo(() => {
    const m = new Map<string, { id: string; name: string; sub: string; photo: string }>()
    employees.forEach((e) => m.set(e.id, { id: e.id, name: e.fullName, sub: [e.title, e.department].filter(Boolean).join(' · '), photo: e.photo }))
    signatures.forEach((s) => m.set(s.id, { id: s.id, name: s.fields.fullName || s.label, sub: `Signature · ${s.label}`, photo: s.fields.photo }))
    return m
  }, [employees, signatures])

  const all = rows ?? []
  const human = all.filter((r) => !r.is_bot)
  const visible = showBots ? all : human
  const bots = all.length - human.length

  const byPerson = useMemo(() => {
    const m = new Map<string, Click[]>()
    visible.forEach((r) => m.set(r.person_id, [...(m.get(r.person_id) ?? []), r]))
    return [...m.entries()].map(([id, list]) => ({ id, list, who: people.get(id) })).sort((a, b) => b.list.length - a.list.length)
  }, [visible, people])

  const person = personParam ? { who: people.get(personParam), list: visible.filter((r) => r.person_id === personParam) } : null
  const openPerson = (id: string | null) => { if (id) params.set('person', id); else params.delete('person'); setParams(params, { replace: true }) }
  const topCountry = count(visible, (r) => r.country)[0]

  return (
    <section className="mb-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="h-display text-2xl">Link clicks</h2>
          <p className="text-sm text-muted">{role === 'member' ? 'Clicks on signatures you own.' : 'Every tracked click across your workspace.'} Location is approximate; IP addresses are never stored.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {bots > 0 && <button className="chip" data-on={showBots} onClick={() => setShowBots(!showBots)}><Bot size={13} /> {showBots ? 'Hide' : 'Show'} {bots} scanner click{bots === 1 ? '' : 's'}</button>}
          <div className="seg">{(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => <button key={r} data-on={range === r} onClick={() => setRange(r)}>Last {r}</button>)}</div>
        </div>
      </div>

      {brand.trackClicks === false && <div className="mb-5 rounded-xl border border-butter bg-butter-soft px-4 py-3 text-sm text-[#6b4e0e]">Click tracking is turned off for this workspace. <Link to="/brand" className="font-semibold underline">Turn it on in Brand kit</Link>.</div>}
      {error && <div className="mb-5 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">Couldn’t load clicks: {error}</div>}

      {rows === null ? (
        <div className="card flex items-center justify-center gap-3 py-16 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> Loading clicks…</div>
      ) : visible.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <MousePointerClick className="mx-auto text-clay" />
          <h3 className="h-display mt-3 text-xl">No clicks in this period yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">Links are tracked in signatures copied, downloaded or emailed from Inkwell. Once people use their new signatures, clicks show up here within seconds.</p>
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Clicks', visible.length, `${days}-day total`],
              ['People with clicks', byPerson.length, `of ${people.size} signatures`],
              ['Top link', count(visible, (r) => r.kind)[0]?.[0] ?? '—', `${count(visible, (r) => r.kind)[0]?.[1] ?? 0} clicks`],
              ['Top country', topCountry ? `${flag(topCountry[0] === 'Unknown' ? null : topCountry[0])} ${countryName(topCountry[0] === 'Unknown' ? null : topCountry[0])}` : '—', `${topCountry?.[1] ?? 0} clicks`],
            ].map(([l, v, s]) => (
              <div key={l as string} className="card p-5"><div className="text-xs font-medium text-muted">{l}</div><div className="h-display mt-1 truncate text-2xl">{v}</div><div className="text-xs text-faint">{s}</div></div>
            ))}
          </div>

          <Breakdown rows={visible} days={days} />

          <section className="card mt-5 overflow-hidden">
            <div className="border-b border-line px-5 py-4"><h3 className="h-display text-lg">By person</h3><p className="text-xs text-muted">Select someone to see their individual activity.</p></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Person</th><th className="py-2.5 text-right font-medium">Clicks</th><th className="py-2.5 pl-6 font-medium">Top link</th><th className="py-2.5 font-medium">Top location</th><th className="px-5 py-2.5 font-medium">Last click</th></tr></thead>
                <tbody>
                  {byPerson.map(({ id, list, who }) => (
                    <tr key={id} className="cursor-pointer border-b border-line transition last:border-0 hover:bg-paper/60" onClick={() => openPerson(id)}>
                      <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={who?.name ?? '?'} photo={who?.photo} size={30} /><div className="min-w-0"><div className="truncate font-semibold">{who?.name ?? 'Removed person'}</div><div className="truncate text-xs text-muted">{who?.sub}</div></div></div></td>
                      <td className="py-3 text-right font-semibold tabular-nums">{list.length}</td>
                      <td className="py-3 pl-6 text-muted">{count(list, (r) => r.kind)[0]?.[0]}</td>
                      <td className="py-3 text-muted">{(() => { const c = count(list, (r) => r.country)[0]?.[0]; return c ? `${flag(c === 'Unknown' ? null : c)} ${countryName(c === 'Unknown' ? null : c)}` : '—' })()}</td>
                      <td className="px-5 py-3 text-xs text-muted">{timeAgo(Date.parse(list[0].created_at))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <Modal open={!!person} onClose={() => openPerson(null)} width={920} title={person?.who?.name ?? 'Person'} subtitle={person?.who?.sub}>
        {person && (
          <div>
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-line p-4"><div className="text-xs text-muted">Clicks · {days}d</div><div className="h-display text-2xl">{person.list.length}</div></div>
              <div className="rounded-xl border border-line p-4"><div className="text-xs text-muted">Countries</div><div className="h-display text-2xl">{new Set(person.list.map((r) => r.country)).size}</div></div>
              <div className="rounded-xl border border-line p-4"><div className="text-xs text-muted">Last click</div><div className="h-display text-2xl">{person.list[0] ? timeAgo(Date.parse(person.list[0].created_at)) : '—'}</div></div>
            </div>
            {person.list.length ? (
              <>
                <Breakdown rows={person.list} days={days} />
                <section className="card mt-5 overflow-hidden">
                  <div className="border-b border-line px-5 py-3"><h3 className="h-display text-lg">Recent clicks</h3></div>
                  <div className="scroll-thin max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {person.list.slice(0, 200).map((r) => (
                          <tr key={r.id} className="border-b border-line last:border-0">
                            <td className="whitespace-nowrap px-5 py-2.5 text-xs text-muted">{new Date(r.created_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                            <td className="py-2.5 font-medium">{r.kind}{r.is_bot && <span className="tag ml-2 bg-paper-2 text-muted">scanner</span>}</td>
                            <td className="py-2.5 text-muted"><span className="inline-flex items-center gap-1.5"><Globe2 size={12} /> {flag(r.country)} {place(r)}</span></td>
                            <td className="px-5 py-2.5 text-muted"><span className="inline-flex items-center gap-1.5 capitalize"><DeviceIcon d={r.device ?? 'desktop'} /> {r.device} · {r.client}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              <div className="py-10 text-center text-sm text-muted"><UserRound className="mx-auto mb-2 text-faint" />No clicks for this person in the last {days} days.</div>
            )}
            <button className={clsx('btn btn-ghost btn-sm mt-4')} onClick={() => openPerson(null)}><ArrowLeft size={14} /> Back to everyone</button>
          </div>
        )}
      </Modal>
    </section>
  )
}
