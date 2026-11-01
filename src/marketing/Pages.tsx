import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Clock, KeyRound, Loader2, Lock, MailCheck, Server, ShieldCheck, Sparkles, UserCheck, Database, EyeOff } from 'lucide-react'
import clsx from 'clsx'
import { renderSignature } from '../lib/render'
import { CATEGORIES, TEMPLATES, signatureFromTemplate } from '../lib/templates'
import { PHOTO_EFFECTS } from '../lib/motion'
import { supabase } from '../lib/supabase'
import { Field, SigThumb } from '../components/ui'
import { MicrosoftLogo } from '../pages/Auth'
import { CtaBand, MotionAvatar, PLATFORMS, PageHero, PlatformLogo, Reveal, SectionHead } from './kit'
import { POSTS, fmtDate, postBySlug } from './posts'

// ---------- Features ----------

function Split({ id, eyebrow, title, body, points, visual, flip }: { id?: string; eyebrow: string; title: ReactNode; body: string; points: string[]; visual: ReactNode; flip?: boolean }) {
  return (
    <section id={id} className="mx-auto grid max-w-[1200px] scroll-mt-24 items-center gap-12 px-5 py-16 lg:grid-cols-2">
      <div className={clsx(flip && 'lg:order-2')}>
        <SectionHead eyebrow={eyebrow} title={title} body={body} />
        <Reveal delay={100}><ul className="mt-6 space-y-3 text-[15px]">{points.map((p) => <li key={p} className="flex gap-3"><Check size={18} className="mt-0.5 shrink-0 text-pine" /> {p}</li>)}</ul></Reveal>
      </div>
      <Reveal delay={120} className={clsx(flip && 'lg:order-1')}>{visual}</Reveal>
    </section>
  )
}

function SigCard({ id, k = 0 }: { id: string; k?: number }) {
  const html = useMemo(() => renderSignature(signatureFromTemplate(id, {}, k)), [id, k])
  return <div className="card overflow-hidden bg-white p-6 shadow-lift"><SigThumb html={html} align="left" /></div>
}

export function Features() {
  const banner = useMemo(() => {
    const s = signatureFromTemplate('spotlight', {}, 2)
    return renderSignature(s)
  }, [])
  return (
    <>
      <PageHero eyebrow="Features" title={<>Everything you need to make<br />email a brand channel.</>} body="A designer people enjoy using, templates that look great everywhere, animation that reaches the inbox, and the controls IT and Legal need to keep it all consistent." />
      <Split eyebrow="Designer" title="Design in minutes, not meetings." body="Pick a template, then tweak details, images, socials, style, motion and extras with a live preview in a real inbox frame." points={['41 templates across corporate, creative and industry styles', 'Desktop, mobile and dark-mode inbox previews', 'Autosave, duplicate, download HTML, copy with one click']} visual={<SigCard id="aurora" k={0} />} />
      <Split id="motion" flip eyebrow="Motion" title="Eleven ways to stand out." body="Animated GIF effects for your photo, plus an animated call-to-action, verified badge and social icons — rendered for you and hosted on fast storage." points={['Plays in Gmail, Outlook web & Mac, Apple Mail and mobile', 'First frame is a finished design for Outlook desktop', 'Lightweight files with a shared colour palette']} visual={<div className="card grid grid-cols-3 gap-3 bg-white p-6 shadow-lift">{PHOTO_EFFECTS.slice(0, 6).map((e, k) => <div key={e.id} className="text-center"><MotionAvatar effect={e.id} photo={`https://randomuser.me/api/portraits/${k % 2 ? 'men' : 'women'}/${[44, 32, 68, 75, 12, 46][k]}.jpg`} size={96} /><div className="mt-1 text-xs font-semibold">{e.name}</div></div>)}</div>} />
      <Split id="brand" eyebrow="Brand kit" title="One source of truth." body="Upload your logo, set colours, fonts, socials and legal text once. Every team signature is generated from it — change it and everyone updates." points={['Match colours straight from your logo', 'Default template for new starters', 'Legal disclaimers appended automatically']} visual={<SigCard id="c-split-icons" k={3} />} />
      <Split id="campaigns" flip eyebrow="Banners & campaigns" title="Every email, a placement." body="Promote webinars, case studies and launches with banners scheduled by date and targeted by department." points={['Gradient, dark, light or image banners', 'Start and end dates — nothing left running by accident', 'Show to everyone or specific departments']} visual={<div className="card overflow-hidden bg-white p-6 shadow-lift"><SigThumb html={banner} align="left" /></div>} />
      <Split id="install" eyebrow="Install anywhere" title="Works with every mail app." body="Copy as rich text, download the HTML, or follow step-by-step guides. Team signatures are generated for everyone at once." points={['Gmail, Outlook (web, Mac, Windows), Apple Mail, iPhone', 'Email-safe table HTML with inline styles', 'Hosted images so pictures always load']} visual={<div className="card flex flex-wrap items-center justify-center gap-8 bg-white p-10 shadow-lift">{PLATFORMS.map((p) => <PlatformLogo key={p.name} {...p} size={40} />)}</div>} />
      <CtaBand />
    </>
  )
}

// ---------- Microsoft 365 ----------

export function Microsoft365() {
  const steps = [
    ['Sign in with Microsoft', 'Your workspace is created and linked to your Microsoft 365 tenant — no passwords to manage.'],
    ['Approve once', 'A 365 admin clicks “Approve for my organisation” on Microsoft’s own consent screen. Not an admin? Send IT the link.'],
    ['Directory imports', 'Names, titles, departments, phones and photos come in. Guests, disabled and shared mailboxes are skipped.'],
    ['Nightly auto-sync', 'Starters added, role changes updated, leavers flagged — every night, with nobody logged in.'],
  ]
  return (
    <>
      <PageHero eyebrow="Microsoft 365 integration" title={<>Your directory,<br />on brand automatically.</>} body="Connect Microsoft Entra ID and every employee gets a consistent signature — kept up to date as people join, move and leave.">
        <div className="mt-8 flex flex-wrap gap-3"><Link to="/signup" className="btn btn-clay h-12 px-6"><MicrosoftLogo /> Connect Microsoft 365</Link><Link to="/contact" className="btn btn-line h-12 px-6">Book a demo</Link></div>
      </PageHero>
      <section className="mx-auto max-w-[1200px] px-5 py-20">
        <SectionHead eyebrow="How it works" title="Four steps. About five minutes." />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, b], k) => (
            <Reveal key={t} delay={k * 90} className="card relative p-6">
              <span className="h-display text-[54px] leading-none text-clay/25">0{k + 1}</span>
              <h3 className="mt-2 text-[17px] font-semibold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="border-y border-line bg-surface/60 py-20">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-5 lg:grid-cols-3">
          {[
            { icon: EyeOff, t: 'Read-only by design', b: 'Inkwell requests permission to read your user directory — nothing more. It never sends mail, reads mailboxes or changes Microsoft 365.' },
            { icon: UserCheck, t: 'Verified tenant linking', b: 'A workspace can only connect to the Microsoft tenant its admin actually signed in from, so no one can pull another company’s directory.' },
            { icon: Clock, t: 'Revoke anytime', b: 'Remove access in Microsoft Entra ID → Enterprise applications whenever you like. Inkwell shows the change immediately.' },
          ].map(({ icon: Icon, t, b }, k) => (
            <Reveal key={t} delay={k * 80}><Icon className="text-pine" /><h3 className="h-display mt-4 text-xl">{t}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{b}</p></Reveal>
          ))}
        </div>
      </section>
      <CtaBand />
    </>
  )
}

// ---------- Showcase ----------

export function Showcase() {
  const [cat, setCat] = useState('All')
  const list = TEMPLATES.filter((t) => cat === 'All' || t.categories.includes(cat))
  return (
    <>
      <PageHero eyebrow="Template showcase" title={<>{TEMPLATES.length} designs.<br />Endless combinations.</>} body="Every template is built from email-safe tables and adapts to your logo, colours and photo. Animated templates use real GIFs that play in the inbox." />
      <section className="mx-auto max-w-[1200px] px-5 pb-10">
        <div className="mb-8 flex flex-wrap gap-2">{CATEGORIES.map((c) => <button key={c} className="chip" data-on={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t, k) => (
            <Reveal key={t.id} delay={(k % 3) * 60}>
              <div className="card group overflow-hidden transition hover:-translate-y-1 hover:shadow-lift">
                <div className="flex h-[210px] items-center bg-white px-5"><SigThumb html={renderSignature(signatureFromTemplate(t.id, {}, k))} max={0.82} maxH={180} /></div>
                <div className="flex items-center justify-between border-t border-line p-4">
                  <div><div className="h-display text-lg">{t.name}</div><div className="text-xs text-muted">{t.tagline}</div></div>
                  {t.animated && <span className="tag shrink-0 bg-clay-soft text-clay-ink"><Sparkles size={10} /> Animated</span>}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      <CtaBand />
    </>
  )
}

// ---------- Pricing ----------

export function Pricing() {
  const all = ['All 41 templates, including animated', 'Motion GIF effects, buttons, badges & icons', 'Microsoft 365 directory sync (nightly)', 'Unlimited signatures & team members', 'Banners & campaign scheduling', 'Brand kit, legal disclaimers, roles & invites', 'CSV import and HTML export', 'Email support from IT Together']
  return (
    <>
      <PageHero eyebrow="Pricing" title={<>Free while in<br />early access.</>} body="Every feature, every user. Join now and lock in founding-customer pricing when paid plans launch." />
      <section className="mx-auto grid max-w-[1000px] gap-6 px-5 pb-16 md:grid-cols-2">
        <Reveal className="card relative overflow-hidden p-8 shadow-lift">
          <span className="tag absolute right-6 top-6 bg-pine-soft text-pine">Available now</span>
          <div className="eyebrow">Early access</div>
          <div className="mt-3 flex items-baseline gap-2"><span className="h-display text-6xl">$0</span><span className="text-muted">per user</span></div>
          <p className="mt-2 text-sm text-muted">Full product, no credit card.</p>
          <ul className="mt-6 space-y-2.5 text-sm">{all.map((f) => <li key={f} className="flex gap-2.5"><Check size={16} className="mt-0.5 shrink-0 text-pine" /> {f}</li>)}</ul>
          <Link to="/signup" className="btn btn-ink mt-8 h-11 w-full">Start free</Link>
        </Reveal>
        <Reveal delay={100} className="card relative overflow-hidden bg-ink p-8 text-paper">
          <div className="eyebrow !text-butter">Enterprise & MSP</div>
          <div className="h-display mt-3 text-4xl">Let’s talk</div>
          <p className="mt-2 text-sm text-paper/65">For larger organisations and managed service providers rolling Inkwell out across many tenants.</p>
          <ul className="mt-6 space-y-2.5 text-sm text-paper/80">{['Guided rollout and template design', 'Multi-tenant management for MSPs', 'Custom domain and branding', 'Security review and documentation', 'Priority support'].map((f) => <li key={f} className="flex gap-2.5"><Check size={16} className="mt-0.5 shrink-0 text-butter" /> {f}</li>)}</ul>
          <Link to="/contact" className="btn btn-clay mt-8 h-11 w-full">Book a demo</Link>
        </Reveal>
      </section>
      <section className="mx-auto max-w-3xl px-5 pb-10 text-center text-sm text-muted">A “user” is any mailbox that needs a signature. Shared and room mailboxes imported from Microsoft 365 are skipped automatically.</section>
      <CtaBand />
    </>
  )
}

// ---------- Security ----------

export function Security() {
  const blocks = [
    { icon: ShieldCheck, t: 'Certified operator', b: 'Inkwell is built and operated by IT Together, an ISO 27001 certified and SOC 2 audited organisation.' },
    { icon: Server, t: 'Australian data residency', b: 'Workspace data and hosted images are stored in Sydney (AWS ap-southeast-2) on SOC 2 Type II certified infrastructure.' },
    { icon: Database, t: 'Tenant isolation', b: 'Every table is protected by row-level security. Each workspace can only ever read and write its own data.' },
    { icon: KeyRound, t: 'Modern authentication', b: 'Sign in with Microsoft or email. Sessions use short-lived tokens; server secrets never reach the browser.' },
    { icon: EyeOff, t: 'Least privilege with Microsoft 365', b: 'Read-only directory access granted by your admin. No mailbox access, no sending, no changes to your tenant.' },
    { icon: Lock, t: 'Privacy by default', b: 'No open-tracking pixels. Optional link-click analytics store approximate location only — never IP addresses. Handled in line with the Privacy Act (APPs) and GDPR principles.' },
  ]
  return (
    <>
      <PageHero eyebrow="Security & compliance" title={<>Trust is a feature.<br />We built it in.</>} body="How Inkwell protects your organisation’s data, from where it lives to who can see it.">
        <div className="mt-8 flex flex-wrap gap-3">{['ISO 27001', 'SOC 2', 'Privacy Act (APPs)', 'GDPR aligned', 'Microsoft Partner'].map((b) => <span key={b} className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-surface px-3.5 py-1.5 text-sm font-semibold"><ShieldCheck size={15} className="text-pine" /> {b}</span>)}</div>
      </PageHero>
      <section className="mx-auto grid max-w-[1200px] gap-5 px-5 py-16 md:grid-cols-2 lg:grid-cols-3">
        {blocks.map(({ icon: Icon, t, b }, k) => (
          <Reveal key={t} delay={(k % 3) * 80} className="card p-7"><Icon className="text-clay" /><h3 className="h-display mt-4 text-xl">{t}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{b}</p></Reveal>
        ))}
      </section>
      <section className="mx-auto max-w-3xl px-5 pb-16 text-center">
        <p className="text-muted">Need our security documentation, a data processing agreement or answers for a vendor questionnaire?</p>
        <Link to="/contact" className="btn btn-ink mt-5">Contact our team</Link>
      </section>
    </>
  )
}

// ---------- Blog ----------

export function Blog() {
  const [first, ...rest] = POSTS
  return (
    <>
      <PageHero eyebrow="Blog" title="Guides for better email." body="Practical advice on signatures, branding, Microsoft 365 and compliance — from the team behind Inkwell." />
      <section className="mx-auto max-w-[1200px] px-5 pb-20">
        <Reveal>
          <Link to={`/blog/${first.slug}`} className="card group grid overflow-hidden transition hover:shadow-lift md:grid-cols-2">
            <div className="flex min-h-64 items-center justify-center" style={{ background: `linear-gradient(130deg, ${first.cover.from}, ${first.cover.to})` }}>
              <div className="rounded-3xl bg-white p-3 shadow-pop transition duration-500 group-hover:scale-105"><MotionAvatar effect={first.cover.effect} size={130} primary={first.cover.from} accent={first.cover.to} /></div>
            </div>
            <div className="flex flex-col justify-center p-8">
              <div className="text-xs font-semibold text-clay-ink">{first.tag} · {first.readMins} min read</div>
              <h2 className="h-display mt-3 text-3xl leading-tight">{first.title}</h2>
              <p className="mt-3 text-muted">{first.excerpt}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold">Read article <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span>
            </div>
          </Link>
        </Reveal>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {rest.map((p, k) => (
            <Reveal key={p.slug} delay={(k % 2) * 80}>
              <Link to={`/blog/${p.slug}`} className="card group flex h-full overflow-hidden transition hover:-translate-y-1 hover:shadow-lift">
                <div className="flex w-36 shrink-0 items-center justify-center" style={{ background: `linear-gradient(150deg, ${p.cover.from}, ${p.cover.to})` }}><div className="rounded-2xl bg-white p-1.5"><MotionAvatar effect={p.cover.effect} size={70} primary={p.cover.from} accent={p.cover.to} /></div></div>
                <div className="p-5">
                  <div className="text-xs font-semibold text-clay-ink">{p.tag} · {p.readMins} min</div>
                  <h3 className="h-display mt-1.5 text-lg leading-snug">{p.title}</h3>
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted">{p.excerpt}</p>
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

/** Tiny renderer for the article markup in posts.ts. */
function Article({ body }: { body: string }) {
  const blocks = body.split(/\n\s*\n/)
  const inline = (t: string) => t.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part)
  return (
    <div className="prose-ink">
      {blocks.map((b, i) => {
        const lines = b.trim().split('\n')
        if (b.startsWith('## ')) return <h2 key={i}>{b.slice(3)}</h2>
        if (b.startsWith('### ')) return <h3 key={i}>{b.slice(4)}</h3>
        if (b.startsWith('> ')) return <blockquote key={i}>{inline(b.slice(2))}</blockquote>
        if (lines.every((l) => l.startsWith('- '))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>
        if (lines.every((l) => /^\d+\. /.test(l))) return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+\. /, ''))}</li>)}</ol>
        return <p key={i}>{inline(b)}</p>
      })}
    </div>
  )
}

export function BlogPost() {
  const { slug = '' } = useParams()
  const post = postBySlug(slug)
  if (!post) return <Navigate to="/blog" replace />
  const more = POSTS.filter((p) => p.slug !== slug).slice(0, 2)
  return (
    <>
      <section className="mesh">
        <div className="mx-auto max-w-3xl px-5 pb-12 pt-14">
          <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft size={15} /> All articles</Link>
          <div className="mt-6 text-xs font-semibold text-clay-ink">{post.tag} · {post.readMins} min read · {fmtDate(post.date)}</div>
          <h1 className="h-display mt-3 text-[38px] leading-[1.08] md:text-[52px]">{post.title}</h1>
          <p className="mt-4 text-lg text-muted">{post.excerpt}</p>
        </div>
      </section>
      <article className="mx-auto max-w-3xl px-5 py-12"><Article body={post.body} /></article>
      <section className="mx-auto max-w-3xl px-5 pb-16">
        <div className="rounded-3xl bg-ink p-8 text-paper">
          <div className="h-display text-2xl">Put this into practice in five minutes.</div>
          <p className="mt-2 text-sm text-paper/65">Create on-brand, animated signatures for your whole team — free during early access.</p>
          <Link to="/signup" className="btn btn-clay mt-5">Start free <ArrowRight size={15} /></Link>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {more.map((p) => <Link key={p.slug} to={`/blog/${p.slug}`} className="card p-5 transition hover:shadow-lift"><div className="text-xs font-semibold text-clay-ink">{p.tag}</div><div className="h-display mt-1.5 text-lg leading-snug">{p.title}</div></Link>)}
        </div>
      </section>
    </>
  )
}

// ---------- Contact / demo ----------

export function Contact() {
  const [f, setF] = useState({ name: '', email: '', company: '', users: '', platform: 'Microsoft 365', message: '' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.from('leads').insert({ name: f.name.trim(), email: f.email.trim(), company: f.company.trim(), users: f.users, platform: f.platform, message: f.message.trim(), source: 'contact' })
    setBusy(false)
    if (error) return setErr('Something went wrong sending your request. Please email hello@ittogether.com.au instead.')
    setDone(true)
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  return (
    <section className="mesh">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-16 md:py-24 lg:grid-cols-2">
        <div className="animate-rise">
          <div className="eyebrow">Book a demo</div>
          <h1 className="h-display mt-4 text-[44px] leading-[1.04] md:text-[58px]">See Inkwell with<br />your own branding.</h1>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-muted">A 20-minute walkthrough tailored to your organisation: we’ll mock up your signature, show the Microsoft 365 sync and answer security questions.</p>
          <ul className="mt-8 space-y-3 text-[15px]">{['Your logo and colours on real templates', 'Live Microsoft 365 directory sync', 'Rollout plan for your team size', 'Security & compliance Q&A'].map((t) => <li key={t} className="flex gap-3"><Check size={18} className="mt-0.5 text-pine" /> {t}</li>)}</ul>
        </div>
        <div className="card p-7 shadow-pop">
          {done ? (
            <div className="py-10 text-center">
              <MailCheck className="mx-auto text-pine" size={36} />
              <h2 className="h-display mt-4 text-2xl">Thanks — we’ll be in touch.</h2>
              <p className="mt-2 text-sm text-muted">Expect a reply from the IT Together team within one business day.</p>
              <Link to="/signup" className="btn btn-ink mt-6">Or start free now</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name"><input className="input h-11" required value={f.name} onChange={set('name')} /></Field>
              <Field label="Work email"><input className="input h-11" type="email" required value={f.email} onChange={set('email')} /></Field>
              <Field label="Organisation"><input className="input h-11" required value={f.company} onChange={set('company')} /></Field>
              <Field label="Number of users">
                <select className="input h-11" required value={f.users} onChange={set('users')}><option value="" disabled>Choose…</option>{['1–10', '11–50', '51–200', '201–1,000', '1,000+'].map((u) => <option key={u}>{u}</option>)}</select>
              </Field>
              <Field label="Email platform" className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">{['Microsoft 365', 'Google Workspace', 'Other'].map((p) => <button type="button" key={p} className="chip" data-on={f.platform === p} onClick={() => setF({ ...f, platform: p })}>{p}</button>)}</div>
              </Field>
              <Field label="Anything we should know? (optional)" className="sm:col-span-2"><textarea className="input" rows={3} value={f.message} onChange={set('message')} /></Field>
              {err && <p className="text-sm text-[#b91c1c] sm:col-span-2">{err}</p>}
              <button className="btn btn-clay h-12 sm:col-span-2" disabled={busy}>{busy ? <Loader2 className="animate-spin" size={17} /> : <>Request my demo <ArrowRight size={16} /></>}</button>
              <p className="text-xs text-faint sm:col-span-2">We’ll only use your details to arrange the demo. See our <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
