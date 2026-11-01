import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import clsx from 'clsx'

// ---------- toast ----------

const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([])
  const push = useCallback((msg: string) => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, msg }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 2600)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((t) => (
          <div key={t.id} className="flex animate-rise items-center gap-2.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-paper shadow-pop">
            <span className="grid size-5 place-items-center rounded-full bg-clay"><Check size={12} strokeWidth={3} /></span>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------- modal ----------

export function Modal({ open, onClose, title, subtitle, children, width = 560, footer }: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  width?: number
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 animate-fade bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="card relative flex max-h-[90vh] w-full animate-rise flex-col overflow-hidden shadow-pop" style={{ maxWidth: width }}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="h-display text-xl">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <button className="btn btn-ghost btn-sm btn-icon -mr-2" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="scroll-thin overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line bg-paper/60 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// ---------- signature rendering ----------

export function SignatureHTML({ html, className }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

/** Renders a signature at natural size, then scales it down to fit its container. */
export function SigThumb({ html, max = 1, maxH, className, align = 'center' }: { html: string; max?: number; maxH?: number; className?: string; align?: 'center' | 'left' }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ scale: 1, h: 0, w: 0 })

  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return
      const avail = outer.current.clientWidth
      const natW = inner.current.scrollWidth
      const natH = inner.current.scrollHeight
      const scale = Math.min(max, avail / Math.max(natW, 1), maxH ? maxH / Math.max(natH, 1) : Infinity)
      setBox({ scale, h: natH * scale, w: natW * scale })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (outer.current) ro.observe(outer.current)
    if (inner.current) ro.observe(inner.current)
    // remote images change height after load
    inner.current?.querySelectorAll('img').forEach((img) => img.addEventListener('load', measure, { once: true }))
    return () => ro.disconnect()
  }, [html, max, maxH])

  return (
    // The natural-size render is absolutely positioned so it never widens its container (grids, mobile).
    <div ref={outer} className={clsx('relative w-full min-w-0 overflow-hidden', className)} style={{ height: box.h || undefined }}>
      <div
        ref={inner}
        className="sig-thumb absolute left-0 top-0 w-max"
        style={{ transform: `scale(${box.scale})`, marginLeft: align === 'center' ? `calc(50% - ${box.w / 2}px)` : 0 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

// ---------- small bits ----------

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="animate-rise">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="h-display text-[34px] leading-[1.05] md:text-[40px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

export function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-surface px-3.5 py-3 text-left transition hover:border-line-2">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {desc && <span className="block text-xs text-muted">{desc}</span>}
      </span>
      <span className={clsx('relative h-[22px] w-[38px] shrink-0 rounded-full transition', on ? 'bg-pine' : 'bg-line-2')}>
        <span className={clsx('absolute top-[3px] size-4 rounded-full bg-white shadow transition-all', on ? 'left-[19px]' : 'left-[3px]')} />
      </span>
    </button>
  )
}

export function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Field label={label}>
      <div className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line-2 bg-surface pl-1.5 pr-2 focus-within:border-ink">
        <span className="relative size-7 shrink-0 overflow-hidden rounded-md border border-black/10" style={{ background: value }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
        </span>
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent font-mono text-[13px] uppercase outline-none" />
      </div>
    </Field>
  )
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-clay-soft text-clay-ink">{icon}</div>
      <h3 className="h-display text-xl">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Avatar({ name, photo, size = 32 }: { name: string; photo?: string; size?: number }) {
  const ini = name.split(' ').map((p) => p[0]).slice(0, 2).join('')
  const hues = ['#e2643b', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#0369a1']
  const bg = hues[name.length % hues.length]
  return photo ? (
    <img src={photo} alt="" className="shrink-0 rounded-full object-cover ring-2 ring-surface" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-surface" style={{ width: size, height: size, background: bg, fontSize: size * 0.38 }}>{ini}</span>
  )
}

