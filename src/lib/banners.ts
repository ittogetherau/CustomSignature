import * as Lucide from 'lucide'
import { GIFEncoder, applyPalette, quantize } from 'gifenc'

// Campaign banner studio. Every template is drawn on a canvas (illustration + real
// Lucide icons + typography) and exported as a hosted image, so it looks identical in
// every mail app. Text, colours, logo and animation are all dynamic.

export const BW = 600
export const BH = 200

export interface BannerData {
  headline: string
  subline: string
  cta: string
  eyebrow: string
  date: string
  from: string
  to: string
  accent: string
  logo: HTMLImageElement | null
  /** Draw the logo on a white chip (primary logo on a dark design). */
  logoChip?: boolean
  company: string
}

export interface BannerTemplate {
  id: string
  name: string
  category: 'Festive' | 'Content' | 'Events' | 'Business'
  ink: 'light' | 'dark'
  font: 'serif' | 'sans'
  animated: boolean
  defaults: Omit<BannerData, 'logo' | 'company'>
  /** Width available for the copy block on the left. */
  textW?: number
  draw: (g: Painter, d: BannerData, t: number) => void
}

// ---------- painter ----------

type IconNode = [string, Record<string, string | number>, IconNode[]?]

const TAU = Math.PI * 2
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x))

function rgb(hex: string) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const rgba = (hex: string, a: number) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})` }
export const mix = (a: string, b: string, t: number) => {
  const A = rgb(a), B = rgb(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
const luminance = (hex: string) => { const [r, g, b] = rgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
export const onColor = (hex: string) => (luminance(hex) > 0.45 ? '#14110f' : '#ffffff')
/** WCAG contrast ratio between two colours (1–21). */
export const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }

/** Deterministic pseudo-random, so animation frames line up and previews are stable. */
function rng(seed: number) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296 }

export class Painter {
  constructor(public ctx: CanvasRenderingContext2D) {}

  linear(c0: string, c1: string, angle = 0.35, x = 0, y = 0, w = BW, h = BH) {
    const dx = Math.cos(angle) * w, dy = Math.sin(angle) * h
    const g = this.ctx.createLinearGradient(x + w / 2 - dx / 2, y + h / 2 - dy / 2, x + w / 2 + dx / 2, y + h / 2 + dy / 2)
    g.addColorStop(0, c0); g.addColorStop(1, c1)
    this.ctx.fillStyle = g
    this.ctx.fillRect(x, y, w, h)
  }

  glow(x: number, y: number, r: number, color: string, a = 0.5) {
    const g = this.ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0))
    this.ctx.fillStyle = g
    this.ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }

  circle(x: number, y: number, r: number, fill: string) { const c = this.ctx; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill; c.fill() }

  star(x: number, y: number, r: number, fill: string, points = 5, inner = 0.45, rot = -Math.PI / 2) {
    const c = this.ctx
    c.beginPath()
    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 ? r * inner : r
      const a = rot + (i / (points * 2)) * TAU
      c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad)
    }
    c.closePath(); c.fillStyle = fill; c.fill()
  }

  sparkle(x: number, y: number, r: number, fill: string, a = 1) { this.ctx.globalAlpha = a; this.star(x, y, r, fill, 4, 0.25, 0); this.ctx.globalAlpha = 1 }

  /** Draw a Lucide icon (24-unit stroke icon) scaled to `size`. */
  icon(name: string, x: number, y: number, size: number, color: string, width = 2, fill?: string) {
    const node = (Lucide as unknown as Record<string, IconNode>)[name]
    if (!node) return
    const c = this.ctx
    c.save()
    c.translate(x, y)
    c.scale(size / 24, size / 24)
    c.lineWidth = width
    c.strokeStyle = color
    c.lineCap = 'round'
    c.lineJoin = 'round'
    for (const [tag, a] of node[2] ?? []) {
      let p: Path2D | null = null
      const n = (k: string) => Number(a[k] ?? 0)
      if (tag === 'path') p = new Path2D(String(a.d))
      else if (tag === 'circle') { p = new Path2D(); p.arc(n('cx'), n('cy'), n('r'), 0, TAU) }
      else if (tag === 'ellipse') { p = new Path2D(); p.ellipse(n('cx'), n('cy'), n('rx'), n('ry'), 0, 0, TAU) }
      else if (tag === 'rect') { p = new Path2D(); p.roundRect(n('x'), n('y'), n('width'), n('height'), n('rx')) }
      else if (tag === 'line') { p = new Path2D(); p.moveTo(n('x1'), n('y1')); p.lineTo(n('x2'), n('y2')) }
      else if (tag === 'polyline' || tag === 'polygon') {
        p = new Path2D()
        const pts = String(a.points).trim().split(/[\s,]+/).map(Number)
        for (let i = 0; i < pts.length; i += 2) (i ? p.lineTo(pts[i], pts[i + 1]) : p.moveTo(pts[i], pts[i + 1]))
        if (tag === 'polygon') p.closePath()
      }
      if (!p) continue
      if (fill) { c.fillStyle = fill; c.fill(p) }
      c.stroke(p)
    }
    c.restore()
  }

  /** Icon inside a soft round badge. */
  badge(name: string, x: number, y: number, r: number, bg: string, fg: string) {
    this.circle(x, y, r, bg)
    this.icon(name, x - r * 0.55, y - r * 0.55, r * 1.1, fg, 2)
  }

  confetti(seed: number, n: number, colors: string[], t = 0, area = { x: 0, y: 0, w: BW, h: BH }) {
    const r = rng(seed)
    for (let i = 0; i < n; i++) {
      const x = area.x + r() * area.w, y0 = area.y + r() * area.h, s = 2 + r() * 4, rot = r() * TAU
      const y = area.y + ((y0 - area.y + t * area.h * (0.6 + r() * 0.6)) % area.h)
      const c = this.ctx
      c.save(); c.translate(x, y); c.rotate(rot + t * TAU * (r() > 0.5 ? 1 : -1)); c.fillStyle = colors[i % colors.length]
      c.fillRect(-s / 2, -s / 4, s, s / 2); c.restore()
    }
  }

  dots(color: string, gap = 14, r = 1.2, area = { x: 0, y: 0, w: BW, h: BH }) {
    for (let x = area.x + gap / 2; x < area.x + area.w; x += gap) for (let y = area.y + gap / 2; y < area.y + area.h; y += gap) this.circle(x, y, r, color)
  }
}

// ---------- copy block ----------

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (ctx.measureText(test).width <= maxW || !cur) cur = test
    else { lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]
    while (ctx.measureText(`${last}…`).width > maxW && last.length > 1) last = last.slice(0, -1)
    kept[maxLines - 1] = `${last}…`
    return { lines: kept, overflow: true }
  }
  return { lines, overflow: false }
}

const SERIF = 'Fraunces, Georgia, serif'
const SANS = '"DM Sans", Helvetica, Arial, sans-serif'

function drawCopy(g: Painter, d: BannerData, tpl: BannerTemplate, x = 28) {
  const c = g.ctx
  const ink = tpl.ink === 'light' ? '#ffffff' : '#14110f'
  const soft = tpl.ink === 'light' ? 'rgba(255,255,255,0.78)' : 'rgba(20,17,15,0.68)'
  const maxW = tpl.textW ?? 320
  let y = 24

  if (d.logo) {
    const h = 22, w = Math.min(120, (d.logo.width / d.logo.height) * h)
    c.save()
    if (d.logoChip !== false) { c.fillStyle = 'rgba(255,255,255,0.94)'; c.beginPath(); c.roundRect(x - 6, y - 5, w + 12, h + 10, 8); c.fill() }
    c.drawImage(d.logo, x, y, w, h)
    c.restore()
    y += h + 16
  } else y += 4

  if (d.eyebrow) {
    c.font = `700 9.5px ${SANS}`
    const label = d.eyebrow.toUpperCase()
    const w = c.measureText(label).width + c.measureText(' ').width * label.length * 0.2 + 18
    c.fillStyle = tpl.ink === 'light' ? 'rgba(255,255,255,0.16)' : rgba(d.accent, 0.14)
    c.beginPath(); c.roundRect(x, y, w, 19, 10); c.fill()
    c.fillStyle = tpl.ink === 'light' ? '#ffffff' : mix(d.accent, '#000000', 0.25)
    c.textBaseline = 'middle'
    // letter-spaced eyebrow
    let cx = x + 9
    for (const ch of label) { c.fillText(ch, cx, y + 10); cx += c.measureText(ch).width + 1.1 }
    y += 27
  }

  // Headline: two lines max, shrinking to fit.
  const family = tpl.font === 'serif' ? SERIF : SANS
  const weight = tpl.font === 'serif' ? 600 : 800
  let size = d.logo ? 23 : 26
  let fitted = { lines: [d.headline], overflow: false }
  for (; size >= 16; size -= 1) {
    c.font = `${weight} ${size}px ${family}`
    fitted = wrap(c, d.headline, maxW, 2)
    if (!fitted.overflow) break
  }
  c.fillStyle = ink
  c.textBaseline = 'alphabetic'
  fitted.lines.forEach((l, i) => c.fillText(l, x, y + size * 0.92 + i * size * 1.08))
  y += size * 1.08 * fitted.lines.length + 6

  if (d.subline) {
    c.font = `500 12px ${SANS}`
    c.fillStyle = soft
    const s = wrap(c, d.subline, maxW, d.logo ? 1 : 2)
    s.lines.forEach((l, i) => c.fillText(l, x, y + 11 + i * 15))
    y += 15 * s.lines.length + 6
  }

  if (d.date) {
    c.font = `700 11px ${SANS}`
    c.fillStyle = ink
    g.icon('Calendar', x, y + 1, 12, ink, 2.2)
    c.fillText(d.date, x + 17, y + 11)
    y += 18
  }

  if (d.cta) {
    c.font = `700 12px ${SANS}`
    const label = `${d.cta}  →`
    const w = c.measureText(label).width + 28
    const by = Math.min(y + 4, BH - 40)
    c.save()
    c.shadowColor = 'rgba(0,0,0,0.18)'; c.shadowBlur = 8; c.shadowOffsetY = 2
    c.fillStyle = d.accent
    c.beginPath(); c.roundRect(x, by, w, 30, 15); c.fill()
    c.restore()
    c.fillStyle = onColor(d.accent)
    c.textBaseline = 'middle'
    c.fillText(label, x + 14, by + 15.5)
    c.textBaseline = 'alphabetic'
  }
}

// ---------- illustration helpers ----------

function bat(g: Painter, x: number, y: number, s: number, color: string, flap: number) {
  const c = g.ctx
  c.save(); c.translate(x, y); c.scale(s, s * (0.75 + flap * 0.35)); c.fillStyle = color
  c.beginPath()
  c.moveTo(0, -2); c.quadraticCurveTo(-6, -8, -14, -6); c.quadraticCurveTo(-11, -2, -12, 3); c.quadraticCurveTo(-8, 0, -6, 4)
  c.quadraticCurveTo(-3, 1, 0, 5); c.quadraticCurveTo(3, 1, 6, 4); c.quadraticCurveTo(8, 0, 12, 3); c.quadraticCurveTo(11, -2, 14, -6)
  c.quadraticCurveTo(6, -8, 0, -2); c.fill()
  c.beginPath(); c.arc(0, -1, 2.6, 0, TAU); c.fill()
  c.restore()
}

function pumpkin(g: Painter, x: number, y: number, s: number, glow: number) {
  const c = g.ctx
  g.glow(x, y, s * 1.4, '#f97316', 0.25 + glow * 0.15)
  const lobes: [number, number][] = [[-0.55, 0.78], [0.55, 0.78], [-0.25, 0.92], [0.25, 0.92], [0, 1]]
  lobes.forEach(([dx, w], i) => {
    const gr = c.createRadialGradient(x + dx * s - s * 0.2, y - s * 0.25, s * 0.1, x + dx * s, y, s)
    gr.addColorStop(0, '#fdba74'); gr.addColorStop(1, i === 4 ? '#ea580c' : '#c2410c')
    c.fillStyle = gr
    c.beginPath(); c.ellipse(x + dx * s, y, s * 0.42 * w, s * 0.7, 0, 0, TAU); c.fill()
  })
  c.fillStyle = '#3f6212'
  c.beginPath(); c.roundRect(x - s * 0.07, y - s * 0.95, s * 0.14, s * 0.32, 3); c.fill()
  c.fillStyle = `rgba(254,240,138,${0.75 + glow * 0.25})`
  const tri = (ax: number, ay: number, w: number, h: number) => { c.beginPath(); c.moveTo(x + ax * s, y + ay * s - h * s); c.lineTo(x + ax * s - w * s, y + ay * s); c.lineTo(x + ax * s + w * s, y + ay * s); c.closePath(); c.fill() }
  tri(-0.3, -0.05, 0.14, 0.2); tri(0.3, -0.05, 0.14, 0.2)
  c.beginPath()
  c.moveTo(x - s * 0.45, y + s * 0.18)
  for (let i = 0; i <= 6; i++) c.lineTo(x - s * 0.45 + i * s * 0.15, y + s * (i % 2 ? 0.3 : 0.18))
  c.lineTo(x + s * 0.45, y + s * 0.38); c.quadraticCurveTo(x, y + s * 0.55, x - s * 0.45, y + s * 0.38); c.closePath(); c.fill()
}

function tree(g: Painter, x: number, y: number, s: number, t: number) {
  const c = g.ctx
  c.fillStyle = '#7c2d12'; c.fillRect(x - s * 0.08, y + s * 0.85, s * 0.16, s * 0.2)
  const tiers = [[0.85, 0.6], [0.5, 0.48], [0.15, 0.36]]
  tiers.forEach(([ty, w], i) => {
    const gr = c.createLinearGradient(x - s * w, 0, x + s * w, 0)
    gr.addColorStop(0, '#15803d'); gr.addColorStop(1, '#166534')
    c.fillStyle = gr
    c.beginPath(); c.moveTo(x, y + s * (ty - 0.55 - i * 0.02)); c.lineTo(x - s * w, y + s * ty); c.lineTo(x + s * w, y + s * ty); c.closePath(); c.fill()
  })
  const orn = [[-0.3, 0.75, '#ef4444'], [0.25, 0.7, '#facc15'], [-0.1, 0.42, '#38bdf8'], [0.18, 0.38, '#ef4444'], [-0.25, 0.4, '#facc15'], [0.32, 0.8, '#38bdf8'], [0, 0.1, '#fde047']] as const
  orn.forEach(([dx, dy, col], i) => { const tw = 0.6 + 0.4 * Math.sin((t + i / 7) * TAU); g.glow(x + dx * s, y + dy * s, 7, col, 0.5 * tw); g.circle(x + dx * s, y + dy * s, 3.2, col) })
  g.star(x, y - s * 0.45, s * 0.12, '#fde047')
}

function gift(g: Painter, x: number, y: number, w: number, h: number, box: string, ribbon: string) {
  const c = g.ctx
  c.fillStyle = box; c.beginPath(); c.roundRect(x, y, w, h, 4); c.fill()
  c.fillStyle = mix(box, '#000000', 0.15); c.fillRect(x - 3, y, w + 6, h * 0.25)
  c.fillStyle = ribbon; c.fillRect(x + w / 2 - 4, y, 8, h); c.fillRect(x - 3, y + h * 0.08, w + 6, 6)
  c.beginPath(); c.ellipse(x + w / 2 - 8, y - 5, 8, 5, -0.5, 0, TAU); c.ellipse(x + w / 2 + 8, y - 5, 8, 5, 0.5, 0, TAU); c.fill()
}

function snow(g: Painter, t: number, seed = 7, n = 26) {
  const r = rng(seed)
  for (let i = 0; i < n; i++) {
    // Keep the copy side clear so headlines stay readable.
    const x = 350 + r() * (BW - 350), size = 6 + r() * 9, speed = 0.6 + r() * 0.8, sway = r() * TAU
    const y = ((r() * BH + t * BH * speed) % (BH + 20)) - 10
    g.ctx.globalAlpha = 0.35 + r() * 0.55
    g.icon('Snowflake', x + Math.sin(t * TAU + sway) * 6 - size / 2, y - size / 2, size, '#ffffff', 1.6)
  }
  g.ctx.globalAlpha = 1
}

function burst(g: Painter, x: number, y: number, r: number, color: string, p: number) {
  const c = g.ctx
  const rays = 14
  c.save(); c.globalAlpha = clamp(1.2 - p); c.strokeStyle = color; c.lineWidth = 2; c.lineCap = 'round'
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * TAU
    const r0 = r * p * 0.45, r1 = r * p
    c.beginPath(); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); c.stroke()
    g.circle(x + Math.cos(a) * r1, y + Math.sin(a) * r1, 1.6, color)
  }
  c.restore()
}

function diya(g: Painter, x: number, y: number, s: number, flick: number) {
  const c = g.ctx
  g.glow(x, y - s * 0.7, s * 2.2, '#fbbf24', 0.35 + flick * 0.2)
  // flame
  const fh = s * (0.95 + flick * 0.25)
  const fg = c.createLinearGradient(x, y - fh - s * 0.2, x, y - s * 0.15)
  fg.addColorStop(0, '#fef08a'); fg.addColorStop(0.5, '#fb923c'); fg.addColorStop(1, '#dc2626')
  c.fillStyle = fg
  c.beginPath(); c.moveTo(x, y - fh - s * 0.25); c.bezierCurveTo(x + s * 0.35, y - s * 0.7, x + s * 0.25, y - s * 0.15, x, y - s * 0.15); c.bezierCurveTo(x - s * 0.25, y - s * 0.15, x - s * 0.35, y - s * 0.7, x, y - fh - s * 0.25); c.fill()
  // clay bowl
  const bg = c.createLinearGradient(0, y - s * 0.2, 0, y + s * 0.5)
  bg.addColorStop(0, '#d97706'); bg.addColorStop(1, '#7c2d12')
  c.fillStyle = bg
  c.beginPath(); c.moveTo(x - s * 0.95, y - s * 0.1); c.quadraticCurveTo(x, y + s * 0.9, x + s * 0.95, y - s * 0.1); c.quadraticCurveTo(x, y + s * 0.12, x - s * 0.95, y - s * 0.1); c.fill()
  c.fillStyle = '#fbbf24'
  for (let i = -2; i <= 2; i++) g.circle(x + i * s * 0.3, y + s * 0.22 - Math.abs(i) * s * 0.03, 1.6, '#fde68a')
}

function rangoli(g: Painter, x: number, y: number, r: number, colors: string[], rot: number) {
  const c = g.ctx
  colors.forEach((col, ring) => {
    const rr = r * (1 - ring * 0.22)
    const petals = 8 + ring * 2
    c.fillStyle = col
    for (let i = 0; i < petals; i++) {
      const a = rot * (ring % 2 ? -1 : 1) + (i / petals) * TAU
      c.save(); c.translate(x + Math.cos(a) * rr * 0.62, y + Math.sin(a) * rr * 0.62); c.rotate(a)
      c.beginPath(); c.ellipse(0, 0, rr * 0.36, rr * 0.13, 0, 0, TAU); c.fill(); c.restore()
    }
  })
  g.circle(x, y, r * 0.16, '#fde047')
}

function kite(g: Painter, x: number, y: number, s: number, c1: string, c2: string, a: number, t: number) {
  const c = g.ctx
  c.save(); c.translate(x, y); c.rotate(a + Math.sin(t * TAU) * 0.12)
  // string
  c.strokeStyle = 'rgba(60,40,20,0.35)'; c.lineWidth = 1
  c.beginPath(); c.moveTo(0, s * 1.2); c.bezierCurveTo(s * 0.8, s * 2.5, -s * 0.5, s * 3.4, s * 0.6, s * 5); c.stroke()
  // body: four triangles
  const pts = [[0, -s * 1.1], [s * 0.8, 0], [0, s * 1.2], [-s * 0.8, 0]]
  const tri = (i: number, col: string) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, 0); c.lineTo(pts[i][0], pts[i][1]); c.lineTo(pts[(i + 1) % 4][0], pts[(i + 1) % 4][1]); c.closePath(); c.fill() }
  tri(0, c1); tri(1, c2); tri(2, c1); tri(3, c2)
  c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 1
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(pts[2][0], pts[2][1]); c.moveTo(pts[1][0], pts[1][1]); c.lineTo(pts[3][0], pts[3][1]); c.stroke()
  // tail bows
  for (let i = 1; i <= 3; i++) {
    const tx = Math.sin(t * TAU + i) * s * 0.3, ty = s * 1.2 + i * s * 0.55
    c.fillStyle = i % 2 ? c2 : c1
    c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx - s * 0.22, ty - s * 0.12); c.lineTo(tx - s * 0.22, ty + s * 0.12); c.closePath(); c.moveTo(tx, ty); c.lineTo(tx + s * 0.22, ty - s * 0.12); c.lineTo(tx + s * 0.22, ty + s * 0.12); c.closePath(); c.fill()
  }
  c.restore()
}

function lantern(g: Painter, x: number, y: number, s: number, color: string, gold: string, swing: number) {
  const c = g.ctx
  c.save(); c.translate(x, 0); c.rotate(swing * 0.08)
  c.strokeStyle = gold; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, y - s); c.stroke()
  g.glow(0, y, s * 1.8, color, 0.35)
  c.fillStyle = gold; c.fillRect(-s * 0.35, y - s * 1.02, s * 0.7, s * 0.18); c.fillRect(-s * 0.35, y + s * 0.84, s * 0.7, s * 0.18)
  const gr = c.createRadialGradient(-s * 0.3, y - s * 0.3, s * 0.1, 0, y, s)
  gr.addColorStop(0, mix(color, '#ffffff', 0.35)); gr.addColorStop(1, color)
  c.fillStyle = gr; c.beginPath(); c.ellipse(0, y, s * 0.85, s * 0.9, 0, 0, TAU); c.fill()
  c.strokeStyle = rgba(gold, 0.6); c.lineWidth = 1
  for (const k of [-0.45, 0, 0.45]) { c.beginPath(); c.ellipse(0, y, s * 0.85 * Math.abs(k || 0.02) + 0.1, s * 0.9, 0, 0, TAU); c.stroke() }
  c.strokeStyle = gold; c.lineWidth = 1.2
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * s * 0.12, y + s * 1.02); c.lineTo(i * s * 0.14, y + s * 1.45); c.stroke() }
  c.restore()
}

function book(g: Painter, x: number, y: number, w: number, h: number, d: BannerData, tilt: number) {
  const c = g.ctx
  c.save(); c.translate(x, y); c.rotate(tilt)
  c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 18; c.shadowOffsetX = 8; c.shadowOffsetY = 10
  c.fillStyle = '#f5f5f4'; c.fillRect(w * 0.06, 3, w, h - 4)
  c.shadowColor = 'transparent'
  for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#e7e5e4' : '#fafaf9'; c.fillRect(w + w * 0.06 - 2 - i, 4 + i * 0.5, 2, h - 6) }
  const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, d.from); gr.addColorStop(1, d.to)
  c.fillStyle = gr; c.beginPath(); c.roundRect(0, 0, w, h, [2, 6, 6, 2]); c.fill()
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, 0, w * 0.07, h)
  c.fillStyle = 'rgba(255,255,255,0.14)'; c.beginPath(); c.arc(w * 0.8, h * 0.22, w * 0.45, 0, TAU); c.fill()
  const ink = onColor(d.from)
  c.fillStyle = ink
  c.font = `700 ${w * 0.075}px ${SANS}`
  c.fillText((d.company || 'GUIDE').toUpperCase().slice(0, 18), w * 0.14, h * 0.16)
  c.font = `600 ${w * 0.13}px ${SERIF}`
  const t = wrap(c, d.headline, w * 0.76, 4)
  t.lines.forEach((l, i) => c.fillText(l, w * 0.14, h * 0.36 + i * w * 0.15))
  c.fillStyle = d.accent; c.fillRect(w * 0.14, h * 0.86, w * 0.3, 3)
  c.restore()
}

function paperStack(g: Painter, x: number, y: number, w: number, h: number, accent: string) {
  const c = g.ctx
  for (let i = 2; i >= 0; i--) {
    c.save(); c.translate(x + i * 10, y - i * 8); c.rotate(-0.04 + i * 0.04)
    c.shadowColor = 'rgba(0,0,0,0.15)'; c.shadowBlur = 12; c.shadowOffsetY = 4
    c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(0, 0, w, h, 6); c.fill(); c.shadowColor = 'transparent'
    if (i === 0) {
      c.fillStyle = accent; c.fillRect(14, 16, w * 0.4, 6)
      c.fillStyle = '#e7e5e4'
      for (let l = 0; l < 6; l++) c.fillRect(14, 32 + l * 10, w - 28 - (l % 3) * 14, 4)
      const bars = [0.4, 0.65, 0.5, 0.85]
      bars.forEach((b, k) => { c.fillStyle = k === 3 ? accent : rgba(accent, 0.35); c.fillRect(16 + k * 16, h - 18 - b * 34, 10, b * 34) })
    }
    c.restore()
  }
}

function mountains(g: Painter, baseY: number, color: string, peaks: [number, number][]) {
  const c = g.ctx
  c.fillStyle = color
  c.beginPath(); c.moveTo(peaks[0][0] - 60, BH)
  peaks.forEach(([px, py]) => { c.lineTo(px - 40, baseY); c.lineTo(px, py); c.lineTo(px + 40, baseY) })
  c.lineTo(peaks[peaks.length - 1][0] + 80, BH); c.closePath(); c.fill()
  c.fillStyle = 'rgba(255,255,255,0.85)'
  peaks.forEach(([px, py]) => { c.beginPath(); c.moveTo(px, py); c.lineTo(px - 12, py + 16); c.lineTo(px - 4, py + 12); c.lineTo(px, py + 18); c.lineTo(px + 6, py + 12); c.lineTo(px + 12, py + 16); c.closePath(); c.fill() })
}

function laurel(g: Painter, x: number, y: number, r: number, color: string) {
  const c = g.ctx
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI / 2 + side * (0.35 + i * 0.3)
      const lx = x + Math.cos(a) * r, ly = y + Math.sin(a) * r * 0.95
      c.save(); c.translate(lx, ly); c.rotate(a + side * 1.2)
      c.fillStyle = color; c.beginPath(); c.ellipse(0, 0, 7, 3.2, 0, 0, TAU); c.fill(); c.restore()
    }
  }
}

// ---------- templates ----------

const T: BannerTemplate[] = [
  {
    id: 'halloween', name: 'Halloween', category: 'Festive', ink: 'light', font: 'serif', animated: true,
    defaults: { eyebrow: 'Spooky season', headline: 'Treats inside: 30% off all plans this week', subline: 'Offer ends 31 October — no tricks.', cta: 'Claim offer', date: '', from: '#1a0b2e', to: '#4c1d95', accent: '#f97316' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.2)
      g.dots('rgba(255,255,255,0.05)', 16, 1)
      g.glow(470, 60, 120, '#fde68a', 0.35); g.circle(470, 60, 38, '#fef3c7'); g.circle(486, 52, 34, mix(d.from, d.to, 0.5))
      ;[[390, 40, 1.1, 0], [540, 95, 0.8, 0.3], [430, 110, 0.65, 0.6]].forEach(([x, y, s, ph]) => bat(g, x + Math.sin((t + ph) * TAU) * 10, y + Math.cos((t + ph) * TAU) * 6, s, '#0b0614', Math.abs(Math.sin((t * 3 + ph) * TAU))))
      pumpkin(g, 430, 165, 34, Math.abs(Math.sin(t * TAU)))
      pumpkin(g, 520, 175, 24, Math.abs(Math.cos(t * TAU)))
    },
  },
  {
    id: 'christmas', name: 'Christmas', category: 'Festive', ink: 'light', font: 'serif', animated: true,
    defaults: { eyebrow: 'Merry Christmas', headline: "Season's greetings from all of us", subline: 'Our office is closed 24 Dec – 2 Jan. Urgent support stays on.', cta: 'Holiday hours', date: '', from: '#0f3d2e', to: '#14532d', accent: '#dc2626' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.6)
      g.glow(480, 100, 160, '#fde68a', 0.18)
      tree(g, 480, 70, 95, t)
      gift(g, 395, 150, 38, 30, '#dc2626', '#fde047')
      gift(g, 540, 155, 32, 26, '#1d4ed8', '#fde047')
      snow(g, t)
    },
  },
  {
    id: 'newyear', name: 'New Year', category: 'Festive', ink: 'light', font: 'serif', animated: true,
    defaults: { eyebrow: 'Happy New Year', headline: "Here's to a brilliant 2027", subline: 'Thank you for a wonderful year together.', cta: 'Read our recap', date: '', from: '#0b1026', to: '#312e81', accent: '#facc15' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.3)
      g.dots('rgba(255,255,255,0.06)', 18, 1)
      const c = g.ctx
      c.font = `700 120px ${SERIF}`; c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillText('2027', 330, 175)
      ;[[440, 60, 50, '#facc15', 0], [530, 90, 40, '#f472b6', 0.35], [390, 120, 34, '#38bdf8', 0.65]].forEach(([x, y, r, col, ph]) => burst(g, x as number, y as number, r as number, col as string, ((t + (ph as number)) % 1) * 1.1 + 0.15))
      g.confetti(3, 30, ['#facc15', '#f472b6', '#38bdf8', '#ffffff'], t, { x: 330, y: 0, w: 270, h: BH })
    },
  },
  {
    id: 'diwali', name: 'Diwali', category: 'Festive', ink: 'light', font: 'serif', animated: true,
    defaults: { eyebrow: 'Happy Diwali', headline: 'Wishing you light, joy & prosperity', subline: 'May this festival of lights brighten every moment.', cta: 'Send wishes', date: '', from: '#3b0a45', to: '#831843', accent: '#fbbf24' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.4)
      rangoli(g, 490, 78, 70, ['#f97316', '#ec4899', '#facc15', '#a855f7'], t * 0.6)
      ;[[410, 168, 14, 0], [490, 176, 17, 0.33], [570, 168, 14, 0.66]].forEach(([x, y, s, ph]) => diya(g, x, y, s, Math.abs(Math.sin((t * 2 + ph) * TAU))))
      const r = rng(11)
      for (let i = 0; i < 14; i++) { const x = 340 + r() * 260, y = r() * 130, ph = r(); g.sparkle(x, y, 2 + r() * 3, '#fde68a', 0.3 + 0.7 * Math.abs(Math.sin((t + ph) * TAU))) }
    },
  },
  {
    id: 'dashain', name: 'Dashain', category: 'Festive', ink: 'dark', font: 'serif', animated: true,
    defaults: { eyebrow: 'Bijaya Dashami', headline: 'Happy Dashain! May victory and joy be yours', subline: 'Warm wishes to you and your family this festive season.', cta: 'Our message', date: '', from: '#fef3c7', to: '#fdba74', accent: '#b91c1c' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 1.3)
      g.glow(520, 40, 120, '#ffffff', 0.5)
      mountains(g, 170, rgba(mix(d.to, '#7c2d12', 0.55), 0.55), [[430, 112], [500, 96], [570, 118]])
      kite(g, 420 + Math.sin(t * TAU) * 6, 52, 18, '#dc2626', '#facc15', -0.2, t)
      kite(g, 505, 40 + Math.cos(t * TAU) * 5, 14, '#2563eb', '#ffffff', 0.25, t + 0.3)
      kite(g, 565 + Math.sin((t + 0.5) * TAU) * 5, 78, 11, '#16a34a', '#f97316', 0.1, t + 0.6)
      // marigold garland
      const c = g.ctx
      c.strokeStyle = 'rgba(120,53,15,0.4)'; c.lineWidth = 1
      c.beginPath(); c.moveTo(340, 0); c.quadraticCurveTo(470, 34, 600, 0); c.stroke()
      for (let i = 0; i <= 16; i++) { const u = i / 16, x = 340 + u * 260, y = 2 * (1 - u) * u * 34 + 2; g.circle(x, y, 5.5, i % 3 === 0 ? '#facc15' : '#f97316'); g.circle(x, y, 2, '#b45309') }
    },
  },
  {
    id: 'holi', name: 'Holi', category: 'Festive', ink: 'dark', font: 'serif', animated: true,
    defaults: { eyebrow: 'Happy Holi', headline: 'Celebrate the festival of colours', subline: 'Wishing you a vibrant season full of joy.', cta: 'Say hello', date: '', from: '#fff7ed', to: '#fdf4ff', accent: '#db2777' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.3)
      const blobs: [number, number, number, string][] = [[440, 70, 70, '#ec4899'], [530, 120, 64, '#facc15'], [470, 160, 50, '#22c55e'], [560, 40, 46, '#3b82f6'], [390, 140, 40, '#a855f7'], [580, 170, 36, '#f97316']]
      blobs.forEach(([x, y, r, col], i) => { const p = 1 + 0.06 * Math.sin((t + i / 6) * TAU); g.glow(x, y, r * p, col, 0.75) })
      g.confetti(5, 40, ['#ec4899', '#facc15', '#22c55e', '#3b82f6', '#a855f7'], t, { x: 340, y: 0, w: 260, h: BH })
    },
  },
  {
    id: 'eid', name: 'Eid Mubarak', category: 'Festive', ink: 'light', font: 'serif', animated: true,
    defaults: { eyebrow: 'Eid Mubarak', headline: 'Wishing you peace, joy and blessings', subline: 'From all of us, Eid Mubarak to you and your loved ones.', cta: 'Our message', date: '', from: '#064e3b', to: '#0f766e', accent: '#fbbf24' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.5)
      const r = rng(4)
      for (let i = 0; i < 24; i++) g.sparkle(r() * BW, r() * BH, 1 + r() * 2, '#fde68a', 0.3 + 0.6 * Math.abs(Math.sin((t + r()) * TAU)))
      g.glow(500, 70, 90, '#fde68a', 0.3); g.circle(500, 70, 36, '#fde68a'); g.circle(516, 62, 32, mix(d.from, d.to, 0.6)); g.star(548, 56, 8, '#fde68a')
      lantern(g, 410, 110, 16, '#f59e0b', '#fde68a', Math.sin(t * TAU))
      lantern(g, 580, 140, 13, '#0ea5e9', '#fde68a', Math.sin((t + 0.4) * TAU))
    },
  },
  {
    id: 'lunar', name: 'Lunar New Year', category: 'Festive', ink: 'light', font: 'serif', animated: true,
    defaults: { eyebrow: 'Lunar New Year', headline: 'Wishing you good fortune and prosperity', subline: 'Happy New Year from our team to yours.', cta: 'Read more', date: '', from: '#7f1d1d', to: '#b91c1c', accent: '#fbbf24' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.4)
      const c = g.ctx
      c.strokeStyle = 'rgba(251,191,36,0.18)'; c.lineWidth = 1.5
      for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(500, 210, 40 + i * 26, Math.PI, TAU); c.stroke() }
      lantern(g, 420, 72, 20, '#dc2626', '#fbbf24', Math.sin(t * TAU))
      lantern(g, 500, 110, 26, '#ef4444', '#fbbf24', Math.sin((t + 0.3) * TAU))
      lantern(g, 575, 64, 17, '#dc2626', '#fbbf24', Math.sin((t + 0.6) * TAU))
    },
  },
  {
    id: 'blackfriday', name: 'Black Friday', category: 'Festive', ink: 'light', font: 'sans', animated: true,
    defaults: { eyebrow: 'Black Friday', headline: 'Our biggest sale of the year', subline: 'Every plan, every add-on — this weekend only.', cta: 'Shop the sale', date: '27 – 30 Nov', from: '#0a0a0a', to: '#1c1917', accent: '#facc15' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.3)
      const c = g.ctx
      c.save(); c.globalAlpha = 0.08; c.fillStyle = d.accent
      for (let i = -4; i < 20; i++) { c.beginPath(); c.moveTo(330 + i * 26, 0); c.lineTo(350 + i * 26, 0); c.lineTo(270 + i * 26, BH); c.lineTo(250 + i * 26, BH); c.fill() }
      c.restore()
      const pulse = 0.7 + 0.3 * Math.sin(t * TAU)
      c.save(); c.shadowColor = d.accent; c.shadowBlur = 24 * pulse
      c.font = `900 92px ${SANS}`; c.fillStyle = d.accent; c.fillText('-50%', 345, 135); c.restore()
      g.icon('Tag', 520, 140, 34, d.accent, 2)
    },
  },
  {
    id: 'ebook', name: 'eBook', category: 'Content', ink: 'dark', font: 'serif', animated: false,
    defaults: { eyebrow: 'Free eBook', headline: 'The 2026 guide to email signatures', subline: 'Best practices, examples and templates in one download.', cta: 'Download free', date: '', from: '#0f766e', to: '#0e7490', accent: '#e2643b' },
    draw(g, d) {
      g.linear(mix(d.from, '#ffffff', 0.9), mix(d.to, '#ffffff', 0.82), 0.4)
      g.dots(rgba(d.from, 0.12), 14, 1.2, { x: 360, y: 0, w: 240, h: BH })
      g.glow(480, 100, 130, d.from, 0.18)
      book(g, 425, 28, 98, 140, d, 0.06)
      g.badge('BookOpen', 548, 160, 18, '#ffffff', d.from)
    },
  },
  {
    id: 'whitepaper', name: 'Whitepaper', category: 'Content', ink: 'dark', font: 'serif', animated: false,
    defaults: { eyebrow: 'Whitepaper', headline: 'Security in the hybrid workplace', subline: 'Independent research on protecting distributed teams.', cta: 'Read the report', date: '', from: '#1e3a8a', to: '#3b82f6', accent: '#1e3a8a' },
    draw(g, d) {
      g.linear('#f8fafc', mix(d.to, '#ffffff', 0.86), 0.5)
      g.glow(490, 100, 140, d.to, 0.18)
      paperStack(g, 420, 40, 120, 140, d.to)
      g.badge('FileText', 560, 46, 20, d.from, '#ffffff')
    },
  },
  {
    id: 'casestudy', name: 'Case study', category: 'Content', ink: 'light', font: 'serif', animated: true,
    defaults: { eyebrow: 'Customer story', headline: 'How Northwind grew replies by 42%', subline: 'A 3-minute read on turning email into a brand channel.', cta: 'Read the story', date: '', from: '#0f172a', to: '#0f766e', accent: '#34d399' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.5)
      const c = g.ctx
      const bars = [0.35, 0.5, 0.45, 0.68, 0.9]
      bars.forEach((b, i) => {
        const grow = clamp(t * 1.6 - i * 0.12 + 0.6)
        const h = b * 120 * (0.5 + 0.5 * grow)
        c.fillStyle = i === bars.length - 1 ? d.accent : 'rgba(255,255,255,0.18)'
        c.beginPath(); c.roundRect(390 + i * 34, 175 - h, 22, h, 5); c.fill()
      })
      c.font = `700 40px ${SERIF}`; c.fillStyle = '#ffffff'; c.fillText('+42%', 470, 60)
      g.icon('TrendingUp', 430, 28, 30, d.accent, 2.4)
    },
  },
  {
    id: 'webinar', name: 'Webinar', category: 'Content', ink: 'light', font: 'sans', animated: true,
    defaults: { eyebrow: 'Live webinar', headline: 'Email as a brand channel', subline: 'Practical playbook with live Q&A.', cta: 'Save my seat', date: '20 Nov · 11am AEDT', from: '#111827', to: '#4f46e5', accent: '#f43f5e' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.3)
      const c = g.ctx
      c.save(); c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 18; c.fillStyle = '#1f2937'; c.beginPath(); c.roundRect(390, 34, 180, 112, 12); c.fill(); c.restore()
      const gr = c.createLinearGradient(390, 34, 570, 146); gr.addColorStop(0, rgba(d.to, 0.6)); gr.addColorStop(1, rgba(d.accent, 0.4))
      c.fillStyle = gr; c.beginPath(); c.roundRect(396, 40, 168, 100, 8); c.fill()
      const p = 1 + 0.08 * Math.sin(t * TAU)
      g.circle(480, 90, 22 * p, 'rgba(255,255,255,0.95)')
      c.fillStyle = d.to; c.beginPath(); c.moveTo(474, 79); c.lineTo(474, 101); c.lineTo(492, 90); c.closePath(); c.fill()
      c.fillStyle = '#ef4444'; c.beginPath(); c.roundRect(404, 48, 44, 16, 8); c.fill()
      g.circle(413, 56, 3 * (0.6 + 0.4 * Math.abs(Math.sin(t * TAU * 2))), '#ffffff')
      c.font = `800 9px ${SANS}`; c.fillStyle = '#ffffff'; c.fillText('LIVE', 420, 59.5)
      ;['#f59e0b', '#22c55e', '#38bdf8'].forEach((col, i) => { g.circle(420 + i * 18, 166, 10, '#ffffff'); g.circle(420 + i * 18, 166, 8.5, col) })
      c.font = `600 11px ${SANS}`; c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillText('+ 240 registered', 470, 170)
    },
  },
  {
    id: 'podcast', name: 'Podcast', category: 'Content', ink: 'light', font: 'sans', animated: true,
    defaults: { eyebrow: 'New episode', headline: 'The IT leadership podcast — Ep. 12', subline: 'Scaling support without scaling headcount.', cta: 'Listen now', date: '', from: '#581c87', to: '#be185d', accent: '#fde047' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.4)
      g.glow(470, 100, 120, '#ffffff', 0.12)
      g.circle(470, 100, 52, 'rgba(255,255,255,0.14)'); g.circle(470, 100, 40, 'rgba(255,255,255,0.95)')
      g.icon('Mic', 450, 80, 40, d.from, 2.2)
      const c = g.ctx
      for (let i = 0; i < 9; i++) {
        const h = 8 + Math.abs(Math.sin((t * 2 + i * 0.13) * TAU)) * 34
        c.fillStyle = rgba('#ffffff', 0.85); c.beginPath(); c.roundRect(535 + i * 7, 100 - h / 2, 4, h, 2); c.fill()
        c.beginPath(); c.roundRect(405 - i * 7, 100 - h / 2, 4, h, 2); c.fill()
      }
    },
  },
  {
    id: 'newsletter', name: 'Newsletter', category: 'Content', ink: 'dark', font: 'serif', animated: true,
    defaults: { eyebrow: 'Newsletter', headline: 'Monthly insights, straight to your inbox', subline: 'Join 5,000+ leaders. One email a month, no spam.', cta: 'Subscribe', date: '', from: '#fef3c7', to: '#fde68a', accent: '#1c1917' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.5)
      const c = g.ctx
      const lift = 10 + 18 * (0.5 + 0.5 * Math.sin(t * TAU))
      c.save(); c.shadowColor = 'rgba(0,0,0,0.18)'; c.shadowBlur = 14; c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(430, 70 - lift, 110, 80, 6); c.fill(); c.restore()
      c.fillStyle = d.accent; c.fillRect(444, 84 - lift, 50, 6); c.fillStyle = '#e7e5e4'; for (let i = 0; i < 4; i++) c.fillRect(444, 98 - lift + i * 9, 80 - (i % 2) * 18, 4)
      c.fillStyle = '#f59e0b'; c.beginPath(); c.moveTo(415, 95); c.lineTo(555, 95); c.lineTo(555, 175); c.lineTo(415, 175); c.closePath(); c.fill()
      c.fillStyle = '#fbbf24'; c.beginPath(); c.moveTo(415, 95); c.lineTo(485, 140); c.lineTo(555, 95); c.lineTo(555, 175); c.lineTo(415, 175); c.closePath(); c.fill()
      c.fillStyle = '#d97706'; c.beginPath(); c.moveTo(415, 175); c.lineTo(485, 128); c.lineTo(555, 175); c.closePath(); c.fill()
      g.badge('Mail', 572, 60, 16, d.accent, '#ffffff')
    },
  },
  {
    id: 'conference', name: 'Conference', category: 'Events', ink: 'light', font: 'sans', animated: true,
    defaults: { eyebrow: 'Join us at', headline: 'Tech Summit Sydney 2026', subline: 'Two days of talks, demos and networking.', cta: 'Get tickets', date: '12–13 Feb · ICC Sydney', from: '#0b1120', to: '#1e3a8a', accent: '#38bdf8' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.4)
      const c = g.ctx
      ;[-0.35, 0, 0.35].forEach((base, i) => {
        const a = base + Math.sin((t + i / 3) * TAU) * 0.18
        c.save(); c.translate(470 + i * 40 - 40, -10); c.rotate(a)
        const gr = c.createLinearGradient(0, 0, 0, 220); gr.addColorStop(0, rgba(d.accent, 0.45)); gr.addColorStop(1, rgba(d.accent, 0))
        c.fillStyle = gr; c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.lineTo(46, 220); c.lineTo(-46, 220); c.closePath(); c.fill(); c.restore()
      })
      c.save(); c.translate(430, 108); c.rotate(-0.08)
      c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(0, 0, 150, 66, 10); c.fill()
      c.fillStyle = d.from; c.beginPath(); c.arc(112, 0, 8, 0, Math.PI); c.arc(112, 66, 8, Math.PI, TAU); c.fill()
      c.setLineDash([3, 4]); c.strokeStyle = '#cbd5e1'; c.beginPath(); c.moveTo(112, 10); c.lineTo(112, 58); c.stroke(); c.setLineDash([])
      c.font = `800 10px ${SANS}`; c.fillStyle = d.to; c.fillText('ADMIT ONE', 12, 22)
      c.font = `700 14px ${SANS}`; c.fillStyle = '#0f172a'; c.fillText(d.company ? d.company.slice(0, 12) : 'SUMMIT', 12, 42)
      g.icon('Ticket', 120, 22, 22, d.to, 2)
      c.restore()
    },
  },
  {
    id: 'tradeshow', name: 'Trade show', category: 'Events', ink: 'light', font: 'sans', animated: true,
    defaults: { eyebrow: 'Meet us at', headline: 'CeBIT Australia — Booth 42', subline: 'Live demos, coffee and a few surprises.', cta: 'Book a meeting', date: '5–7 May · Sydney', from: '#7c2d12', to: '#ea580c', accent: '#ffffff' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.5)
      g.dots('rgba(255,255,255,0.08)', 14, 1.2, { x: 360, y: 0, w: 240, h: BH })
      const c = g.ctx
      const sw = Math.sin(t * TAU) * 0.06
      c.save(); c.translate(490, 0); c.rotate(sw)
      c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.beginPath(); c.moveTo(-30, 0); c.lineTo(-10, 60); c.moveTo(30, 0); c.lineTo(10, 60); c.stroke()
      c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(-46, 60, 92, 118, 10); c.fill()
      c.fillStyle = d.to; c.beginPath(); c.roundRect(-46, 60, 92, 30, [10, 10, 0, 0]); c.fill()
      c.font = `800 10px ${SANS}`; c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.fillText('VISIT US', 0, 79)
      c.font = `900 40px ${SANS}`; c.fillStyle = d.from; c.fillText(d.headline.match(/\d+/)?.[0] ?? '42', 0, 138)
      c.font = `700 10px ${SANS}`; c.fillStyle = '#78716c'; c.fillText('BOOTH', 0, 158); c.textAlign = 'left'
      c.restore()
      g.icon('MapPin', 560, 40, 26, '#ffffff', 2)
    },
  },
  {
    id: 'bookcall', name: 'Book a call', category: 'Business', ink: 'dark', font: 'sans', animated: true,
    defaults: { eyebrow: 'Free consultation', headline: 'Book a 15-minute strategy call', subline: 'Pick a time that suits you — no obligation.', cta: 'Pick a time', date: '', from: '#0f766e', to: '#14b8a6', accent: '#0f766e' },
    draw(g, d, t) {
      g.linear('#f0fdfa', mix(d.to, '#ffffff', 0.8), 0.5)
      g.glow(490, 100, 140, d.to, 0.2)
      const c = g.ctx
      c.save(); c.shadowColor = 'rgba(0,0,0,0.15)'; c.shadowBlur = 16; c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(410, 26, 160, 148, 12); c.fill(); c.restore()
      c.fillStyle = d.from; c.beginPath(); c.roundRect(410, 26, 160, 30, [12, 12, 0, 0]); c.fill()
      c.font = `700 11px ${SANS}`; c.fillStyle = '#ffffff'; c.fillText(new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }), 422, 45)
      const pick = Math.floor(t * 4) % 4
      for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) {
        const x = 422 + k * 24, y = 66 + r * 22, on = r === 1 && k === 3
        c.fillStyle = on ? d.from : '#f1f5f9'; c.beginPath(); c.roundRect(x, y, 18, 16, 4); c.fill()
        c.font = `600 8px ${SANS}`; c.fillStyle = on ? '#ffffff' : '#64748b'; c.fillText(String(1 + r * 6 + k), x + 5, y + 11)
      }
      ;['9:30', '11:00', '2:15', '4:00'].forEach((tm, i) => {
        const x = 422 + i * 37, on = i === pick
        c.fillStyle = on ? d.to : '#ffffff'; c.strokeStyle = d.to; c.lineWidth = 1
        c.beginPath(); c.roundRect(x, 142, 33, 20, 10); c.fill(); c.stroke()
        c.font = `700 8.5px ${SANS}`; c.fillStyle = on ? '#ffffff' : d.from; c.fillText(tm, x + 6, 155)
      })
      g.badge('Phone', 568, 30, 16, d.accent, '#ffffff')
    },
  },
  {
    id: 'launch', name: 'Product launch', category: 'Business', ink: 'light', font: 'sans', animated: true,
    defaults: { eyebrow: 'Just launched', headline: 'Meet the all-new platform', subline: 'Faster, smarter and built around your feedback.', cta: "See what's new", date: '', from: '#1e1b4b', to: '#7c3aed', accent: '#22d3ee' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.3)
      const r = rng(9)
      for (let i = 0; i < 30; i++) g.sparkle(330 + r() * 270, r() * BH, 1 + r() * 2, '#ffffff', 0.3 + 0.7 * Math.abs(Math.sin((t + r()) * TAU)))
      const y = 100 - Math.sin(t * TAU) * 8
      const c = g.ctx
      c.save(); c.translate(480, y); c.rotate(-0.6)
      const fl = c.createLinearGradient(0, 30, 0, 110); fl.addColorStop(0, rgba(d.accent, 0.9)); fl.addColorStop(1, rgba(d.accent, 0))
      c.fillStyle = fl; c.beginPath(); c.moveTo(-12, 30); c.lineTo(12, 30); c.lineTo(0, 100 + Math.sin(t * TAU * 3) * 10); c.closePath(); c.fill()
      c.restore()
      g.glow(480, y, 70, d.accent, 0.25)
      g.icon('Rocket', 440, y - 40, 80, '#ffffff', 1.6, rgba('#ffffff', 0.12))
    },
  },
  {
    id: 'hiring', name: "We're hiring", category: 'Business', ink: 'dark', font: 'serif', animated: true,
    defaults: { eyebrow: "We're hiring", headline: 'Join our growing team', subline: 'Engineers, consultants and support heroes wanted.', cta: 'View open roles', date: '', from: '#e0e7ff', to: '#fae8ff', accent: '#4f46e5' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.4)
      const people: [number, number, number, string][] = [[440, 70, 26, '#f59e0b'], [510, 58, 30, '#10b981'], [575, 92, 22, '#ec4899'], [470, 140, 24, '#3b82f6'], [545, 150, 26, '#8b5cf6']]
      people.forEach(([x, y, r, col], i) => {
        const b = Math.sin((t + i / 5) * TAU) * 3
        g.circle(x, y + b, r + 3, '#ffffff'); g.circle(x, y + b, r, col)
        g.circle(x, y + b - r * 0.25, r * 0.32, 'rgba(255,255,255,0.85)')
        const c = g.ctx; c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.ellipse(x, y + b + r * 0.45, r * 0.55, r * 0.35, 0, Math.PI, TAU); c.fill()
      })
      g.circle(400, 130, 18, d.accent); g.icon('Plus', 389, 119, 22, '#ffffff', 2.6)
      g.badge('Briefcase', 585, 30, 15, '#ffffff', d.accent)
    },
  },
  {
    id: 'award', name: 'Award showcase', category: 'Business', ink: 'light', font: 'serif', animated: true,
    defaults: { eyebrow: 'Award winner', headline: 'Named MSP of the Year 2026', subline: 'Thank you to our clients and our incredible team.', cta: 'Read the news', date: '', from: '#111827', to: '#292524', accent: '#fbbf24' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.4)
      g.glow(480, 100, 130, '#fbbf24', 0.25)
      laurel(g, 480, 96, 62, '#d4a017')
      g.icon('Trophy', 440, 52, 80, '#fbbf24', 1.8, rgba('#fbbf24', 0.25))
      const r = rng(21)
      for (let i = 0; i < 12; i++) { const a = r() * TAU, rr = 70 + r() * 30; g.sparkle(480 + Math.cos(a) * rr, 100 + Math.sin(a) * rr * 0.8, 2 + r() * 3, '#fde68a', 0.2 + 0.8 * Math.abs(Math.sin((t + r()) * TAU))) }
    },
  },
  {
    id: 'review', name: 'Customer review', category: 'Business', ink: 'dark', font: 'serif', animated: true,
    defaults: { eyebrow: 'Rated 4.9 / 5', headline: 'Loved by teams across Australia', subline: '“The best decision we made this year.”', cta: 'Read reviews', date: '', from: '#fff7ed', to: '#ffedd5', accent: '#ea580c' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.4)
      const c = g.ctx
      c.save(); c.shadowColor = 'rgba(0,0,0,0.12)'; c.shadowBlur = 16; c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(400, 46, 175, 112, 14); c.fill(); c.restore()
      for (let i = 0; i < 5; i++) { const pop = 1 + 0.25 * Math.max(0, Math.sin((t - i * 0.08) * TAU * 1.5)); g.star(424 + i * 26, 72, 10 * pop, '#f59e0b') }
      c.fillStyle = '#e7e5e4'; c.fillRect(414, 96, 140, 5); c.fillRect(414, 108, 120, 5); c.fillRect(414, 120, 130, 5)
      g.circle(426, 142, 9, '#fdba74'); c.font = `700 9px ${SANS}`; c.fillStyle = '#44403c'; c.fillText('Verified customer', 442, 145)
      g.badge('Quote', 572, 48, 15, d.accent, '#ffffff')
    },
  },
  {
    id: 'holidayhours', name: 'Holiday hours', category: 'Business', ink: 'dark', font: 'sans', animated: false,
    defaults: { eyebrow: 'Holiday hours', headline: "We're closed 24 Dec – 2 Jan", subline: 'Urgent support is still available 24/7.', cta: 'Emergency support', date: '', from: '#e0f2fe', to: '#f0f9ff', accent: '#0369a1' },
    draw(g, d) {
      g.linear(d.from, d.to, 0.4)
      const c = g.ctx
      c.save(); c.shadowColor = 'rgba(0,0,0,0.12)'; c.shadowBlur = 14; c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(420, 30, 150, 140, 12); c.fill(); c.restore()
      c.fillStyle = d.accent; c.beginPath(); c.roundRect(420, 30, 150, 28, [12, 12, 0, 0]); c.fill()
      c.font = `700 11px ${SANS}`; c.fillStyle = '#ffffff'; c.fillText('DECEMBER', 432, 48)
      for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++) {
        const day = 22 + r * 7 + k - 6, x = 430 + k * 19, y = 70 + r * 24
        if (day < 1 || day > 31) continue
        const closed = day >= 24 && day <= 31
        c.fillStyle = closed ? rgba(d.accent, 0.12) : '#f8fafc'; c.beginPath(); c.roundRect(x, y, 16, 18, 3); c.fill()
        c.font = `600 8px ${SANS}`; c.fillStyle = closed ? d.accent : '#64748b'; c.fillText(String(day), x + 3, y + 12)
        if (closed) { c.strokeStyle = rgba(d.accent, 0.6); c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 2, y + 16); c.lineTo(x + 14, y + 2); c.stroke() }
      }
      g.badge('Clock', 570, 158, 16, d.accent, '#ffffff')
    },
  },
  {
    id: 'spotlight', name: 'Brand spotlight', category: 'Business', ink: 'light', font: 'serif', animated: true,
    defaults: { eyebrow: 'Talk to us', headline: 'Book a call now — let’s make IT simple', subline: 'Friendly experts, fast answers.', cta: 'Book a call', date: '', from: '#0f766e', to: '#1e3a8a', accent: '#fbbf24' },
    draw(g, d, t) {
      g.linear(d.from, d.to, 0.35)
      const c = g.ctx
      ;[[470, 60, 90], [560, 160, 70], [400, 180, 50]].forEach(([x, y, r], i) => { const p = 1 + 0.05 * Math.sin((t + i / 3) * TAU); c.strokeStyle = rgba('#ffffff', 0.14); c.lineWidth = 18; c.beginPath(); c.arc(x, y, r * p, 0, TAU); c.stroke() })
      g.glow(500, 100, 110, d.accent, 0.2)
      g.badge('Phone', 500, 100, 30, '#ffffff', d.from)
      g.sparkle(548, 60, 7, d.accent, 0.6 + 0.4 * Math.sin(t * TAU)); g.sparkle(452, 140, 5, '#ffffff', 0.6 + 0.4 * Math.cos(t * TAU))
    },
  },
]

export const BANNER_TEMPLATES = T
export const BANNER_CATEGORIES = ['All', 'Festive', 'Content', 'Events', 'Business'] as const
export const bannerTemplate = (id?: string) => T.find((x) => x.id === id)

/** Palette presets offered alongside “Use my brand colours”. */
export const BANNER_PALETTES: [string, string, string][] = [
  ['#0f766e', '#1e3a8a', '#fbbf24'], ['#111827', '#4f46e5', '#f43f5e'], ['#7f1d1d', '#b91c1c', '#fbbf24'], ['#1a0b2e', '#4c1d95', '#f97316'],
  ['#064e3b', '#0f766e', '#fde047'], ['#0b1120', '#1e3a8a', '#38bdf8'], ['#581c87', '#be185d', '#fde047'], ['#0a0a0a', '#262626', '#facc15'],
  ['#fef3c7', '#fdba74', '#b91c1c'], ['#e0f2fe', '#bae6fd', '#0369a1'], ['#fdf2f8', '#fce7f3', '#db2777'], ['#ecfdf5', '#a7f3d0', '#047857'],
]

export async function ensureBannerFonts() {
  try {
    await Promise.all([document.fonts.load(`600 24px ${SERIF}`), document.fonts.load(`800 24px ${SANS}`), document.fonts.load(`500 12px ${SANS}`), document.fonts.load(`700 12px ${SANS}`)])
  } catch { /* fall back to system fonts */ }
}

/** Paint one frame at the given pixel scale. */
export function paintBanner(ctx: CanvasRenderingContext2D, tpl: BannerTemplate, d: BannerData, t: number, scale: number) {
  ctx.save()
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, BW, BH)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, BW, BH)
  ctx.beginPath(); ctx.roundRect(0, 0, BW, BH, 16); ctx.clip()
  const g = new Painter(ctx)
  tpl.draw(g, d, t)
  drawCopy(g, d, tpl)
  ctx.restore()
}

/** Static banner: 2× JPEG (sharp on retina, small file). */
export function bannerJpeg(tpl: BannerTemplate, d: BannerData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = BW * 2; canvas.height = BH * 2
  paintBanner(canvas.getContext('2d')!, tpl, d, 0, 2)
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Banner render failed'))), 'image/jpeg', 0.9))
}

/** Animated banner: looping GIF at 1× (frame one is the finished design for Outlook desktop). */
export function bannerGif(tpl: BannerTemplate, d: BannerData, frames = 24, delay = 80): Blob {
  const canvas = document.createElement('canvas')
  canvas.width = BW; canvas.height = BH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const sample = [0, 0.33, 0.66].map((t) => { paintBanner(ctx, tpl, d, t, 1); return ctx.getImageData(0, 0, BW, BH).data })
  const merged = new Uint8ClampedArray(sample.reduce((n, s) => n + s.length, 0))
  sample.reduce((o, s) => { merged.set(s, o); return o + s.length }, 0)
  const palette = quantize(merged, 256)
  const gif = GIFEncoder()
  for (let i = 0; i < frames; i++) {
    paintBanner(ctx, tpl, d, i / frames, 1)
    gif.writeFrame(applyPalette(ctx.getImageData(0, 0, BW, BH).data, palette), BW, BH, { palette: i === 0 ? palette : undefined, delay })
  }
  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}
