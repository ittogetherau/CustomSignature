import { useEffect, useId, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, ChevronUp, LayoutGrid, LogOut, Megaphone, Menu, Palette, PenLine, Plus, Settings, Users, X, Home } from 'lucide-react'
import clsx from 'clsx'
import { useStore } from '../store'
import { useAuth } from '../auth'

const NAV = [
  { to: '/', label: 'Overview', icon: Home, end: true },
  { to: '/signatures', label: 'My signatures', icon: PenLine },
  { to: '/templates', label: 'Template gallery', icon: LayoutGrid },
  { to: '/team', label: 'Team manager', icon: Users },
  { to: '/campaigns', label: 'Banners & campaigns', icon: Megaphone },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/brand', label: 'Brand kit', icon: Palette },
  { to: '/settings', label: 'Settings', icon: Settings },
]

/** IT Together monogram — the triangular "A" mark, redrawn as a crisp vector. */
/**
 * Inkwell mark: a fountain-pen nib pointing up, so it doubles as IT Together's peak.
 * IT Together blue badge, Inkwell clay ink drop.
 */
export function InkwellMark({ size = 32 }: { size?: number }) {
  // Unique per instance: a gradient inside a hidden copy (e.g. the collapsed sidebar) would blank the others.
  const id = `inkwell-badge-${useId().replace(/:/g, '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b7bea" />
          <stop offset="1" stopColor="#0f3f8f" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <path d="M16 5.5 L23 18.2 Q23.6 20.6 21.2 22 L10.8 22 Q8.4 20.6 9 18.2 Z" fill="#ffffff" />
      <rect x="11" y="23.6" width="10" height="3" rx="1.2" fill="#ffffff" />
      <path d="M16 8.5 V15" stroke="#1450ad" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16" cy="17" r="2.1" fill="#e2643b" />
    </svg>
  )
}

/** Product lockup: Inkwell, endorsed "by IT Together". */
export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <InkwellMark size={34} />
      <span className="flex flex-col justify-center">
        <span className={clsx('h-display text-[22px] leading-[1]', light ? 'text-paper' : 'text-ink')}>Inkwell</span>
        {!compact && (
          <span className={clsx('mt-[5px] text-[9.5px] font-bold uppercase leading-none tracking-[0.18em]', light ? 'text-paper/60' : 'text-muted')}>
            by <span className={light ? 'text-[#8ab8ff]' : 'text-[#1a6ad8]'}>IT Together</span>
          </span>
        )}
      </span>
    </div>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { org, role, employees, signatures } = useStore()
  const { user, signOut } = useAuth()
  const [menu, setMenu] = useState(false)
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

      <div className="relative mt-auto">
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <div className="absolute bottom-full left-0 right-0 z-20 mb-2 animate-rise rounded-xl border border-paper/10 bg-ink-2 p-1.5 shadow-pop">
              <div className="truncate px-3 py-2 text-xs text-paper/50">{user?.email}</div>
              <button onClick={() => { navigate('/settings'); setMenu(false); onNavigate?.() }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-paper/80 hover:bg-paper/10"><Settings size={15} /> Workspace settings</button>
              <button onClick={() => signOut()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-paper/80 hover:bg-paper/10"><LogOut size={15} /> Sign out</button>
            </div>
          </>
        )}
        <button onClick={() => setMenu(!menu)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-paper/5">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-butter text-sm font-bold text-ink">{(org.name || '?').slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{org.name}</div>
            <div className="truncate text-xs capitalize text-paper/45">{role} · {employees.length} {employees.length === 1 ? 'person' : 'people'}</div>
          </div>
          <ChevronUp size={15} className="text-paper/40" />
        </button>
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
