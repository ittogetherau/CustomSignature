import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Loader2, MailCheck } from 'lucide-react'
import { useAuth } from '../auth'
import { MS_LOGIN_SCOPES, supabase } from '../lib/supabase'
import { renderSignature } from '../lib/render'
import { signatureFromTemplate } from '../lib/templates'
import { Logo } from '../components/Layout'
import { Field, SigThumb } from '../components/ui'
import { DEFAULT_BRAND } from '../store'
import { Splash } from '../components/Workspace'

export function MicrosoftLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

export async function signInWithMicrosoft(next = '/') {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: { scopes: MS_LOGIN_SCOPES, redirectTo: `${location.origin}${next}` },
  })
  return error
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  const showcase = useMemo(() => {
    const s = signatureFromTemplate('aurora', { fullName: 'Priya Nair', title: 'Head of Partnerships', company: 'Northwind' }, 0)
    return renderSignature(s)
  }, [])
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 md:px-14">
        <Link to="/" className="w-fit"><Logo /></Link>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          <h1 className="h-display animate-rise text-[36px] leading-tight">{title}</h1>
          <p className="mt-2 text-[15px] text-muted">{subtitle}</p>
          <div className="mt-8 animate-rise" style={{ animationDelay: '60ms' }}>{children}</div>
        </div>
        <p className="text-xs text-faint">© {new Date().getFullYear()} Inkwell</p>
      </div>
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(226,100,59,.35),transparent_45%),radial-gradient(circle_at_90%_90%,rgba(15,118,110,.4),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-center px-16">
          <div className="eyebrow !text-paper/50">Every email, on brand</div>
          <p className="h-display mt-3 max-w-md text-[34px] leading-tight text-paper">Signatures your whole company is proud to send.</p>
          <div className="mt-10 max-w-[560px] rotate-[-1.5deg] rounded-2xl bg-white p-7 shadow-pop"><SigThumb html={showcase} align="left" /></div>
          <div className="mt-10 flex items-center gap-3 text-sm text-paper/60"><MicrosoftLogo /> Import your team straight from Microsoft 365</div>
        </div>
      </div>
    </div>
  )
}

function Divider() {
  return <div className="my-6 flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>
}

function ErrorNote({ msg }: { msg: string }) {
  return msg ? <div className="mb-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5 text-sm text-[#991b1b]">{msg}</div> : null
}

export function Login() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const navigate = useNavigate()

  if (loading) return <Splash label="Loading…" />
  if (user) return <Navigate to={next} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) return setErr(error.message)
    navigate(next, { replace: true })
  }

  return (
    <AuthShell title="Welcome back" subtitle={<>New to Inkwell? <Link to="/signup" className="font-semibold text-clay-ink hover:underline">Create an account</Link></>}>
      <ErrorNote msg={err} />
      <button className="btn btn-line h-11 w-full" onClick={async () => { const e = await signInWithMicrosoft(next); if (e) setErr(e.message) }}><MicrosoftLogo /> Continue with Microsoft</button>
      <Divider />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Work email"><input className="input h-11" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password">
          <input className="input h-11" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="flex justify-end"><Link to="/forgot" className="text-xs font-semibold text-muted hover:text-ink">Forgot password?</Link></div>
        <button className="btn btn-ink h-11 w-full" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <>Sign in <ArrowRight size={16} /></>}</button>
      </form>
    </AuthShell>
  )
}

export function Signup() {
  const { user, loading } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)
  const navigate = useNavigate()

  if (loading) return <Splash label="Loading…" />
  if (user) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setErr('Use at least 8 characters for your password.')
    setBusy(true); setErr('')
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: `${location.origin}/onboarding` } })
    setBusy(false)
    if (error) return setErr(error.message)
    if (data.session) navigate('/onboarding', { replace: true })
    else setSent(true)
  }

  if (sent)
    return (
      <AuthShell title="Check your inbox" subtitle={<>We sent a confirmation link to <strong className="text-ink">{email}</strong>.</>}>
        <div className="card flex items-start gap-3 p-4 text-sm text-ink-3"><MailCheck className="shrink-0 text-pine" size={20} /> Click the link in that email to verify your address — you'll land straight in workspace setup.</div>
        <Link to="/login" className="btn btn-line mt-6 w-full">Back to sign in</Link>
      </AuthShell>
    )

  return (
    <AuthShell title="Start free" subtitle={<>Already have an account? <Link to="/login" className="font-semibold text-clay-ink hover:underline">Sign in</Link></>}>
      <ErrorNote msg={err} />
      <button className="btn btn-line h-11 w-full" onClick={async () => { const e = await signInWithMicrosoft('/onboarding'); if (e) setErr(e.message) }}><MicrosoftLogo /> Sign up with Microsoft</button>
      <Divider />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your name"><input className="input h-11" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Work email"><input className="input h-11" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" hint="At least 8 characters"><input className="input h-11" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <button className="btn btn-ink h-11 w-full" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <>Create account <ArrowRight size={16} /></>}</button>
        <p className="text-center text-xs text-faint">By creating an account you agree to the <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
      </form>
    </AuthShell>
  )
}

export function Forgot() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset-password` })
    if (error) return setErr(error.message)
    setSent(true)
  }
  return (
    <AuthShell title="Reset password" subtitle="We'll email you a link to choose a new one.">
      <ErrorNote msg={err} />
      {sent ? (
        <div className="card flex items-start gap-3 p-4 text-sm text-ink-3"><MailCheck className="shrink-0 text-pine" size={20} /> If an account exists for {email}, a reset link is on its way.</div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Work email"><input className="input h-11" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <button className="btn btn-ink h-11 w-full">Send reset link</button>
        </form>
      )}
      <Link to="/login" className="mt-6 block text-center text-sm font-semibold text-muted hover:text-ink">Back to sign in</Link>
    </AuthShell>
  )
}

export function ResetPassword() {
  const { user, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const navigate = useNavigate()
  if (loading) return <Splash label="Loading…" />
  if (!user) return <Navigate to="/forgot" replace />
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setErr('Use at least 8 characters.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return setErr(error.message)
    navigate('/', { replace: true })
  }
  return (
    <AuthShell title="Choose a new password" subtitle="You'll stay signed in afterwards.">
      <ErrorNote msg={err} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password"><input className="input h-11" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <button className="btn btn-ink h-11 w-full">Update password</button>
      </form>
    </AuthShell>
  )
}

export function Onboarding() {
  const { user, loading } = useAuth()
  const domain = user?.email?.split('@')[1] ?? ''
  const guess = domain && !/gmail|outlook|hotmail|yahoo|icloud|live\./i.test(domain) ? domain.split('.')[0].replace(/^\w/, (c) => c.toUpperCase()) : ''
  const [company, setCompany] = useState(guess)
  const [website, setWebsite] = useState(guess ? domain : '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const navigate = useNavigate()

  if (loading) return <Splash label="Loading…" />
  if (!user) return <Navigate to="/signup" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('create_organization', { org_name: company.trim(), org_brand: { ...DEFAULT_BRAND, company: company.trim(), website: website.trim() } })
    setBusy(false)
    if (error) return setErr(error.message)
    navigate('/', { replace: true })
  }

  return (
    <AuthShell title="Set up your workspace" subtitle="This is your company's home for signatures. You can change it any time in Brand kit.">
      <ErrorNote msg={err} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Company name"><input className="input h-11" required autoFocus value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
        <Field label="Company website"><input className="input h-11" placeholder="yourcompany.com" value={website} onChange={(e) => setWebsite(e.target.value)} /></Field>
        <button className="btn btn-clay h-11 w-full" disabled={busy || !company.trim()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <>Create workspace <ArrowRight size={16} /></>}</button>
      </form>
      <button className="mt-6 w-full text-center text-sm text-muted hover:text-ink" onClick={() => supabase.auth.signOut()}>Signed in as {user.email} · Sign out</button>
    </AuthShell>
  )
}
