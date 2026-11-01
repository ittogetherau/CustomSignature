import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, LayoutGrid, Megaphone, Menu, Palette, PenLine, Plus, Sparkles, Users, X, Home } from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../store'

const NAV = [
  { to: '/', label: 'Overview', icon: Home, end: true },
  { to: '/signatures', label: 'My signatures', icon: PenLine },
  { to: '/templates', label: 'Template gallery', icon: LayoutGrid },
  { to: '/team', label: 'Team manager', icon: Users },
  { to: '/campaigns', label: 'Banners & campaigns', icon: Megaphone },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/brand', label: 'Brand kit', icon: Palette },
]

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill={light ? '#f6f2ea' : '#1c1917'} />
        <path d="M7 22c3 0 4-10 7-10s1 8 4 8 3-5 7-5" stroke="#e2643b" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      </svg>
      <span className={clsx('h-display text-[22px] leading-none', light ? 'text-paper' : 'text-ink')}>Inkwell</span>
    </div>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { brand, employees, signatures } = useStore()
  const navigate = useNavigate()
  const outdated = employees.filter((e) => e.status !== 'active').length

  return (
    <div className="flex h-full flex-col bg-ink px-4 pb-4 pt-6 text-paper">
      <div className="px-2"><Logo light /></div>

      <button
        onClick={() => { navigate('/templates'); onNavigate?.() }}
        className="group mt-7 flex items-center justify-between rounded-xl bg-clay px-3.5 py-3 text-left text-sm font-semibold text-white shadow-[inset_0_-2px_0_rgba(0,0,0,.2)] transition hover:bg-clay-ink"
      >
        <span className="flex items-center gap-2"><Plus size={16} strokeWidth={2.6} /> New signature</span>
        <kbd className="rounded bg-black/15 px-1.5 py-0.5 font-mono text-[10px]">N</kbd>
      </button>

      <nav className="mt-6 flex flex-col gap-0.5">
        <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-paper/35">Workspace</div>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition',
                isActive ? 'bg-paper/10 text-paper' : 'text-paper/60 hover:bg-paper/5 hover:text-paper',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute -left-4 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-clay" />}
                <Icon size={17} strokeWidth={isActive ? 2.3 : 1.9} />
                <span className="flex-1">{label}</span>
                {to === '/signatures' && <span className="text-xs text-paper/40">{signatures.length}</span>}
                {to === '/team' && outdated > 0 && <span className="rounded-full bg-butter px-1.5 text-[10px] font-bold text-ink">{outdated}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="rounded-xl border border-paper/10 bg-paper/[0.04] p-3.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold"><Sparkles size={14} className="text-butter" /> Animated signatures</div>
          <p className="mt-1 text-xs leading-relaxed text-paper/55">Glowing photos, floating logos and hover-lift icons are on for Pro templates.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <div className="grid size-9 place-items-center rounded-lg bg-butter text-sm font-bold text-ink">{brand.company.slice(0, 1)}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{brand.company}</div>
            <div className="truncate text-xs text-paper/45">{employees.length} members · Studio plan</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const navigate = useNavigate()
  const isEditor = loc.pathname.startsWith('/editor')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input,textarea,select,[contenteditable]')) return
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) navigate('/templates')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 self-start lg:block"><Sidebar /></aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade bg-ink/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[270px] animate-rise">
            <Sidebar onNavigate={() => setOpen(false)} />
            <button className="absolute right-3 top-5 text-paper/70" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/85 px-4 py-3 backdrop-blur lg:hidden">
          <button className="btn btn-ghost btn-icon" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <Logo />
          <span className="w-[34px]" />
        </header>
        <main key={loc.pathname} className={clsx(isEditor ? '' : 'mx-auto max-w-[1240px] px-4 py-8 md:px-10 md:py-12')}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
