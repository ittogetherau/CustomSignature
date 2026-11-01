import { useState } from 'react'
import { CalendarDays, ImagePlus, Megaphone, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../store'
import type { Campaign } from '../types'
import { bannerHtml } from '../lib/render'
import { uid } from '../lib/templates'
import { compact, readImage } from '../lib/io'
import { ColorInput, Empty, Field, Modal, PageHeader, SignatureHTML, useToast } from '../components/ui'

const today = () => new Date().toISOString().slice(0, 10)
const plus = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10)

function status(c: Campaign) {
  const t = today()
  if (!c.active) return { label: 'Paused', cls: 'bg-paper-2 text-muted' }
  if (c.start > t) return { label: 'Scheduled', cls: 'bg-butter-soft text-[#8a6410]' }
  if (c.end && c.end < t) return { label: 'Ended', cls: 'bg-paper-2 text-muted' }
  return { label: 'Live', cls: 'bg-pine-soft text-pine' }
}

export default function Campaigns() {
  const { campaigns, saveCampaign, deleteCampaign, employees } = useStore()
  const toast = useToast()
  const [edit, setEdit] = useState<Campaign | null>(null)

  const blank = (): Campaign => ({ id: uid(), name: 'New campaign', headline: 'Your headline goes here', subline: 'A short supporting line', ctaLabel: 'Learn more', url: '', image: '', style: 'gradient', from: '#e2643b', to: '#f3a55b', start: today(), end: plus(14), departments: [], active: true, impressions: 0, clicks: 0 })

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Banners & campaigns"
        subtitle="Turn every email your team sends into a placement. Schedule banners, target departments, and track clicks."
        actions={<button className="btn btn-ink" onClick={() => setEdit(blank())}><Plus size={16} /> New campaign</button>}
      />

      {campaigns.length === 0 ? (
        <Empty icon={<Megaphone />} title="No campaigns yet" body="Promote a webinar, a case study, or holiday hours in every signature." action={<button className="btn btn-ink" onClick={() => setEdit(blank())}>Create campaign</button>} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {campaigns.map((c, i) => {
            const st = status(c)
            const reach = c.departments.length ? employees.filter((e) => c.departments.includes(e.department)).length : employees.length
            return (
              <article key={c.id} className="card animate-rise overflow-hidden" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="border-b border-line bg-white p-5"><SignatureHTML html={bannerHtml(c, 'Helvetica, Arial, sans-serif', true)} /></div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2"><h3 className="h-display text-lg">{c.name}</h3><span className={clsx('tag', st.cls)}>{st.label}</span></div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted"><CalendarDays size={12} /> {fmt(c.start)} – {c.end ? fmt(c.end) : 'no end'} · {c.departments.length ? c.departments.join(', ') : 'Everyone'} · {reach} people</div>
                    </div>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-sm btn-icon" aria-label={c.active ? 'Pause' : 'Resume'} onClick={() => { saveCampaign({ ...c, active: !c.active }); toast(c.active ? 'Campaign paused' : 'Campaign live') }}>{c.active ? <Pause size={15} /> : <Play size={15} />}</button>
                      <button className="btn btn-ghost btn-sm btn-icon" aria-label="Edit" onClick={() => setEdit(c)}><Pencil size={15} /></button>
                      <button className="btn btn-ghost btn-sm btn-icon" aria-label="Delete" onClick={() => { deleteCampaign(c.id); toast('Campaign deleted') }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 divide-x divide-line rounded-xl border border-line text-center">
                    <div className="py-2.5"><div className="h-display text-xl">{compact(c.impressions)}</div><div className="text-[11px] text-muted">Impressions</div></div>
                    <div className="py-2.5"><div className="h-display text-xl">{compact(c.clicks)}</div><div className="text-[11px] text-muted">Clicks</div></div>
                    <div className="py-2.5"><div className="h-display text-xl">{c.impressions ? ((c.clicks / c.impressions) * 100).toFixed(1) : '0.0'}%</div><div className="text-[11px] text-muted">CTR</div></div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {edit && <CampaignEditor value={edit} onClose={() => setEdit(null)} onSave={(c) => { saveCampaign(c); setEdit(null); toast('Campaign saved') }} />}
    </>
  )
}

const fmt = (d: string) => new Date(d + 'T00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })

const PRESETS: [string, string][] = [['#e2643b', '#f3a55b'], ['#0f766e', '#34d399'], ['#1e293b', '#475569'], ['#be123c', '#fb7185'], ['#4338ca', '#06b6d4'], ['#a16207', '#facc15']]

function CampaignEditor({ value, onClose, onSave }: { value: Campaign; onClose: () => void; onSave: (c: Campaign) => void }) {
  const { employees } = useStore()
  const [c, setC] = useState(value)
  const depts = [...new Set(employees.map((e) => e.department).filter(Boolean))]
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setC({ ...c, [k]: v })

  return (
    <Modal open onClose={onClose} title={value.impressions || value.name !== 'New campaign' ? 'Edit campaign' : 'New campaign'} width={760}
      footer={<><button className="btn btn-line" onClick={onClose}>Cancel</button><button className="btn btn-ink" onClick={() => onSave(c)}>Save campaign</button></>}>
      <div className="mb-5 rounded-xl border border-line bg-white p-5"><SignatureHTML html={bannerHtml(c, 'Helvetica, Arial, sans-serif', true)} /></div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Internal name" className="sm:col-span-2"><input className="input" value={c.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <div className="sm:col-span-2">
          <span className="field-label">Style</span>
          <div className="seg">
            {(['gradient', 'dark', 'light', 'image'] as const).map((s) => <button key={s} className="capitalize" data-on={c.style === s} onClick={() => set('style', s)}>{s}</button>)}
          </div>
        </div>
        {c.style === 'image' ? (
          <div className="sm:col-span-2">
            <span className="field-label">Banner image (1200×300 works well)</span>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-2 bg-paper/50 p-3 hover:border-ink">
              <ImagePlus size={18} className="text-muted" />
              <span className="text-sm">{c.image ? 'Replace image' : 'Upload an image'}</span>
              <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) set('image', await readImage(f, 1200)) }} />
            </label>
          </div>
        ) : (
          <>
            <Field label="Headline" className="sm:col-span-2"><input className="input" value={c.headline} onChange={(e) => set('headline', e.target.value)} /></Field>
            <Field label="Supporting line" className="sm:col-span-2"><input className="input" value={c.subline} onChange={(e) => set('subline', e.target.value)} /></Field>
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              {PRESETS.map(([a, b]) => <button key={a} onClick={() => setC({ ...c, from: a, to: b })} className={clsx('h-8 w-12 rounded-lg border-2 transition hover:scale-105', c.from === a ? 'border-ink' : 'border-transparent')} style={{ background: `linear-gradient(120deg,${a},${b})` }} aria-label="Colour preset" />)}
            </div>
            <ColorInput label="Colour from" value={c.from} onChange={(v) => set('from', v)} />
            <ColorInput label="Colour to" value={c.to} onChange={(v) => set('to', v)} />
          </>
        )}
        <Field label="Button label"><input className="input" placeholder="Leave blank for no button" value={c.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} /></Field>
        <Field label="Link"><input className="input" placeholder="yoursite.com/offer" value={c.url} onChange={(e) => set('url', e.target.value)} /></Field>
        <Field label="Starts"><input className="input" type="date" value={c.start} onChange={(e) => set('start', e.target.value)} /></Field>
        <Field label="Ends"><input className="input" type="date" value={c.end} onChange={(e) => set('end', e.target.value)} /></Field>
        <div className="sm:col-span-2">
          <span className="field-label">Show to</span>
          <div className="flex flex-wrap gap-1.5">
            <button className="chip" data-on={c.departments.length === 0} onClick={() => set('departments', [])}>Everyone</button>
            {depts.map((d) => <button key={d} className="chip" data-on={c.departments.includes(d)} onClick={() => set('departments', c.departments.includes(d) ? c.departments.filter((x) => x !== d) : [...c.departments, d])}>{d}</button>)}
          </div>
        </div>
      </div>
    </Modal>
  )
}
