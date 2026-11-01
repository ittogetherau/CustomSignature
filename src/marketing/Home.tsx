import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronDown, Code2, Globe2, Lock, Megaphone, Palette, RefreshCw, Scale, ShieldCheck, Sparkles, TrendingUp, Users, Wrench } from 'lucide-react'
import clsx from 'clsx'
import { renderSignature } from '../lib/render'
import { TEMPLATES, signatureFromTemplate } from '../lib/templates'
import { PHOTO_EFFECTS, type PhotoEffect } from '../lib/motion'
import { SigThumb } from '../components/ui'
import { MicrosoftLogo } from '../pages/Auth'
import { CtaBand, MotionAvatar, PLATFORMS, PlatformLogo, Reveal, SectionHead } from './kit'
import { POSTS, fmtDate } from './posts'

const PEOPLE = [
  { name: 'Priya Nair', title: 'Head of Partnerships', company: 'Northwind', photo: 'https://randomuser.me/api/portraits/women/44.jpg', effect: 'orbit' as PhotoEffect, primary: '#0f766e', accent: '#e2643b' },
  { name: 'Marcus Lee', title: 'Creative Director', company: 'Pixel & Pulse', photo: 'https://randomuser.me/api/portraits/men/32.jpg', effect: 'halo' as PhotoEffect, primary: '#4f46e5', accent: '#06b6d4' },
  { name: 'Elena Garcia', title: 'Managing Partner', company: 'Sterling & Co.', photo: 'https://randomuser.me/api/portraits/women/68.jpg', effect: 'hello' as PhotoEffect, primary: '#be123c', accent: '#fb923c' },
  { name: 'Tom Becker', title: 'Sales Director', company: 'Nimbus', photo: 'https://randomuser.me/api/portraits/men/75.jpg', effect: 'sparkle' as PhotoEffect, primary: '#7c3aed', accent: '#f472b6' },
]

/** The hero product shot: a live, animated signature inside an inbox frame. */
function HeroSignature() {
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % PEOPLE.length), 4200); return () => clearInterval(t) }, [])
  const p = PEOPLE[i]
  return (
    <div className="relative">
      <div className="blob absolute -left-10 top-10 size-64 rounded-full bg-clay/25 blur-3xl" />
      <div className="blob absolute -right-6 bottom-0 size-72 rounded-full bg-pine/25 blur-3xl" style={{ animationDelay: '-5s' }} />
      <div className="card relative overflow-hidden shadow-pop">
        <div className="flex items-center gap-1.5 border-b border-line bg-paper/70 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#ec6a5e]" /><span className="size-2.5 rounded-full bg-[#f4bf4f]" /><span className="size-2.5 rounded-full bg-[#61c554]" />
          <span className="ml-3 text-xs text-muted">Re: Proposal for Q1 rollout</span>
        </div>
        <div className="bg-white px-6 py-6 md:px-8">
          <p className="text-[14px] leading-relaxed text-ink-3">Thanks Jordan — timeline attached. Happy to jump on a call this week.</p>
          <div key={i} className="mt-5 animate-rise">
            <table className="w-full" role="presentation"><tbody><tr>
              <td className="align-middle"><MotionAvatar effect={p.effect} photo={p.photo} size={128} primary={p.primary} accent={p.accent} initials={p.name.split(' ').map((x) => x[0]).join('')} /></td>
              <td className="w-full pl-4 align-middle">
                <div className="flex items-center gap-1.5 text-[19px] font-bold text-ink">{p.name}<span className="grid size-4 place-items-center rounded-full bg-[#1d9bf0] text-white"><Check size={10} strokeWidth={4} /></span></div>
                <div className="text-[13px] text-muted">{p.title}</div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: p.primary }}>{p.company}</div>
                <div className="mt-2 space-y-0.5 text-[12.5px] text-ink-3"><div>+61 2 9000 1234</div><div>{p.name.split(' ')[0].toLowerCase()}@{p.company.toLowerCase().replace(/[^a-z]/g, '')}.com</div></div>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold text-white" style={{ background: `linear-gradient(110deg, ${p.primary}, ${p.accent})` }}>Book a meeting <ArrowRight size={12} /></span>
              </td>
            </tr></tbody></table>
          </div>
        </div>
      </div>
      <div className="floaty absolute -left-8 -top-6 hidden items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 py-2.5 shadow-lift md:flex">
        <MicrosoftLogo size={16} /><div><div className="text-[12px] font-semibold">Synced from Microsoft 365</div><div className="text-[11px] text-muted">48 people · 2 min ago</div></div>
      </div>
      <div className="floaty absolute -bottom-5 right-6 hidden items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 py-2.5 shadow-lift md:flex" style={{ animationDelay: '-2.5s' }}>
        <span className="grid size-6 place-items-center rounded-full bg-pine text-white"><Sparkles size={13} /></span>
        <div className="text-[12px] font-semibold">Animated in Gmail & Outlook</div>
      </div>
    </div>
  )
}

function TemplateMarquee() {
  const items = useMemo(() => {
    const ids = ['aurora', 'c-ring-card', 'executive', 'motion', 'c-split-icons', 'neon', 'c-grid', 'startup', 'c-three-panel', 'realtor', 'c-centered', 'pastel']
    return ids.map((id, k) => renderSignature(signatureFromTemplate(id, {}, k), { still: true }))
  }, [])
  return (
    <div className="relative overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <div className="marquee flex w-max gap-5">
        {[...items, ...items].map((html, k) => (
          <div key={k} className="flex h-[190px] w-[380px] shrink-0 items-center rounded-2xl border border-line bg-white px-5 shadow-card"><SigThumb html={html} max={0.62} maxH={160} /></div>
        ))}
      </div>
    </div>
  )
}

function SyncMock() {
  const rows = [['Sarah Chen', 'Marketing Lead'], ['James Okafor', 'Account Executive'], ['Mia Rossi', 'Product Designer'], ['Liam Patel', 'Customer Success'], ['Ava Thompson', 'HR Partner']]
  const [n, setN] = useState(0)
  useEffect(() => { const t = setInterval(() => setN((x) => (x + 1) % (rows.length + 3)), 700); return () => clearInterval(t) }, [rows.length])
  return (
    <div className="card overflow-hidden shadow-lift">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold"><MicrosoftLogo size={15} /> Microsoft 365 directory</div>
        <span className="flex items-center gap-1.5 rounded-full bg-pine-soft px-2.5 py-0.5 text-xs font-semibold text-pine"><RefreshCw size={11} className={n < rows.length ? 'animate-spin' : ''} /> {n < rows.length ? 'Syncing…' : 'Auto-sync on'}</span>
      </div>
      <div className="divide-y divide-line">
        {rows.map(([name, title], k) => (
          <div key={name} className="flex items-center gap-3 px-5 py-3">
            <img src={`https://randomuser.me/api/portraits/${k % 2 ? 'men' : 'women'}/${[12, 46, 21, 33, 57][k]}.jpg`} alt="" className="size-9 rounded-full object-cover" />
            <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{name}</div><div className="text-xs text-muted">{title}</div></div>
            <span className={clsx('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-all duration-500', k < n ? 'bg-pine-soft text-pine opacity-100' : 'bg-paper-2 text-faint opacity-60')}>
              {k < n ? <><Check size={11} strokeWidth={3} /> On brand</> : 'Waiting'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const FAQ = [
  ['What does Inkwell do?', 'Inkwell lets you design email signatures from 41 professional templates, roll them out to your whole company from Microsoft 365 or a CSV, add banners and animation, and keep everyone consistent from one brand kit.'],
  ['How does the Microsoft 365 integration work?', 'Sign in with Microsoft and a 365 administrator approves read-only directory access once. Inkwell imports names, titles, departments, phones and photos, then re-syncs every night — new starters, changes and leavers are handled automatically.'],
  ['Do animated signatures really work in Outlook and Gmail?', 'Yes. Inkwell renders animation as hosted GIFs, which play in Gmail, Outlook on the web, Outlook for Mac, Apple Mail and mobile apps. Classic Outlook for Windows shows the first frame, so every effect is designed to look finished on frame one.'],
  ['Do you track recipients?', 'We never track email opens — there are no tracking pixels. Workspaces can optionally count link clicks (which link, when, approximate location, device and mail app). IP addresses are never stored, automated link scanners are filtered out, and tracking can be switched off in the brand kit.'],
  ['Where is my data stored?', 'In Sydney, Australia. Inkwell is operated by IT Together, an ISO 27001 and SOC 2 organisation, and handles personal information in line with the Privacy Act and GDPR.'],
  ['How much does it cost?', 'Inkwell is free during early access, with every feature included. Founding customers lock in preferential pricing when paid plans launch.'],
]

export default function Home() {
  const [faq, setFaq] = useState<number | null>(0)
  const thumbs = useMemo(() => ['aurora', 'c-ring-card', 'executive', 'c-split-icons', 'creator', 'c-three-panel'].map((id, k) => ({ id, name: TEMPLATES.find((t) => t.id === id)!.name, html: renderSignature(signatureFromTemplate(id, {}, k), { still: true }) })), [])

  return (
    <>
      {/* hero */}
      <section className="mesh relative overflow-hidden">
        <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 pb-20 pt-14 md:pt-20 lg:grid-cols-[1.05fr_1fr]">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-surface/80 px-3 py-1 text-xs font-semibold text-ink-3 backdrop-blur">
              <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-clay opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-clay" /></span>
              New: animated signatures that play in Outlook & Gmail
            </span>
            <h1 className="h-display mt-6 text-[48px] leading-[0.98] md:text-[72px]">Email signatures<br />that <em className="font-medium text-clay">move</em> people.</h1>
            <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-muted">Design on-brand, animated signatures in minutes, sync your entire team from Microsoft 365, and keep every email consistent and compliant — automatically.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="btn btn-clay h-12 px-6 text-[15px]">Start free <ArrowRight size={17} /></Link>
              <Link to="/signup" className="btn btn-line h-12 px-6 text-[15px]"><MicrosoftLogo /> Sign up with Microsoft</Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] font-medium text-ink-3">
              {['ISO 27001 & SOC 2', 'Hosted in Sydney', 'No tracking pixels'].map((t) => <span key={t} className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-pine" /> {t}</span>)}
            </div>
          </div>
          <Reveal delay={120}><HeroSignature /></Reveal>
        </div>
      </section>

      {/* works with */}
      <section className="border-y border-line bg-surface/70">
        <div className="mx-auto max-w-[1200px] px-5 py-8">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-faint">Works with the tools your team already uses</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {PLATFORMS.map((p) => <PlatformLogo key={p.name} {...p} />)}
          </div>
        </div>
      </section>

      {/* numbers */}
      <section className="mx-auto max-w-[1200px] px-5 py-20">
        <div className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-4">
          {[
            ['41', 'designed templates', 'Corporate, creative and industry layouts'],
            [String(PHOTO_EFFECTS.length), 'animated photo effects', 'Rendered as email-safe GIFs'],
            ['1 click', 'Microsoft 365 approval', 'Then nightly automatic sync'],
            ['0', 'tracking pixels', 'Click analytics without spying on opens'],
          ].map(([n, l, s], k) => (
            <Reveal key={l} delay={k * 80} className="bg-surface p-7">
              <div className="h-display text-[44px] leading-none text-ink">{n}</div>
              <div className="mt-2 text-sm font-semibold">{l}</div>
              <div className="mt-1 text-xs text-muted">{s}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* designer */}
      <section className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 py-12 lg:grid-cols-2">
        <div>
          <SectionHead eyebrow="Designer & templates" title={<>A signature studio,<br />not a form.</>} body="Start from 41 hand-built templates — from minimal reply lines to bold creative cards — then make them yours with your logo, colours, photo, socials and call-to-action. Switch layouts anytime without losing a thing." />
          <Reveal delay={100}>
            <ul className="mt-6 space-y-3 text-[15px]">
              {['Live preview in a real inbox frame — desktop, mobile and dark mode', 'Email-safe table HTML tested in Gmail, Outlook and Apple Mail', 'Copy, download, or install with step-by-step guides'].map((t) => <li key={t} className="flex gap-3"><Check size={18} className="mt-0.5 shrink-0 text-pine" /> {t}</li>)}
            </ul>
            <Link to="/showcase" className="btn btn-ink mt-8">Browse templates <ArrowRight size={15} /></Link>
          </Reveal>
        </div>
        <Reveal delay={120} className="grid grid-cols-2 gap-4">
          {thumbs.map((t, k) => (
            <div key={t.id} className={clsx('card overflow-hidden transition duration-500 hover:-translate-y-1 hover:shadow-lift', k % 2 && 'translate-y-6')}>
              <div className="flex h-[118px] items-center bg-white px-3"><SigThumb html={t.html} maxH={104} /></div>
              <div className="border-t border-line px-3 py-2 text-xs font-semibold">{t.name}</div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* motion */}
      <section id="motion" className="mt-16 bg-ink py-24 text-paper">
        <div className="mx-auto max-w-[1200px] px-5">
          <Reveal className="mx-auto max-w-2xl text-center">
            <div className="eyebrow !text-butter">Motion signatures</div>
            <h2 className="h-display mt-3 text-[36px] leading-[1.06] md:text-[52px]">Animation that actually<br />reaches the inbox.</h2>
            <p className="mt-4 text-[16.5px] text-paper/65">Most inboxes strip CSS animation. Inkwell renders motion as lightweight hosted GIFs — so your photo, button and icons move in Gmail, Outlook and on phones. Every first frame is a finished design for Outlook desktop.</p>
          </Reveal>
          <div className="mt-14 grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-6">
            {PHOTO_EFFECTS.map((e, k) => (
              <Reveal key={e.id} delay={k * 70} className="flex flex-col items-center rounded-3xl border border-paper/10 bg-paper/[0.04] p-4 text-center">
                <MotionAvatar effect={e.id} photo={PEOPLE[k % PEOPLE.length].photo} size={112} primary={PEOPLE[k % PEOPLE.length].primary} accent={PEOPLE[k % PEOPLE.length].accent} />
                <div className="mt-3 text-sm font-semibold">{e.name}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-paper/50">{e.blurb}</div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-12 flex flex-wrap justify-center gap-3 text-[13px] text-paper/70">
            {['Gmail', 'Outlook on the web', 'Outlook for Mac', 'Apple Mail', 'iOS & Android'].map((c) => <span key={c} className="flex items-center gap-1.5 rounded-full border border-paper/15 px-3 py-1"><Check size={13} className="text-butter" /> {c}</span>)}
          </Reveal>
        </div>
      </section>

      {/* M365 */}
      <section className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 py-24 lg:grid-cols-2">
        <Reveal><SyncMock /></Reveal>
        <div>
          <SectionHead eyebrow="Microsoft 365" title={<>Your whole directory.<br />Always up to date.</>} body="Sign in with Microsoft, approve once, and Inkwell imports everyone from Microsoft Entra ID — then keeps them in sync every night. No CSVs, no chasing new starters, no stale job titles." />
          <Reveal delay={100}>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[['One-click admin approval', 'Read-only access, granted on Microsoft’s own screen'], ['Nightly auto-sync', 'Adds starters, updates roles, flags leavers'], ['Profile photos', 'Pulled from 365 and hosted for every mail app'], ['Not an admin?', 'Send IT a ready-made approval link']].map(([t, s]) => (
                <div key={t} className="rounded-2xl border border-line bg-surface p-4"><div className="text-sm font-semibold">{t}</div><div className="mt-1 text-xs text-muted">{s}</div></div>
              ))}
            </div>
            <Link to="/microsoft-365" className="btn btn-ink mt-8">How the sync works <ArrowRight size={15} /></Link>
          </Reveal>
        </div>
      </section>

      {/* showcase marquee */}
      <section className="py-10">
        <div className="mx-auto max-w-[1200px] px-5"><SectionHead center eyebrow="Showcase" title="One brand. Every style." /></div>
        <div className="mt-10"><TemplateMarquee /></div>
      </section>

      {/* teams */}
      <section className="mx-auto max-w-[1200px] px-5 py-24">
        <SectionHead center eyebrow="Built for every team" title="Everyone wins when email is on brand." />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: TrendingUp, t: 'Marketing', b: 'Lock in brand consistency and turn every email into a campaign channel with scheduled, targeted banners.' },
            { icon: Wrench, t: 'IT', b: 'Connect Microsoft 365 once and stop fielding signature tickets. Starters, changes and leavers sync themselves.' },
            { icon: Users, t: 'Sales', b: 'Add “Book a meeting” buttons, verified badges and animated photos that make replies more likely.' },
            { icon: Scale, t: 'Legal & HR', b: 'Keep disclaimers and licence numbers current on every signature. Onboard new hires with zero manual setup.' },
          ].map(({ icon: Icon, t, b }, k) => (
            <Reveal key={t} delay={k * 80} className="card group p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lift">
              <span className="grid size-11 place-items-center rounded-xl bg-clay-soft text-clay-ink transition group-hover:bg-clay group-hover:text-white"><Icon size={20} /></span>
              <h3 className="h-display mt-5 text-xl">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* feature grid */}
      <section className="border-y border-line bg-surface/60 py-24">
        <div className="mx-auto max-w-[1200px] px-5">
          <SectionHead eyebrow="Everything included" title="The details that make it professional." />
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Palette, t: 'Brand kit', b: 'Logo, colours, fonts, socials and legal text in one place. Change it once, update everyone.' },
              { icon: Megaphone, t: 'Banners & campaigns', b: 'Gradient or image banners with start and end dates, targeted by department.' },
              { icon: Sparkles, t: 'Motion effects', b: 'Orbit, halo, shine, sparkle, breathe, “Hi!” and draw-on — plus animated buttons and badges.' },
              { icon: Code2, t: 'Clean HTML', b: 'Inline-styled tables that survive Outlook, Gmail and Apple Mail. Copy or download in one click.' },
              { icon: Globe2, t: 'Hosted images', b: 'Photos and logos served from fast, reliable storage — so they show up in every mail app.' },
              { icon: Lock, t: 'Roles & invites', b: 'Owners, admins and members. Invite colleagues and they join automatically on sign-in.' },
              { icon: TrendingUp, t: 'Click insights', b: 'See which links get clicked, where and on what device — for the whole team or any individual. Scanner clicks filtered out.' },
            ].map(({ icon: Icon, t, b }, k) => (
              <Reveal key={t} delay={(k % 3) * 80} className="bg-surface p-7">
                <Icon size={20} className="text-clay" />
                <h3 className="mt-4 text-[16px] font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{b}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* security */}
      <section className="mx-auto max-w-[1200px] px-5 py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <SectionHead eyebrow="Security & compliance" title={<>Enterprise-grade,<br />from day one.</>} body="Inkwell is built and operated by IT Together. Your data stays in Australia, access is read-only where it touches Microsoft 365, and every workspace is isolated by database-level security." />
          <Reveal delay={100} className="grid grid-cols-2 gap-4">
            {[['ISO 27001', 'Certified information security management'], ['SOC 2', 'Independently audited security controls'], ['Privacy Act', 'Handled in line with the Australian Privacy Principles'], ['GDPR aligned', 'Data access, export and deletion on request']].map(([t, s]) => (
              <div key={t} className="card p-5">
                <ShieldCheck size={22} className="text-pine" />
                <div className="h-display mt-3 text-xl">{t}</div>
                <div className="mt-1 text-xs leading-relaxed text-muted">{s}</div>
              </div>
            ))}
          </Reveal>
        </div>
        <Reveal className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-line bg-surface px-6 py-4 text-sm text-ink-3">
          <span className="flex items-center gap-2"><MicrosoftLogo size={15} /> Microsoft Partner</span>
          <span>🇦🇺 Data hosted in Sydney</span>
          <span>No tracking pixels</span>
          <Link to="/security" className="ml-auto font-semibold text-clay-ink hover:underline">Read about security →</Link>
        </Reveal>
      </section>

      {/* faq */}
      <section className="mx-auto max-w-3xl px-5 py-16">
        <SectionHead center eyebrow="FAQ" title="Questions, answered." />
        <div className="mt-10 divide-y divide-line rounded-3xl border border-line bg-surface">
          {FAQ.map(([q, a], k) => (
            <div key={q}>
              <button className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[15.5px] font-semibold" onClick={() => setFaq(faq === k ? null : k)} aria-expanded={faq === k}>
                {q}<ChevronDown size={18} className={clsx('shrink-0 transition', faq === k && 'rotate-180')} />
              </button>
              <div className={clsx('grid transition-all duration-300', faq === k ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                <div className="overflow-hidden"><p className="px-6 pb-5 text-[15px] leading-relaxed text-muted">{a}</p></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* blog */}
      <section className="mx-auto max-w-[1200px] px-5 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead eyebrow="From the blog" title="Guides for better email." />
          <Link to="/blog" className="btn btn-line">All articles <ArrowRight size={15} /></Link>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {POSTS.slice(0, 3).map((p, k) => (
            <Reveal key={p.slug} delay={k * 80}>
              <Link to={`/blog/${p.slug}`} className="card group block overflow-hidden transition hover:-translate-y-1 hover:shadow-lift">
                <div className="flex h-44 items-center justify-center" style={{ background: `linear-gradient(130deg, ${p.cover.from}, ${p.cover.to})` }}>
                  <div className="rounded-3xl bg-white p-2 shadow-pop transition duration-500 group-hover:scale-105"><MotionAvatar effect={p.cover.effect} size={92} primary={p.cover.from} accent={p.cover.to} initials="IK" /></div>
                </div>
                <div className="p-5">
                  <div className="text-xs font-semibold text-clay-ink">{p.tag} · {p.readMins} min read</div>
                  <h3 className="h-display mt-2 text-lg leading-snug">{p.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{p.excerpt}</p>
                  <div className="mt-3 text-xs text-faint">{fmtDate(p.date)}</div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand />
    </>
  )
}
