import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Check, Code2, Copy, Download, ImagePlus, Info, LayoutTemplate, Link2, Megaphone, Palette, Plus, Sparkles, Trash2, User, Wand2, Share2, Loader2, Zap, AlertTriangle,
} from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../store'
import type { NavLink, Signature, SocialKey } from '../types'
import { FONTS, SOCIAL_LABEL, exportDocument, renderSignature } from '../lib/render'
import { TEMPLATES, templateById } from '../lib/templates'
import { brandColors, copyRich, copyText, download, slug } from '../lib/io'
import EmailPreview from '../components/EmailPreview'
import { DEFAULT_MOTION, buildMotion, motionKeys, motionStale, type MotionProblem } from '../lib/motionAssets'
import { PHOTO_EFFECTS, drawPhotoFrame, loadImage, type PhotoEffect } from '../lib/motion'
import { useImageUpload } from '../components/upload'
import { ColorInput, Empty, Field, Modal, SigThumb, Toggle, useToast } from '../components/ui'

type Tab = 'template' | 'details' | 'images' | 'social' | 'design' | 'motion' | 'extras'

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'template', label: 'Layout', icon: LayoutTemplate },
  { id: 'details', label: 'Details', icon: User },
  { id: 'images', label: 'Images', icon: ImagePlus },
  { id: 'social', label: 'Social', icon: Share2 },
  { id: 'design', label: 'Style', icon: Palette },
  { id: 'motion', label: 'Motion', icon: Zap },
  { id: 'extras', label: 'Extras', icon: Sparkles },
]

const PALETTES = [
  ['#0f766e', '#e2643b'], ['#1e293b', '#b8893b'], ['#9a3412', '#eab308'], ['#be123c', '#fb923c'],
  ['#14532d', '#84cc16'], ['#0c4a6e', '#38bdf8'], ['#581c87', '#f472b6'], ['#111111', '#111111'],
]

export default function Editor() {
  const { id } = useParams()
  const store = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const original = store.signatures.find((s) => s.id === id)
  const [sig, setSig] = useState<Signature | undefined>(original)
  const [tab, setTab] = useState<Tab>('details')
  const [saved, setSaved] = useState(true)
  const [install, setInstall] = useState(false)
  const [code, setCode] = useState(false)
  const lastSaved = useRef(JSON.stringify(original))

  // autosave: debounce edits back into the store
  useEffect(() => {
    if (!sig) return
    const json = JSON.stringify(sig)
    if (json === lastSaved.current) return
    setSaved(false)
    const t = setTimeout(() => { lastSaved.current = json; store.saveSignature(sig); setSaved(true) }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  // Email-safe motion: regenerate GIFs (debounced) whenever their inputs change.
  const [motionBusy, setMotionBusy] = useState(false)
  const [motionProblem, setMotionProblem] = useState<MotionProblem>(null)
  const failedKey = useRef('')
  useEffect(() => {
    if (!sig || motionBusy || !motionStale(sig)) return
    const key = JSON.stringify(motionKeys(sig))
    if (key === failedKey.current) return
    const t = setTimeout(async () => {
      setMotionBusy(true)
      try {
        const { motion, problem } = await buildMotion(sig, store.org.id)
        setMotionProblem(problem)
        if (problem) failedKey.current = key
        setSig((cur) => (cur?.extras.motion ? { ...cur, extras: { ...cur.extras, motion: { ...motion, ...pickSettings(cur.extras.motion) } } } : cur))
      } catch (e) {
        failedKey.current = key
        toast(`Animation failed: ${(e as Error).message}`)
      } finally {
        setMotionBusy(false)
      }
    }, 900)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, motionBusy])

  const html = useMemo(() => (sig ? renderSignature(sig, { campaigns: store.campaigns }) : ''), [sig, store.campaigns])

  if (!sig)
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <Empty icon={<Info />} title="Signature not found" body="It may have been deleted. Pick a template to start a new one." action={<Link to="/templates" className="btn btn-ink">Browse templates</Link>} />
      </div>
    )

  const set = <K extends keyof Signature>(k: K, v: Signature[K]) => setSig({ ...sig, [k]: v })
  const setF = (k: keyof Signature['fields'], v: string) => set('fields', { ...sig.fields, [k]: v })
  const setD = <K extends keyof Signature['design']>(k: K, v: Signature['design'][K]) => set('design', { ...sig.design, [k]: v })
  const setX = <K extends keyof Signature['extras']>(k: K, v: Signature['extras'][K]) => set('extras', { ...sig.extras, [k]: v })

  const doCopy = async () => {
    try {
      await copyRich(renderSignature(sig, { campaigns: store.campaigns }))
      toast('Signature copied — paste it into your mail settings')
    } catch (err) {
      toast((err as Error).message)
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* top bar */}
      <div className="flex items-center gap-3 border-b border-line bg-surface/80 px-4 py-3 backdrop-blur md:px-6">
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm btn-icon" aria-label="Back"><ArrowLeft size={17} /></button>
        <div className="min-w-0 flex-1">
          <input value={sig.label} onChange={(e) => set('label', e.target.value)} className="h-display w-full max-w-sm truncate bg-transparent text-lg outline-none focus:underline focus:decoration-clay focus:decoration-2 focus:underline-offset-4" />
          <div className="flex items-center gap-1.5 text-xs text-muted">
            {motionBusy ? <><Loader2 size={12} className="animate-spin text-clay" /> Rendering animation…</> : saved ? <><Check size={12} className="text-pine" /> All changes saved</> : <><Loader2 size={12} className="animate-spin" /> Saving…</>}
            <span className="text-line-2">•</span> {templateById(sig.templateId).name} template
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm hidden md:inline-flex" onClick={() => setCode(true)}><Code2 size={15} /> HTML</button>
          <button className="btn btn-line btn-sm hidden sm:inline-flex" onClick={() => download(`${slug(sig.label)}.html`, exportDocument(sig, { campaigns: store.campaigns }))}><Download size={15} /> Download</button>
          <button className="btn btn-line btn-sm hidden sm:inline-flex" onClick={() => setInstall(true)}>Install guide</button>
          <button className="btn btn-clay btn-sm" onClick={doCopy}><Copy size={15} /> Copy signature</button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* tab rail */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-surface px-2 py-2 md:w-[76px] md:flex-col md:border-b-0 md:border-r md:px-2 md:py-4">
          {TABS.map(({ id: t, label, icon: Icon }) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-semibold transition md:px-0',
                tab === t ? 'bg-ink text-paper' : 'text-muted hover:bg-paper-2 hover:text-ink',
              )}
            >
              <Icon size={18} strokeWidth={tab === t ? 2.2 : 1.8} />
              {label}
            </button>
          ))}
        </div>

        {/* controls */}
        <div className="scroll-thin max-h-[45vh] shrink-0 overflow-y-auto border-b border-line bg-surface md:max-h-none md:w-[400px] md:border-b-0 md:border-r">
          <div key={tab} className="animate-rise p-5 md:p-6">
            {tab === 'template' && <TemplatePanel sig={sig} onPick={(t) => {
              const meta = templateById(t)
              setSig({ ...sig, templateId: t, design: { ...sig.design, ...meta.design, font: meta.design.font ?? sig.design.font }, extras: { ...sig.extras, animations: meta.animated || sig.extras.animations, motion: sig.extras.motion ?? meta.extras?.motion } })
            }} campaigns={store.campaigns} />}

            {tab === 'details' && (
              <Section title="Your details" desc="Leave anything blank to hide it.">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Full name" className="col-span-2"><input className="input" value={sig.fields.fullName} onChange={(e) => setF('fullName', e.target.value)} /></Field>
                  <Field label="Job title"><input className="input" value={sig.fields.title} onChange={(e) => setF('title', e.target.value)} /></Field>
                  <Field label="Pronouns"><input className="input" placeholder="she/her" value={sig.fields.pronouns} onChange={(e) => setF('pronouns', e.target.value)} /></Field>
                  <Field label="Department"><input className="input" value={sig.fields.department} onChange={(e) => setF('department', e.target.value)} /></Field>
                  <Field label="Company"><input className="input" value={sig.fields.company} onChange={(e) => setF('company', e.target.value)} /></Field>
                </div>
                <Divider label="Contact" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone"><input className="input" value={sig.fields.phone} onChange={(e) => setF('phone', e.target.value)} /></Field>
                  <Field label="Mobile"><input className="input" value={sig.fields.mobile} onChange={(e) => setF('mobile', e.target.value)} /></Field>
                  <Field label="Email" className="col-span-2"><input className="input" type="email" value={sig.fields.email} onChange={(e) => setF('email', e.target.value)} /></Field>
                  <Field label="Website" className="col-span-2"><input className="input" value={sig.fields.website} onChange={(e) => setF('website', e.target.value)} /></Field>
                  <Field label="Address" className="col-span-2"><input className="input" value={sig.fields.address} onChange={(e) => setF('address', e.target.value)} /></Field>
                </div>
                <button className="btn btn-ghost btn-sm mt-4 w-full border border-dashed border-line-2" onClick={() => {
                  const b = store.brand
                  setSig({ ...sig, fields: { ...sig.fields, company: b.company, website: b.website, address: b.address || sig.fields.address, logo: b.logo || sig.fields.logo }, socials: { ...b.socials, ...sig.socials }, design: { ...sig.design, primary: b.primary, accent: b.accent, font: b.font }, extras: { ...sig.extras, disclaimer: b.disclaimer || sig.extras.disclaimer } })
                  toast('Brand kit applied')
                }}><Wand2 size={14} /> Fill from brand kit</button>
              </Section>
            )}

            {tab === 'images' && <ImagesPanel sig={sig} setF={setF} onColors={(c) => { setSig({ ...sig, design: { ...sig.design, primary: c[0], accent: c[1] ?? sig.design.accent } }); toast('Colours matched to your logo') }} />}

            {tab === 'social' && (
              <Section title="Social profiles" desc="Icons appear in the order below. Paste a full URL or just the handle path.">
                <div className="space-y-3">
                  {(Object.keys(SOCIAL_LABEL) as SocialKey[]).map((k) => (
                    <Field key={k} label={SOCIAL_LABEL[k]}>
                      <input className="input" placeholder={`${k === 'x' ? 'x' : k}.com/yourname`} value={sig.socials[k] ?? ''} onChange={(e) => set('socials', { ...sig.socials, [k]: e.target.value })} />
                    </Field>
                  ))}
                </div>
                <Divider label="Icon style" />
                <div className="seg w-full">
                  {(['filled', 'outline', 'plain'] as const).map((s) => (
                    <button key={s} className="flex-1 justify-center capitalize" data-on={sig.design.iconStyle === s} onClick={() => setD('iconStyle', s)}>{s}</button>
                  ))}
                </div>
              </Section>
            )}

            {tab === 'design' && (
              <Section title="Style" desc="Colours, type and proportions.">
                <div className="mb-4 flex flex-wrap gap-2">
                  {PALETTES.map(([p, a]) => (
                    <button key={p + a} onClick={() => setSig({ ...sig, design: { ...sig.design, primary: p, accent: a } })} className={clsx('flex h-9 w-14 overflow-hidden rounded-lg border-2 transition hover:scale-105', sig.design.primary === p && sig.design.accent === a ? 'border-ink' : 'border-transparent')} aria-label="Palette">
                      <span className="flex-1" style={{ background: p }} /><span className="flex-1" style={{ background: a }} />
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ColorInput label="Primary" value={sig.design.primary} onChange={(v) => setD('primary', v)} />
                  <ColorInput label="Accent" value={sig.design.accent} onChange={(v) => setD('accent', v)} />
                  <ColorInput label="Text" value={sig.design.text} onChange={(v) => setD('text', v)} />
                  <Field label="Font">
                    <select className="input" value={sig.design.font} onChange={(e) => setD('font', e.target.value)}>
                      {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </Field>
                </div>
                <Divider label="Proportions" />
                <span className="field-label">Size</span>
                <div className="seg mb-4 w-full">
                  {(['sm', 'md', 'lg'] as const).map((s) => <button key={s} className="flex-1 justify-center" data-on={sig.design.size === s} onClick={() => setD('size', s)}>{{ sm: 'Compact', md: 'Regular', lg: 'Large' }[s]}</button>)}
                </div>
                <span className="field-label">Photo shape</span>
                <div className="seg w-full">
                  {(['circle', 'rounded', 'square'] as const).map((s) => <button key={s} className="flex-1 justify-center capitalize" data-on={sig.design.photoShape === s} onClick={() => setD('photoShape', s)}>{s}</button>)}
                </div>
              </Section>
            )}

            {tab === 'motion' && <MotionPanel sig={sig} setX={setX} busy={motionBusy} problem={motionProblem} onRetry={() => { failedKey.current = ''; setMotionProblem(null); setSig({ ...sig }) }} />}
            {tab === 'extras' && <ExtrasPanel sig={sig} setX={setX} campaigns={store.campaigns} />}
          </div>
        </div>

        {/* preview */}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto bg-paper-2/60 p-4 md:p-8">
          <EmailPreview html={html} fromName={sig.fields.fullName || 'You'} fromEmail={sig.fields.email || 'you@company.com'} />
        </div>
      </div>

      <InstallModal open={install} onClose={() => setInstall(false)} onCopy={doCopy} />
      <Modal open={code} onClose={() => setCode(false)} title="Signature HTML" subtitle="Table-based, inline-styled markup that survives Gmail, Outlook and Apple Mail." width={760}
        footer={<><button className="btn btn-line" onClick={() => setCode(false)}>Close</button><button className="btn btn-ink" onClick={async () => { await copyText(html); toast('HTML copied') }}><Copy size={15} /> Copy HTML</button></>}>
        <pre className="scroll-thin max-h-[50vh] overflow-auto rounded-xl bg-ink p-4 font-mono text-[11.5px] leading-relaxed text-paper/85 whitespace-pre-wrap break-all">{html}</pre>
      </Modal>
    </div>
  )
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="h-display text-[22px]">{title}</h2>
      {desc && <p className="mb-5 mt-1 text-sm text-muted">{desc}</p>}
      {children}
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return <div className="my-5 flex items-center gap-3"><span className="eyebrow">{label}</span><span className="h-px flex-1 bg-line" /></div>
}

function TemplatePanel({ sig, onPick, campaigns }: { sig: Signature; onPick: (id: string) => void; campaigns: ReturnType<typeof useStore>['campaigns'] }) {
  return (
    <Section title="Layout" desc="Switch templates anytime — your details carry over.">
      <div className="grid grid-cols-2 gap-3">
        {TEMPLATES.map((t) => {
          const preview = renderSignature({ ...sig, templateId: t.id, design: { ...sig.design, ...t.design }, extras: { ...sig.extras, campaignId: null, disclaimer: '' } }, { campaigns, still: true })
          const on = sig.templateId === t.id
          return (
            <button key={t.id} onClick={() => onPick(t.id)} className={clsx('group relative overflow-hidden rounded-xl border bg-white p-2 text-left transition', on ? 'border-ink ring-2 ring-ink' : 'border-line hover:border-line-2 hover:shadow-lift')}>
              <div className="flex h-[78px] items-center overflow-hidden"><SigThumb html={preview} maxH={72} /></div>
              <div className="mt-2 flex items-center justify-between border-t border-line pt-1.5">
                <span className="text-[12px] font-semibold">{t.name}</span>
                {t.pro && <span className="tag bg-butter-soft text-[10px] text-[#8a6410]">PRO</span>}
              </div>
              {on && <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-ink text-paper"><Check size={11} strokeWidth={3} /></span>}
            </button>
          )
        })}
      </div>
    </Section>
  )
}

function ImageDrop({ label, value, onChange, round, hint }: { label: string; value: string; onChange: (v: string) => void; round?: boolean; hint: string }) {
  const upload = useImageUpload()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const take = async (f?: File) => {
    if (!f) return
    setBusy(true)
    const url = await upload(f, round ? 'photo' : 'logo', round ? 240 : 360)
    setBusy(false)
    if (url) onChange(url)
  }
  return (
    <div>
      <span className="field-label">{label}</span>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]) }}
        className={clsx('flex items-center gap-4 rounded-xl border border-dashed p-3 transition', over ? 'border-clay bg-clay-soft' : 'border-line-2 bg-paper/50')}
      >
        <div className={clsx('grid size-16 shrink-0 place-items-center overflow-hidden border border-line bg-white', round ? 'rounded-full' : 'rounded-lg')}>
          {value ? <img src={value} alt="" className={clsx('size-full', round ? 'object-cover' : 'object-contain p-1')} /> : <ImagePlus size={20} className="text-faint" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex gap-2">
            <button className="btn btn-line btn-sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 size={14} className="animate-spin" /> : value ? 'Replace' : 'Upload'}</button>
            {value && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onChange('')} aria-label="Remove"><Trash2 size={14} /></button>}
          </div>
          <p className="mt-1.5 text-xs text-muted">{hint}</p>
        </div>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => take(e.target.files?.[0])} />
      </div>
    </div>
  )
}

function ImagesPanel({ sig, setF, onColors }: { sig: Signature; setF: (k: keyof Signature['fields'], v: string) => void; onColors: (c: string[]) => void }) {
  return (
    <Section title="Images" desc="Drop a file or paste an image URL. Uploads are hosted for you, so they show up in every mail app.">
      <div className="space-y-5">
        <ImageDrop label="Profile photo" round value={sig.fields.photo} onChange={(v) => setF('photo', v)} hint="Square, at least 200×200" />
        <Field label="…or photo URL"><input className="input" placeholder="https://" value={sig.fields.photo} onChange={(e) => setF('photo', e.target.value)} /></Field>
        <ImageDrop label="Company logo" value={sig.fields.logo} onChange={(v) => setF('logo', v)} hint="PNG with transparent background" />
        <Field label="…or logo URL"><input className="input" placeholder="https://" value={sig.fields.logo} onChange={(e) => setF('logo', e.target.value)} /></Field>
        {sig.fields.logo && (
          <button className="flex w-full items-center gap-3 rounded-xl border border-line bg-gradient-to-r from-butter-soft to-clay-soft p-3 text-left transition hover:border-line-2" onClick={async () => { const c = await brandColors(sig.fields.logo); if (c.length) onColors(c) }}>
            <span className="grid size-9 place-items-center rounded-lg bg-ink text-paper"><Wand2 size={16} /></span>
            <span><span className="block text-sm font-semibold">Match colours to my logo</span><span className="block text-xs text-muted">Pulls a primary & accent from the image</span></span>
          </button>
        )}
      </div>
    </Section>
  )
}

function ExtrasPanel({ sig, setX, campaigns }: { sig: Signature; setX: <K extends keyof Signature['extras']>(k: K, v: Signature['extras'][K]) => void; campaigns: ReturnType<typeof useStore>['campaigns'] }) {
  const links = sig.extras.navLinks
  const setLink = (i: number, p: Partial<NavLink>) => setX('navLinks', links.map((l, j) => (j === i ? { ...l, ...p } : l)))
  return (
    <Section title="Extras" desc="The details that make people click.">
      <div className="space-y-2.5">
        <Toggle on={sig.extras.animations} onChange={(v) => setX('animations', v)} label="Animations" desc="Glowing photo, floating logo, hover lifts" />
        <Toggle on={sig.extras.verified} onChange={(v) => setX('verified', v)} label="Verified badge" desc="Blue check beside your name" />
      </div>

      <Divider label="Interactive nav bar" />
      <div className="space-y-2">
        {links.map((l, i) => (
          <div key={i} className="flex gap-2">
            <input className="input w-[38%]" placeholder="Label" value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} />
            <input className="input flex-1" placeholder="URL" value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} />
            <button className="btn btn-ghost btn-icon shrink-0" onClick={() => setX('navLinks', links.filter((_, j) => j !== i))} aria-label="Remove link"><Trash2 size={14} /></button>
          </div>
        ))}
        {links.length < 4 && <button className="btn btn-ghost btn-sm w-full border border-dashed border-line-2" onClick={() => setX('navLinks', [...links, { label: '', url: '' }])}><Plus size={14} /> Add link</button>}
      </div>

      <Divider label="Call to action" />
      {sig.extras.cta ? (
        <div className="flex gap-2">
          <input className="input w-[45%]" placeholder="Book a demo" value={sig.extras.cta.label} onChange={(e) => setX('cta', { ...sig.extras.cta!, label: e.target.value })} />
          <input className="input flex-1" placeholder="URL" value={sig.extras.cta.url} onChange={(e) => setX('cta', { ...sig.extras.cta!, url: e.target.value })} />
          <button className="btn btn-ghost btn-icon shrink-0" onClick={() => setX('cta', null)} aria-label="Remove CTA"><Trash2 size={14} /></button>
        </div>
      ) : (
        <button className="btn btn-ghost btn-sm w-full border border-dashed border-line-2" onClick={() => setX('cta', { label: 'Book a call', url: '' })}><Link2 size={14} /> Add a button</button>
      )}

      <Divider label="Campaign banner" />
      <div className="grid gap-2">
        <button onClick={() => setX('campaignId', null)} className={clsx('rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition', !sig.extras.campaignId ? 'border-ink bg-paper' : 'border-line hover:border-line-2')}>No banner</button>
        {campaigns.map((c) => (
          <button key={c.id} onClick={() => setX('campaignId', c.id)} className={clsx('flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition', sig.extras.campaignId === c.id ? 'border-ink bg-paper' : 'border-line hover:border-line-2')}>
            <span className="h-7 w-10 shrink-0 rounded-md" style={{ background: c.style === 'dark' ? '#0f172a' : `linear-gradient(120deg,${c.from},${c.to})` }} />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{c.name}</span><span className="block text-xs text-muted">{c.active ? 'Live' : 'Paused — hidden until active'}</span></span>
          </button>
        ))}
        <Link to="/campaigns" className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-clay-ink hover:underline"><Megaphone size={12} /> Manage campaigns</Link>
      </div>

      <Divider label="Words" />
      <div className="space-y-3">
        <Field label="Quote or tagline"><input className="input" placeholder="Office hours, motto, or a quick note" value={sig.extras.quote} onChange={(e) => setX('quote', e.target.value)} /></Field>
        <Field label="Legal disclaimer"><textarea className="input" rows={3} value={sig.extras.disclaimer} onChange={(e) => setX('disclaimer', e.target.value)} /></Field>
      </div>
    </Section>
  )
}

const GUIDES: Record<string, string[]> = {
  Gmail: ['Click Copy signature above.', 'In Gmail, open Settings (gear) → See all settings.', 'Scroll to Signature → Create new, then paste (⌘/Ctrl + V).', 'Set it as default for new emails and replies, then Save Changes at the bottom.'],
  Outlook: ['Click Copy signature above.', 'Outlook on the web: Settings → Mail → Compose and reply.', 'Outlook desktop: File → Options → Mail → Signatures.', 'Create a new signature, paste, choose defaults and save.'],
  'Apple Mail': ['Click Download to save the .html file and open it in Safari.', 'Select all (⌘A) and copy (⌘C).', 'In Mail: Settings → Signatures → + and paste.', 'Untick "Always match my default message font" to keep the styling.'],
  'iPhone': ['Email the downloaded .html file to yourself and open it on your iPhone.', 'Press and hold the signature → Select All → Copy.', 'Settings → Mail → Signature, then paste.', 'Shake the phone and tap Undo if iOS strips the formatting.'],
}

function InstallModal({ open, onClose, onCopy }: { open: boolean; onClose: () => void; onCopy: () => void }) {
  const [client, setClient] = useState('Gmail')
  return (
    <Modal open={open} onClose={onClose} title="Install your signature" subtitle="Takes about a minute. No integrations needed."
      footer={<><button className="btn btn-line" onClick={onClose}>Done</button><button className="btn btn-clay" onClick={onCopy}><Copy size={15} /> Copy signature</button></>}>
      <div className="mb-5 flex flex-wrap gap-2">
        {Object.keys(GUIDES).map((c) => <button key={c} className="chip" data-on={client === c} onClick={() => setClient(c)}>{c}</button>)}
      </div>
      <ol className="space-y-3">
        {GUIDES[client].map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-paper">{i + 1}</span>
            <span className="pt-1 text-[14px] leading-relaxed text-ink-3">{step}</span>
          </li>
        ))}
      </ol>
    </Modal>
  )
}

/** The user-editable part of motion settings — generated URLs/keys come from the build. */
function pickSettings(m: Signature['extras']['motion']) {
  if (!m) return {}
  const { photoEffect, greeting, animateCta, animateBadge, animateIcons } = m
  return { photoEffect, greeting, animateCta, animateBadge, animateIcons }
}

function EffectPreview({ effect, photo, initials, primary, accent, shape, greeting, on, onClick }: {
  effect: PhotoEffect | 'none'; photo: HTMLImageElement | null; initials: string; primary: string; accent: string
  shape: Signature['design']['photoShape']; greeting: string; on: boolean; onClick: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    let raf = 0
    const start = performance.now()
    const loop = (now: number) => {
      if (effect === 'none') {
        drawPhotoFrame(ctx, { photo, initials, effect: 'breathe', primary, accent, shape, greeting }, 0.75, 120)
      } else {
        drawPhotoFrame(ctx, { photo, initials, effect, primary, accent, shape, greeting }, ((now - start) / 2000) % 1, 120)
        raf = requestAnimationFrame(loop)
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [effect, photo, initials, primary, accent, shape, greeting])
  const meta = PHOTO_EFFECTS.find((e) => e.id === effect)
  return (
    <button onClick={onClick} className={clsx('relative overflow-hidden rounded-xl border bg-white p-2 text-left transition', on ? 'border-ink ring-2 ring-ink' : 'border-line hover:border-line-2 hover:shadow-lift')}>
      <canvas ref={canvas} width={120} height={120} className="mx-auto block size-[96px]" />
      <div className="mt-1 border-t border-line pt-1.5">
        <div className="text-[12px] font-semibold">{meta?.name ?? 'Still photo'}</div>
        <div className="truncate text-[10.5px] text-muted">{meta?.blurb ?? 'No photo animation'}</div>
      </div>
      {on && <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-ink text-paper"><Check size={11} strokeWidth={3} /></span>}
    </button>
  )
}

function MotionPanel({ sig, setX, busy, problem, onRetry }: {
  sig: Signature
  setX: <K extends keyof Signature['extras']>(k: K, v: Signature['extras'][K]) => void
  busy: boolean
  problem: MotionProblem
  onRetry: () => void
}) {
  const m = sig.extras.motion
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    let live = true
    setImg(null)
    if (sig.fields.photo) loadImage(sig.fields.photo).then((i) => live && setImg(i)).catch(() => {})
    return () => { live = false }
  }, [sig.fields.photo])
  const initials = sig.fields.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'
  const set = (patch: Partial<NonNullable<typeof m>>) => setX('motion', { ...DEFAULT_MOTION, ...m, ...patch })

  return (
    <Section title="Motion" desc="Animated GIFs that play in Gmail, Outlook.com, Apple Mail and on phones — not just in previews.">
      {!m ? (
        <div className="rounded-2xl border border-line bg-gradient-to-br from-clay-soft to-butter-soft p-5">
          <div className="flex items-center gap-2 text-sm font-semibold"><Zap size={16} className="text-clay-ink" /> Make this signature move everywhere</div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-3">We render your photo, button, badge and icons as lightweight animated GIFs, hosted for you. CSS-only animation is stripped by most mail apps — GIFs aren't.</p>
          <button className="btn btn-ink mt-4 w-full" onClick={() => { setX('motion', DEFAULT_MOTION); if (!sig.extras.animations) setX('animations', true) }}>Turn on animated GIFs</button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-paper/60 px-3.5 py-2.5 text-sm">
            {busy ? <span className="flex items-center gap-2 text-ink-3"><Loader2 size={14} className="animate-spin text-clay" /> Rendering GIFs…</span>
              : problem ? <span className="flex items-center gap-2 text-clay-ink"><AlertTriangle size={14} /> Photo can't be animated</span>
              : <span className="flex items-center gap-2 text-pine"><Check size={14} /> Animations up to date</span>}
            {!sig.extras.animations && <button className="text-xs font-semibold text-clay-ink hover:underline" onClick={() => setX('animations', true)}>Animations are off — turn on</button>}
          </div>
          {problem === 'photo-unreadable' && (
            <div className="mb-4 flex gap-2.5 rounded-xl bg-butter-soft p-3 text-xs leading-relaxed text-[#6b4e0e]">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>This photo's website doesn't allow it to be animated. Upload the photo in <strong>Images</strong> (or import it from Microsoft 365) and it'll work. <button className="font-semibold underline" onClick={onRetry}>Retry</button></span>
            </div>
          )}

          <span className="field-label">Photo animation</span>
          <div className="grid grid-cols-2 gap-2.5">
            {(['none', ...PHOTO_EFFECTS.map((e) => e.id)] as (PhotoEffect | 'none')[]).map((e) => (
              <EffectPreview key={e} effect={e} photo={img} initials={initials} primary={sig.design.primary} accent={sig.design.accent} shape={sig.design.photoShape} greeting={m.greeting} on={m.photoEffect === e} onClick={() => set({ photoEffect: e })} />
            ))}
          </div>
          {m.photoEffect === 'hello' && (
            <Field label="Greeting" className="mt-3"><input className="input" maxLength={10} value={m.greeting} onChange={(e) => set({ greeting: e.target.value })} /></Field>
          )}

          <Divider label="Also animate" />
          <div className="space-y-2.5">
            <Toggle on={m.animateCta} onChange={(v) => set({ animateCta: v })} label="Call-to-action button" desc={sig.extras.cta ? 'Shimmer sweep with a nudging arrow' : 'Add a button in Extras first'} />
            <Toggle on={m.animateBadge} onChange={(v) => set({ animateBadge: v })} label="Verified badge" desc={sig.extras.verified ? 'Spinning seal that pops' : 'Turn on the verified badge in Extras'} />
            <Toggle on={m.animateIcons} onChange={(v) => set({ animateIcons: v })} label="Social icons" desc="Icons hop one after another (Motion Card layout)" />
          </div>

          <p className="mt-5 text-xs leading-relaxed text-faint">Outlook for Windows desktop shows only the first frame of a GIF, so every effect is designed to look finished on frame one.</p>
          <button className="mt-3 text-xs font-semibold text-muted hover:text-ink" onClick={() => setX('motion', undefined)}>Switch back to CSS-only animation</button>
        </>
      )}
    </Section>
  )
}
