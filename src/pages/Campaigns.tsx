import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ImagePlus, LayoutGrid, Loader2, Megaphone, Palette, Pause, Pencil, Play, Plus, Sparkles, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../store'
import type { BannerDesign, Campaign } from '../types'
import { BANNER_CATEGORIES, BANNER_PALETTES, BANNER_TEMPLATES, BH, BW, bannerGif, bannerJpeg, bannerTemplate, contrast, ensureBannerFonts, mix, paintBanner, type BannerData, type BannerTemplate } from '../lib/banners'
import { assetKey, loadImage } from '../lib/motion'
import { uploadAsset } from '../lib/supabase'
import { bannerHtml } from '../lib/render'
import { uid } from '../lib/templates'
import { ColorInput, Empty, Field, Modal, PageHeader, SignatureHTML, Toggle, useToast } from '../components/ui'
import { useImageUpload } from '../components/upload'

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
  const [confirmDelete, setConfirmDelete] = useState<Campaign | null>(null)

  const blank = (): Campaign => ({ id: uid(), name: 'New campaign', headline: 'Your headline goes here', subline: 'A short supporting line', ctaLabel: 'Learn more', url: '', image: '', style: 'gradient', from: '#e2643b', to: '#f3a55b', start: today(), end: plus(14), departments: [], active: true })

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Banners & campaigns"
        subtitle="Turn every email your team sends into a placement. Schedule banners and target them by department."
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
                      <button className="btn btn-ghost btn-sm btn-icon" aria-label="Delete" onClick={() => setConfirmDelete(c)}><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} width={460} title="Delete this campaign?"
        subtitle={confirmDelete?.active ? 'It is live — its banner will disappear from signatures copied or sent from now on.' : 'This permanently removes the campaign.'}
        footer={<><button className="btn btn-line" onClick={() => setConfirmDelete(null)}>Cancel</button><button className="btn bg-[#b91c1c] text-white hover:bg-[#991b1b]" onClick={() => { if (confirmDelete) { deleteCampaign(confirmDelete.id); toast('Campaign deleted') } setConfirmDelete(null) }}>Delete campaign</button></>}>
        <p className="text-sm text-muted">“{confirmDelete?.name}” will be deleted. Tip: use pause instead if you might run it again.</p>
      </Modal>

      {edit && <CampaignEditor value={edit} onClose={() => setEdit(null)} onSave={(c) => { saveCampaign(c); setEdit(null); toast('Campaign saved') }} />}
    </>
  )
}

const fmt = (d: string) => new Date(d + 'T00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })

const PRESETS: [string, string][] = [['#e2643b', '#f3a55b'], ['#0f766e', '#34d399'], ['#1e293b', '#475569'], ['#be123c', '#fb7185'], ['#4338ca', '#06b6d4'], ['#a16207', '#facc15']]

function CampaignEditor({ value, onClose, onSave }: { value: Campaign; onClose: () => void; onSave: (c: Campaign) => void }) {
  const { employees, campaigns, brand, org } = useStore()
  const upload = useImageUpload()
  const toast = useToast()
  const isNew = !campaigns.some((x) => x.id === value.id)
  const [c, setC] = useState<Campaign>(value)
  const [picking, setPicking] = useState(isNew && !value.design)
  const [saving, setSaving] = useState(false)
  const depts = [...new Set(employees.map((e) => e.department).filter(Boolean))]
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setC((p) => ({ ...p, [k]: v }))
  const tpl = bannerTemplate(c.design?.template)
  const designed = c.style === 'designed' && !!tpl
  const setDesign = (patch: Partial<BannerDesign>) => setC((p) => ({ ...p, design: { ...(p.design as BannerDesign), ...patch } }))

  const choose = (t: BannerTemplate) => {
    setC((p) => ({
      ...p,
      style: 'designed',
      name: p.name === 'New campaign' || !p.name ? t.name : p.name,
      // New campaigns take the template's sample copy; existing ones keep their own words.
      headline: isNew || !p.headline ? t.defaults.headline : p.headline,
      subline: isNew || !p.subline ? t.defaults.subline : p.subline,
      ctaLabel: isNew || !p.ctaLabel ? t.defaults.cta : p.ctaLabel,
      from: t.defaults.from,
      to: t.defaults.to,
      design: { template: t.id, eyebrow: t.defaults.eyebrow, date: t.defaults.date, accent: t.defaults.accent, showLogo: Boolean(brand.logo), animated: false },
    }))
    setPicking(false)
  }

  const brandColours = () => {
    if (!tpl) return
    // Light-background templates need tints so dark text stays readable.
    if (tpl.ink === 'dark') {
      const from = mix(brand.primary, '#ffffff', 0.86), to = mix(brand.accent, '#ffffff', 0.8)
      const accent = contrast(brand.primary, to) >= 3 ? brand.primary : mix(brand.primary, '#000000', 0.45)
      setC((p) => ({ ...p, from, to, design: { ...(p.design as BannerDesign), accent } }))
    } else {
      const from = mix(brand.primary, '#000000', 0.25), to = brand.primary
      // A button the same colour as the background disappears — fall back to white.
      const accent = Math.min(contrast(brand.accent, from), contrast(brand.accent, to)) >= 2.2 ? brand.accent : '#ffffff'
      setC((p) => ({ ...p, from, to, design: { ...(p.design as BannerDesign), accent } }))
    }
  }

  const save = async () => {
    if (!designed || !tpl || !c.design) return onSave(c)
    setSaving(true)
    try {
      await ensureBannerFonts()
      const logoUrl = bannerLogo(tpl, brand).url
      const logo = c.design.showLogo && logoUrl ? await loadImage(logoUrl).catch(() => null) : null
      const data = bannerData(c, brand, logo)
      const key = assetKey([c.design, c.headline, c.subline, c.ctaLabel, c.from, c.to, c.design.showLogo ? logoUrl : ''])
      let image = c.image, imageKey = c.imageKey
      if (key !== c.imageKey || !c.image) {
        const blob = c.design.animated && tpl.animated ? bannerGif(tpl, data) : await bannerJpeg(tpl, data)
        image = await uploadAsset(org.id, blob, `banners/${tpl.id}-${key}`)
        imageKey = key
      }
      onSave({ ...c, image, imageKey })
    } catch (e) {
      toast(`Couldn't render banner: ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  if (picking)
    return (
      <Modal open onClose={onClose} title="Choose a banner design" subtitle="Every design adapts to your text, colours and logo. You can change anything after." width={1040}>
        <BannerGallery onPick={choose} />
        <div className="mt-5 flex justify-end border-t border-line pt-4">
          <button className="btn btn-ghost btn-sm" onClick={() => { setC((p) => ({ ...p, style: 'gradient', design: undefined })); setPicking(false) }}>Start from a simple banner instead</button>
        </div>
      </Modal>
    )

  return (
    <Modal open onClose={onClose} title={isNew ? 'New campaign' : 'Edit campaign'} width={900}
      footer={<><button className="btn btn-line" onClick={onClose}>Cancel</button><button className="btn btn-ink" disabled={saving} onClick={save}>{saving ? <><Loader2 size={15} className="animate-spin" /> Rendering banner…</> : 'Save campaign'}</button></>}>
      <div className="mb-5 overflow-hidden rounded-2xl border border-line bg-paper-2/50 p-4">
        {designed && tpl ? <LiveBanner tpl={tpl} campaign={c} /> : <div className="rounded-xl bg-white p-4"><SignatureHTML html={bannerHtml(c, 'Helvetica, Arial, sans-serif', true)} /></div>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{designed ? `Shown at 600 × 200 in signatures${c.design?.animated && tpl?.animated ? ' · animated GIF' : ' · sharp 2× image'}` : 'Simple HTML banner'}</span>
          <button className="btn btn-line btn-sm" onClick={() => setPicking(true)}><LayoutGrid size={14} /> {designed ? 'Change design' : 'Browse designs'}</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Internal name" className="sm:col-span-2"><input className="input" value={c.name} onChange={(e) => set('name', e.target.value)} /></Field>

        {designed && c.design ? (
          <>
            <Field label="Eyebrow"><input className="input" value={c.design.eyebrow} onChange={(e) => setDesign({ eyebrow: e.target.value })} /></Field>
            <Field label="Date or detail (optional)"><input className="input" placeholder="20 Nov · 11am AEDT" value={c.design.date} onChange={(e) => setDesign({ date: e.target.value })} /></Field>
            <Field label="Headline" className="sm:col-span-2"><input className="input" value={c.headline} onChange={(e) => set('headline', e.target.value)} /></Field>
            <Field label="Supporting line" className="sm:col-span-2"><input className="input" value={c.subline} onChange={(e) => set('subline', e.target.value)} /></Field>
            <div className="sm:col-span-2">
              <span className="field-label">Colours</span>
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn btn-line btn-sm" onClick={brandColours}><Palette size={14} /> Use my brand colours</button>
                {BANNER_PALETTES.map(([a, b, x]) => (
                  <button key={a + b} onClick={() => setC((p) => ({ ...p, from: a, to: b, design: { ...(p.design as BannerDesign), accent: x } }))} className={clsx('relative h-8 w-12 overflow-hidden rounded-lg border-2 transition hover:scale-105', c.from === a && c.to === b ? 'border-ink' : 'border-transparent')} style={{ background: `linear-gradient(120deg,${a},${b})` }} aria-label="Palette">
                    <span className="absolute bottom-1 right-1 size-2.5 rounded-full ring-1 ring-white" style={{ background: x }} />
                  </button>
                ))}
              </div>
            </div>
            <ColorInput label="Background from" value={c.from} onChange={(v) => set('from', v)} />
            <ColorInput label="Background to" value={c.to} onChange={(v) => set('to', v)} />
            <ColorInput label="Button & accent" value={c.design.accent} onChange={(v) => setDesign({ accent: v })} />
            <div className="space-y-2 pt-[22px]">
              <Toggle on={c.design.showLogo} onChange={(v) => setDesign({ showLogo: v })} label="Show my logo" desc={brand.logo ? 'From your brand kit' : 'Add a logo in Brand kit first'} />
              {tpl?.animated && <Toggle on={c.design.animated} onChange={(v) => setDesign({ animated: v })} label="Animate" desc="Looping GIF — first frame is the full design" />}
            </div>
          </>
        ) : (
          <>
            <div className="sm:col-span-2">
              <span className="field-label">Style</span>
              <div className="seg">{(['gradient', 'dark', 'light', 'image'] as const).map((st) => <button key={st} className="capitalize" data-on={c.style === st} onClick={() => set('style', st)}>{st}</button>)}</div>
            </div>
            {c.style === 'image' ? (
              <div className="sm:col-span-2">
                <span className="field-label">Banner image (1200×400 works best)</span>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-2 bg-paper/50 p-3 hover:border-ink">
                  <ImagePlus size={18} className="text-muted" />
                  <span className="text-sm">{c.image ? 'Replace image' : 'Upload an image'}</span>
                  <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const u = await upload(f, 'banner', 1200); if (u) set('image', u) } }} />
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
          </>
        )}

        <Field label="Button label"><input className="input" placeholder="Leave blank for no button" value={c.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} /></Field>
        <Field label="Link"><input className="input" placeholder="yoursite.com/offer" value={c.url} onChange={(e) => set('url', e.target.value)} /></Field>
        <div className="sm:col-span-2"><Toggle on={c.active} onChange={(v) => set('active', v)} label={c.active ? 'Live — goes into signatures during its dates' : 'Paused — saved but not shown in signatures'} desc="Live campaigns are added to signatures automatically." /></div>
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

/** The logo variation that reads best on this design, and whether it needs a white chip. */
function bannerLogo(tpl: BannerTemplate | undefined, brand: ReturnType<typeof useStore>['brand']) {
  if (!tpl) return { url: brand.logo, chip: true }
  if (tpl.ink === 'light') return brand.logoLight ? { url: brand.logoLight, chip: false } : { url: brand.logo, chip: true }
  return brand.logoDark ? { url: brand.logoDark, chip: false } : { url: brand.logo, chip: false }
}

function bannerData(c: Campaign, brand: ReturnType<typeof useStore>['brand'], logo: HTMLImageElement | null): BannerData {
  const chip = bannerLogo(bannerTemplate(c.design?.template), brand).chip
  return { headline: c.headline, subline: c.subline, cta: c.ctaLabel, eyebrow: c.design?.eyebrow ?? '', date: c.design?.date ?? '', from: c.from, to: c.to, accent: c.design?.accent ?? '#ffffff', logo, logoChip: chip, company: brand.company }
}

/** Live canvas preview; animates when the design's animation is on. */
function LiveBanner({ tpl, campaign, scale = 1 }: { tpl: BannerTemplate; campaign: Campaign; scale?: number }) {
  const { brand } = useStore()
  const ref = useRef<HTMLCanvasElement>(null)
  const [logo, setLogo] = useState<HTMLImageElement | null>(null)
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => { ensureBannerFonts().then(() => setFontsReady(true)) }, [])
  const logoUrl = bannerLogo(tpl, brand).url
  useEffect(() => {
    let live = true
    if (campaign.design?.showLogo && logoUrl) loadImage(logoUrl).then((i) => live && setLogo(i)).catch(() => live && setLogo(null))
    else setLogo(null)
    return () => { live = false }
  }, [campaign.design?.showLogo, logoUrl])
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1) * scale
    const data = bannerData(campaign, brand, logo)
    const animate = campaign.design?.animated && tpl.animated
    let raf = 0
    const start = performance.now()
    const frame = (now: number) => {
      paintBanner(ctx, tpl, data, animate ? ((now - start) / 1900) % 1 : 0, dpr)
      if (animate) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [tpl, campaign, brand, logo, fontsReady, scale])
  const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1) * scale
  return <canvas ref={ref} width={BW * dpr} height={BH * dpr} className="block h-auto w-full rounded-xl shadow-card" />
}

function BannerGallery({ onPick }: { onPick: (t: BannerTemplate) => void }) {
  const { brand } = useStore()
  const [cat, setCat] = useState<(typeof BANNER_CATEGORIES)[number]>('All')
  const list = BANNER_TEMPLATES.filter((t) => cat === 'All' || t.category === cat)
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-1.5">{BANNER_CATEGORIES.map((k) => <button key={k} className="chip" data-on={cat === k} onClick={() => setCat(k)}>{k}</button>)}</div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => {
          const demo: Campaign = { id: t.id, name: t.name, headline: t.defaults.headline, subline: t.defaults.subline, ctaLabel: t.defaults.cta, url: '', image: '', style: 'designed', from: t.defaults.from, to: t.defaults.to, start: '', end: '', departments: [], active: true, design: { template: t.id, eyebrow: t.defaults.eyebrow, date: t.defaults.date, accent: t.defaults.accent, showLogo: Boolean(brand.logo), animated: false } }
          return (
            <button key={t.id} onClick={() => onPick(t)} className="group overflow-hidden rounded-2xl border border-line bg-white p-2 text-left transition hover:-translate-y-0.5 hover:border-ink hover:shadow-lift">
              <LiveBanner tpl={t} campaign={demo} scale={0.5} />
              <div className="flex items-center justify-between px-1 pb-0.5 pt-2">
                <span className="text-sm font-semibold">{t.name}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted">{t.animated && <Sparkles size={11} className="text-clay" />}{t.category}</span>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}
