import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowRight, ChevronDown, LayoutGrid, Menu, Megaphone, Palette, ShieldCheck, Sparkles, Users, X, BookOpen, Mail, Zap } from 'lucide-react'
import clsx from 'clsx'
import { Logo } from '../components/Layout'
import { drawPhotoFrame, type PhotoEffect } from '../lib/motion'

// ---------- real platform logos ----------

export const PLATFORMS = [
  { name: 'Microsoft 365', src: 'https://img.icons8.com/color/96/office-365.png' },
  { name: 'Outlook', src: 'https://img.icons8.com/color/96/microsoft-outlook-2019.png' },
  { name: 'Gmail', src: 'https://img.icons8.com/color/96/gmail-new.png' },
  { name: 'Google Workspace', src: 'https://img.icons8.com/color/96/google-logo.png' },
  { name: 'Apple Mail', src: 'https://img.icons8.com/color/96/apple-mail.png' },
  { name: 'Microsoft Entra ID', src: 'https://img.icons8.com/color/96/microsoft.png' },
]

export function PlatformLogo({ name, src, size = 28 }: { name: string; src: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2.5 font-semibold text-ink-3">
      <img src={src} width={size} height={size} alt="" loading="lazy" />
      {name}
    </span>
  )
}

// ---------- scroll reveal ----------

export function Reveal({ children, delay = 0, className, as: Tag = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'section' | 'li' }) {
  const ref = useRef<HTMLElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect() } }, { rootMargin: '0px 0px -8% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={clsx('reveal', on && 'is-in', className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  )
}

// ---------- live motion preview (canvas, same renderer as the GIF engine) ----------

const imageCache = new Map<string, Promise<HTMLImageElement | null>>()
function displayImage(src: string) {
  // Display-only: no crossOrigin, so hosts without CORS still draw (we never read pixels back).
  if (!imageCache.has(src))
    imageCache.set(src, new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src }))
  return imageCache.get(src)!
}

export function MotionAvatar({ effect, photo, size = 160, primary = '#0f766e', accent = '#e2643b', initials = 'IK', greeting = 'Hi!' }: {
  effect: PhotoEffect; photo?: string; size?: number; primary?: string; accent?: string; initials?: string; greeting?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let raf = 0
    let img: HTMLImageElement | null = null
    let live = true
    if (photo) displayImage(photo).then((i) => { if (live) img = i })
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const S = Math.round(size * dpr)
    const start = performance.now()
    const loop = (now: number) => {
      drawPhotoFrame(ctx, { photo: img, initials, effect, primary, accent, shape: 'circle', greeting, bg: '#ffffff' }, ((now - start) / 2200) % 1, S)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { live = false; cancelAnimationFrame(raf) }
  }, [effect, photo, size, primary, accent, initials, greeting])
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1)
  return <canvas ref={ref} width={Math.round(size * dpr)} height={Math.round(size * dpr)} style={{ width: size, height: size }} className="rounded-2xl" />
}

// ---------- layout ----------

const PRODUCT = [
  { to: '/features', icon: Sparkles, title: 'Features', body: 'Designer, templates, motion and brand kit' },
  { to: '/showcase', icon: LayoutGrid, title: 'Template showcase', body: '41 designs, 7 animated photo effects' },
  { to: '/microsoft-365', icon: Users, title: 'Microsoft 365 sync', body: 'Import and auto-sync your directory' },
  { to: '/features#campaigns', icon: Megaphone, title: 'Banners & campaigns', body: 'Promote events in every email' },
  { to: '/features#brand', icon: Palette, title: 'Brand kit', body: 'One source of truth for every signature' },
  { to: '/security', icon: ShieldCheck, title: 'Security & compliance', body: 'ISO 27001, SOC 2, Privacy Act, GDPR' },
]

const RESOURCES = [
  { to: '/blog', icon: BookOpen, title: 'Blog', body: 'Guides on signatures, branding and email' },
  { to: '/contact', icon: Mail, title: 'Book a demo', body: 'See Inkwell with your own branding' },
]

function Mega({ label, items }: { label: string; items: typeof PRODUCT }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="flex items-center gap-1 py-2 text-[14.5px] font-medium text-ink-3 transition hover:text-ink" onClick={() => setOpen(!open)} aria-expanded={open}>
        {label} <ChevronDown size={14} className={clsx('transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2">
          <div className={clsx('card grid animate-rise gap-1 p-2 shadow-pop', items.length > 3 ? 'w-[560px] grid-cols-2' : 'w-[300px]')}>
            {items.map(({ to, icon: Icon, title, body }) => (
              <Link key={to + title} to={to} className="group flex gap-3 rounded-xl p-3 transition hover:bg-paper" onClick={() => setOpen(false)}>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-clay-soft text-clay-ink transition group-hover:bg-clay group-hover:text-white"><Icon size={17} /></span>
                <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted">{body}</span></span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobile, setMobile] = useState(false)
  const loc = useLocation()
  useEffect(() => setMobile(false), [loc.pathname])
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={clsx('sticky top-0 z-40 transition', scrolled ? 'border-b border-line/80 bg-paper/85 backdrop-blur-md' : 'border-b border-transparent')}>
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-5 py-3.5">
        <Link to="/"><Logo /></Link>
        <nav className="hidden items-center gap-7 lg:flex">
          <Mega label="Product" items={PRODUCT} />
          <NavLink to="/showcase" className="text-[14.5px] font-medium text-ink-3 hover:text-ink">Templates</NavLink>
          <NavLink to="/microsoft-365" className="text-[14.5px] font-medium text-ink-3 hover:text-ink">Microsoft 365</NavLink>
          <NavLink to="/pricing" className="text-[14.5px] font-medium text-ink-3 hover:text-ink">Pricing</NavLink>
          <Mega label="Resources" items={RESOURCES} />
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
          <Link to="/contact" className="btn btn-line btn-sm">Book a demo</Link>
          <Link to="/signup" className="btn btn-ink btn-sm">Start free</Link>
        </div>
        <button className="btn btn-ghost btn-icon lg:hidden" onClick={() => setMobile(!mobile)} aria-label="Menu">{mobile ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
      {mobile && (
        <div className="animate-fade border-t border-line bg-paper px-5 pb-6 pt-3 lg:hidden">
          {[...PRODUCT, ...RESOURCES, { to: '/pricing', title: 'Pricing' }].map((i) => (
            <Link key={i.to + i.title} to={i.to} className="block border-b border-line py-3 text-[15px] font-medium">{i.title}</Link>
          ))}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link to="/login" className="btn btn-line">Sign in</Link>
            <Link to="/signup" className="btn btn-ink">Start free</Link>
          </div>
        </div>
      )}
    </header>
  )
}

function Footer() {
  const col = (title: string, links: [string, string][]) => (
    <div>
      <div className="eyebrow !text-paper/45">{title}</div>
      <ul className="mt-4 space-y-2.5">{links.map(([label, to]) => <li key={label}><Link to={to} className="text-sm text-paper/70 transition hover:text-paper">{label}</Link></li>)}</ul>
    </div>
  )
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto max-w-[1200px] px-5 pb-10 pt-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-paper/60">Email signatures your whole company is proud to send — designed once, synced from Microsoft 365, consistent everywhere.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {['ISO 27001', 'SOC 2', 'Privacy Act', 'GDPR'].map((b) => <span key={b} className="rounded-md border border-paper/15 px-2 py-1 text-[11px] font-semibold text-paper/70">{b}</span>)}
            </div>
          </div>
          {col('Product', [['Features', '/features'], ['Templates', '/showcase'], ['Motion signatures', '/features#motion'], ['Pricing', '/pricing']])}
          {col('Works with', [['Microsoft 365', '/microsoft-365'], ['Outlook', '/microsoft-365'], ['Gmail', '/features#install'], ['Apple Mail', '/features#install']])}
          {col('Resources', [['Blog', '/blog'], ['Security', '/security'], ['Book a demo', '/contact']])}
          {col('Company', [['Sign in', '/login'], ['Start free', '/signup'], ['Terms', '/terms'], ['Privacy', '/privacy']])}
        </div>
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-paper/10 pt-6 text-xs text-paper/45">
          <span>© {new Date().getFullYear()} Inkwell by IT Together Pty Ltd · Data hosted in Sydney, Australia</span>
          <span>Microsoft, Outlook, Gmail and Apple Mail are trademarks of their respective owners.</span>
        </div>
      </div>
    </footer>
  )
}

export function MarketingLayout({ children }: { children?: ReactNode }) {
  const loc = useLocation()
  useEffect(() => {
    if (loc.hash) document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
    else window.scrollTo({ top: 0 })
  }, [loc.pathname, loc.hash])
  return (
    <div className="min-h-screen">
      <Header />
      <main>{children ?? <Outlet />}</main>
      <Footer />
    </div>
  )
}

// ---------- shared sections ----------

export function SectionHead({ eyebrow, title, body, center }: { eyebrow: string; title: ReactNode; body?: ReactNode; center?: boolean }) {
  return (
    <Reveal className={clsx('max-w-2xl', center && 'mx-auto text-center')}>
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="h-display mt-3 text-[34px] leading-[1.08] md:text-[46px]">{title}</h2>
      {body && <p className="mt-4 text-[16.5px] leading-relaxed text-muted">{body}</p>}
    </Reveal>
  )
}

export function CtaBand() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-20">
      <Reveal className="relative overflow-hidden rounded-[32px] bg-ink px-8 py-14 text-center text-paper md:px-16">
        <div className="blob absolute -left-20 -top-20 size-72 rounded-full bg-clay/30 blur-3xl" />
        <div className="blob absolute -bottom-24 -right-16 size-80 rounded-full bg-pine/40 blur-3xl" style={{ animationDelay: '-6s' }} />
        <div className="relative">
          <Zap className="mx-auto text-butter" />
          <h2 className="h-display mx-auto mt-4 max-w-2xl text-[34px] leading-tight md:text-[48px]">Your next email could look like this.</h2>
          <p className="mx-auto mt-4 max-w-lg text-paper/65">Create your workspace, connect Microsoft 365 and roll out on-brand signatures to everyone — in about five minutes.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="btn btn-clay h-12 px-6 text-[15px]">Start free <ArrowRight size={17} /></Link>
            <Link to="/contact" className="btn h-12 border border-paper/25 px-6 text-[15px] text-paper hover:bg-paper/10">Book a demo</Link>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

export function PageHero({ eyebrow, title, body, children }: { eyebrow: string; title: ReactNode; body: ReactNode; children?: ReactNode }) {
  return (
    <section className="mesh relative overflow-hidden">
      <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-16 md:pt-24">
        <div className="max-w-3xl animate-rise">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="h-display mt-4 text-[42px] leading-[1.03] md:text-[62px]">{title}</h1>
          <p className="mt-5 max-w-2xl text-[17.5px] leading-relaxed text-muted">{body}</p>
        </div>
        {children}
      </div>
    </section>
  )
}
