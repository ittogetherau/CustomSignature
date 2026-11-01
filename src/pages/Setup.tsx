import { Logo } from '../components/Layout'

/** Shown when the build has no Supabase credentials, instead of a blank crash. */
export default function Setup() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
      <Logo />
      <h1 className="h-display mt-8 text-3xl">Connect a database</h1>
      <p className="mt-2 text-muted">Inkwell needs a Supabase project. Add these environment variables, then restart or redeploy:</p>
      <pre className="mt-5 rounded-xl bg-ink p-4 font-mono text-sm text-paper/85">VITE_SUPABASE_URL=https://xxxx.supabase.co{'\n'}VITE_SUPABASE_ANON_KEY=eyJ…</pre>
      <p className="mt-4 text-sm text-muted">Locally: put them in <code className="rounded bg-paper-2 px-1">.env.local</code>. On Vercel: Project → Settings → Environment Variables.</p>
    </div>
  )
}
