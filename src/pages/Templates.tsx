import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, Search, Sparkles, X } from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../store'
import { CATEGORIES, DEFAULT_FIELDS, TEMPLATES, signatureFromTemplate, type TemplateMeta } from '../lib/templates'
import { useAuth } from '../auth'
import { renderSignature } from '../lib/render'
import { Modal, PageHeader, SigThumb, SignatureHTML, Toggle, useToast } from '../components/ui'

export default function Templates() {
  const { signatures, campaigns, brand, saveSignature } = useStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const [animatedOnly, setAnimatedOnly] = useState(false)
  const [mine, setMine] = useState(false)
  const [preview, setPreview] = useState<TemplateMeta | null>(null)

  const me = signatures[0]

  const build = (t: TemplateMeta, i: number) => {
    const s = signatureFromTemplate(t.id, {}, i)
    if (mine && me) {
      s.fields = { ...me.fields }
      s.socials = { ...me.socials }
    }
    return s
  }

  const list = useMemo(
    () =>
      TEMPLATES.filter((t) => (cat === 'All' || t.categories.includes(cat)) && (!animatedOnly || t.animated) && (`${t.name} ${t.tagline} ${t.categories.join(' ')}`.toLowerCase().includes(q.toLowerCase()))),
    [cat, q, animatedOnly],
  )

  const use = (t: TemplateMeta) => {
    const i = TEMPLATES.indexOf(t)
    const s = build(t, i)
    if (!mine) {
      // New signatures start from the signed-in user and the brand kit — never the showcase person.
      const fullName = (user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string) || ''
      const site = brand.website
      s.label = fullName ? `${fullName.split(' ')[0]} — ${t.name}` : `${t.name} signature`
      s.fields = { ...DEFAULT_FIELDS, fullName, email: user?.email ?? '', company: brand.company, website: site, phone: brand.phone, address: '', logo: brand.logo, logoLight: brand.logoLight ?? '', photo: '', title: '' }
      s.socials = { ...brand.socials }
      s.design = { ...s.design, primary: brand.primary || s.design.primary, accent: brand.accent || s.design.accent, font: t.design.font ?? brand.font }
      s.extras = {
        ...s.extras,
        navLinks: s.extras.navLinks.map((l) => ({ ...l, url: site })),
        cta: s.extras.cta ? { ...s.extras.cta, url: site } : null,
        quote: '',
        disclaimer: brand.disclaimer || s.extras.disclaimer,
      }
    }
    saveSignature(s)
    toast(`${t.name} added to your signatures`)
    navigate(`/editor/${s.id}`)
  }

  return (
    <>
      <PageHeader
        eyebrow={`${TEMPLATES.length} designs · ${TEMPLATES.filter((t) => t.animated).length} animated`}
        title={<>Pick a starting point,<br /><em className="font-medium text-clay">make it yours.</em></>}
        subtitle="Every template is hand-built from email-safe tables, tested for Gmail, Outlook and Apple Mail. Switch layouts anytime without losing your details."
      />

      <div className="sticky top-[57px] z-20 -mx-4 mb-8 border-y border-line bg-paper/90 px-4 py-3 backdrop-blur md:-mx-10 md:px-10 lg:top-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input className="input pl-9" placeholder="Search templates" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <button className="absolute right-2 top-1/2 -translate-y-1/2 text-faint" onClick={() => setQ('')}><X size={14} /></button>}
          </div>
          <div className="scroll-thin -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 pb-0.5">
            {CATEGORIES.map((c) => <button key={c} className="chip shrink-0" data-on={cat === c} onClick={() => setCat(c)}>{c}</button>)}
          </div>
          <div className="flex gap-2">
            <button className="chip" data-on={animatedOnly} onClick={() => setAnimatedOnly(!animatedOnly)}><Sparkles size={13} /> Animated</button>
            {me && <button className="chip" data-on={mine} onClick={() => setMine(!mine)}>Use my details</button>}
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="py-20 text-center text-muted">No templates match — try another category.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((t, i) => {
            const html = renderSignature(build(t, TEMPLATES.indexOf(t)), { campaigns })
            return (
              <article key={t.id} className="card group flex animate-rise flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-lift" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="relative flex h-[230px] items-center overflow-hidden border-b border-line bg-white px-5">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,#e7e0d4_1px,transparent_0)] [background-size:16px_16px] opacity-60" />
                  <div className="relative w-full"><SigThumb html={html} max={0.82} maxH={196} /></div>
                  <div className="absolute inset-x-0 bottom-0 flex translate-y-full justify-center gap-2 bg-gradient-to-t from-white via-white/95 to-transparent p-4 pt-10 transition duration-300 group-hover:translate-y-0">
                    <button className="btn btn-line btn-sm" onClick={() => setPreview(t)}><Eye size={14} /> Preview</button>
                    <button className="btn btn-ink btn-sm" onClick={() => use(t)}>Use template <ArrowRight size={14} /></button>
                  </div>
                </div>
                <div className="flex flex-1 items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="h-display text-lg">{t.name}</h3>
                      {t.pro && <span className="tag bg-butter-soft text-[#8a6410]">PRO</span>}
                      {t.animated && <span className="tag bg-clay-soft text-clay-ink"><Sparkles size={10} /> Animated</span>}
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{t.tagline}</p>
                  </div>
                  <div className="flex shrink-0 -space-x-1.5 pt-1">
                    {[t.design.primary, t.design.accent].map((c, k) => <span key={k} className="size-5 rounded-full border-2 border-surface" style={{ background: c }} />)}
                  </div>
                </div>
              </article>
            )
          })}
          <button onClick={() => use(TEMPLATES.find((t) => t.id === 'minimal')!)} className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line-2 p-6 text-center transition hover:border-ink hover:bg-surface">
            <span className="h-display text-2xl">Start from blank</span>
            <span className="mt-1 text-sm text-muted">A minimal canvas you can restyle completely.</span>
          </button>
        </div>
      )}

      <PreviewModal t={preview} onClose={() => setPreview(null)} onUse={use} build={build} />
    </>
  )
}

function PreviewModal({ t, onClose, onUse, build }: { t: TemplateMeta | null; onClose: () => void; onUse: (t: TemplateMeta) => void; build: (t: TemplateMeta, i: number) => ReturnType<typeof signatureFromTemplate> }) {
  const { campaigns } = useStore()
  const [anim, setAnim] = useState(true)
  if (!t) return null
  const s = build(t, TEMPLATES.indexOf(t))
  s.extras.animations = anim && t.animated
  return (
    <Modal open onClose={onClose} title={t.name} subtitle={t.tagline} width={820}
      footer={<><button className="btn btn-line" onClick={onClose}>Close</button><button className="btn btn-clay" onClick={() => onUse(t)}>Use this template <ArrowRight size={15} /></button></>}>
      <div className={clsx('overflow-x-auto rounded-xl border border-line bg-white p-8')}>
        <SignatureHTML html={renderSignature(s, { campaigns })} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {t.animated && <Toggle on={anim} onChange={setAnim} label="Play animations" desc="Hover the icons and links too" />}
        <div className="rounded-xl border border-line bg-paper/50 px-3.5 py-3 text-sm">
          <span className="eyebrow">Best for</span>
          <div className="mt-1 font-medium">{t.categories.join(' · ')}</div>
        </div>
      </div>
    </Modal>
  )
}
