import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, LayoutGrid, Megaphone, Palette, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { renderSignature } from '../lib/render'
import { TEMPLATES, signatureFromTemplate } from '../lib/templates'
import { Logo } from '../components/Layout'
import { SigThumb } from '../components/ui'
import { MicrosoftLogo } from './Auth'

const SHOWCASE = ['aurora', 'neon', 'executive', 'creator', 'startup', 'pastel']
const PEOPLE = [
  { fullName: 'Priya Nair', title: 'Head of Partnerships', company: 'Northwind' },
  { fullName: 'Marcus Lee', title: 'Creative Director', company: 'Pixel & Pulse' },
  { fullName: 'Elena Garcia', title: 'Managing Partner', company: 'Sterling & Co.' },
  { fullName: 'Aisha Khan', title: 'Content Creator', company: 'Studio Bloom' },
  { fullName: 'Tom Becker', title: 'Co-founder & CEO', company: 'Nimbus' },
  { fullName: 'Sofia Rossi', title: 'Community Lead', company: 'Brightside' },
]

const FEATURES = [
  { icon: LayoutGrid, title: `${TEMPLATES.length} designed templates`, body: 'Corporate, creative, healthcare, legal, real estate — every one hand-built from email-safe tables.' },
  { icon: Sparkles, title: 'Motion that behaves', body: 'Glowing headshots, floating logos and hover-lift icons that fall back gracefully in strict clients.' },
  { icon: Users, title: 'Your whole team in minutes', body: 'Import people from Microsoft 365 or CSV, assign a template, and everyone gets a matching signature.' },
  { icon: Megaphone, title: 'Banners & campaigns', body: 'Turn every email into a placement. Schedule banners and target them by department.' },
  { icon: Palette, title: 'One brand kit', body: 'Logo, colours, fonts, socials and legal text in one place. Change it once, update everyone.' },
  { icon: ShieldCheck, title: 'Deliverability first', body: 'Clean inline HTML, hosted images, no tracking pixels. Tested in Gmail, Outlook and Apple Mail.' },
]

export default function Landing() {
  const [i, setI] = useState(0)
  const slides = useMemo(() => SHOWCASE.map((t, k) => renderSignature(signatureFromTemplate(t, PEOPLE[k], k))), [])
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 3800)
    return () => clearInterval(t)
  }, [slides.length])

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-medium text-ink-3 md:flex">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#microsoft" className="hover:text-ink">Microsoft 365</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
          </nav>
          <div className="flex gap-2">
            <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
            <Link to="/signup" className="btn btn-ink btn-sm">Start free</Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-[1180px] items-center gap-12 px-5 pb-20 pt-14 md:pt-20 lg:grid-cols-[1fr_1.1fr]">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-surface px-3 py-1 text-xs font-semibold text-ink-3"><span className="size-1.5 rounded-full bg-clay" /> Email signature management for teams</span>
          <h1 className="h-display mt-5 text-[46px] leading-[1.02] md:text-[64px]">Every email,<br /><em className="font-medium text-clay">signed with intent.</em></h1>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-muted">Design beautiful, animated email signatures and roll them out to your entire company — straight from Microsoft 365. Consistent, compliant and on-brand in every inbox.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="btn btn-clay h-12 px-6 text-[15px]">Start free <ArrowRight size={17} /></Link>
            <Link to="/signup" className="btn btn-line h-12 px-6 text-[15px]"><MicrosoftLogo /> Sign up with Microsoft</Link>
          </div>
          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-3">
            {['No credit card', 'Works with Outlook & Gmail', 'Set up in 5 minutes'].map((t) => <li key={t} className="flex items-center gap-1.5"><Check size={15} className="text-pine" /> {t}</li>)}
          </ul>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[36px] bg-[radial-gradient(circle_at_30%_20%,#fbe6dc,transparent_60%),radial-gradient(circle_at_80%_80%,#d7efe9,transparent_55%)]" />
          <div className="card overflow-hidden shadow-pop">
            <div className="flex items-center gap-1.5 border-b border-line bg-paper/60 px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-[#ec6a5e]" /><span className="size-2.5 rounded-full bg-[#f4bf4f]" /><span className="size-2.5 rounded-full bg-[#61c554]" />
              <span className="ml-3 text-xs text-muted">New message</span>
            </div>
            <div className="bg-white px-7 py-6">
              <div className="space-y-1 border-b border-line pb-3 text-sm text-muted"><div>To: <span className="text-ink">jordan@client.com</span></div><div>Subject: <span className="text-ink">Kick-off next week</span></div></div>
              <p className="mt-4 text-[14px] leading-relaxed text-ink-3">Hi Jordan — looking forward to it. Agenda attached.</p>
              <div className="mt-5 min-h-[190px]">
                <div key={i} className="animate-rise"><SigThumb html={slides[i]} align="left" /></div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-center gap-1.5">
            {slides.map((_, k) => <button key={k} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-ink' : 'w-1.5 bg-line-2'}`} aria-label={`Show template ${k + 1}`} />)}
          </div>
        </div>
      </section>

      {/* features */}
      <section id="features" className="border-y border-line bg-surface/60 py-20">
        <div className="mx-auto max-w-[1180px] px-5">
          <div className="eyebrow">Features</div>
          <h2 className="h-display mt-2 max-w-2xl text-[36px] leading-tight md:text-[44px]">Everything you need to make email a brand channel.</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-surface p-7">
                <span className="grid size-10 place-items-center rounded-xl bg-clay-soft text-clay-ink"><Icon size={19} /></span>
                <h3 className="h-display mt-5 text-xl">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* microsoft */}
      <section id="microsoft" className="mx-auto max-w-[1180px] px-5 py-20">
        <div className="overflow-hidden rounded-3xl bg-ink p-8 text-paper md:p-14">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-paper/70"><MicrosoftLogo size={18} /> Microsoft 365 integration</div>
              <h2 className="h-display mt-4 text-[34px] leading-tight md:text-[42px]">Bring your whole directory in one click.</h2>
              <p className="mt-4 max-w-md text-paper/65">Sign in with your work account and your admin approves access with one click. Inkwell imports names, titles, departments, phones and photos from Microsoft Entra ID — then keeps everyone in sync automatically, every day.</p>
              <Link to="/signup" className="btn btn-clay mt-7 h-11 px-5">Connect Microsoft 365 <ArrowRight size={16} /></Link>
            </div>
            <ol className="space-y-3">
              {['Sign in with Microsoft', 'Admin approves with one click', 'Your whole directory imports', 'New starters & changes sync daily'].map((s, k) => (
                <li key={s} className="flex items-center gap-4 rounded-2xl border border-paper/10 bg-paper/[0.04] px-5 py-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-butter text-sm font-bold text-ink">{k + 1}</span>
                  <span className="font-medium">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="mx-auto max-w-[1180px] px-5 pb-24">
        <div className="text-center">
          <div className="eyebrow">Pricing</div>
          <h2 className="h-display mt-2 text-[36px] md:text-[44px]">Free while in early access.</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted">Every feature, unlimited signatures. Lock in founder pricing when paid plans launch.</p>
        </div>
        <div className="mx-auto mt-10 max-w-md card p-8 text-center shadow-lift">
          <div className="h-display text-5xl">$0</div>
          <div className="mt-1 text-sm text-muted">per user · early access</div>
          <ul className="mt-6 space-y-2.5 text-left text-sm">
            {['All templates, including animated', 'Microsoft 365 directory sync', 'Campaign banners & scheduling', 'Brand kit & legal disclaimers', 'CSV bulk import & HTML export'].map((t) => <li key={t} className="flex items-center gap-2.5"><Check size={16} className="text-pine" /> {t}</li>)}
          </ul>
          <Link to="/signup" className="btn btn-ink mt-8 h-11 w-full">Create your workspace</Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-muted">
          <Logo />
          <span className="flex flex-wrap gap-5"><Link to="/terms" className="hover:text-ink">Terms</Link><Link to="/privacy" className="hover:text-ink">Privacy</Link><span>© {new Date().getFullYear()} Inkwell</span></span>
        </div>
      </footer>
    </div>
  )
}
