import { GIFEncoder, applyPalette, quantize } from 'gifenc'

// Email clients strip CSS animation but play GIFs, so "motion" is rendered frame by
// frame on a canvas and encoded as a looping GIF. Every effect's FIRST frame is a
// finished design, because Outlook desktop only ever shows frame one.

export type PhotoEffect = 'orbit' | 'halo' | 'shine' | 'sparkle' | 'breathe' | 'hello' | 'draw'
export type Shape = 'circle' | 'rounded' | 'square'

export const PHOTO_EFFECTS: { id: PhotoEffect; name: string; blurb: string }[] = [
  { id: 'orbit', name: 'Orbit', blurb: 'Spinning gradient ring with orbiting lights' },
  { id: 'halo', name: 'Halo pulse', blurb: 'Radar rings ripple outward' },
  { id: 'shine', name: 'Shine', blurb: 'A light sweep glints across' },
  { id: 'sparkle', name: 'Sparkle', blurb: 'Twinkling stars around the frame' },
  { id: 'breathe', name: 'Breathe', blurb: 'Gentle zoom with a soft glow' },
  { id: 'hello', name: 'Say hello', blurb: 'A waving “Hi!” bubble' },
  { id: 'draw', name: 'Draw on', blurb: 'The frame draws itself in colour' },
]

export interface PhotoGifOptions {
  photo: HTMLImageElement | null
  initials: string
  effect: PhotoEffect
  primary: string
  accent: string
  shape: Shape
  greeting?: string
  bg?: string
}

/** Photo GIFs reserve a margin for rings and bubbles; the photo fills this share of the width. */
export const PHOTO_FILL = 0.66
const SIZE = 200
const TAU = Math.PI * 2
const ease = (x: number) => 0.5 - Math.cos(Math.PI * x) / 2

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('IMAGE_UNREADABLE'))
    img.src = src
  })
}

function shapePath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, shape: Shape) {
  ctx.beginPath()
  if (shape === 'circle') ctx.arc(cx, cy, r, 0, TAU)
  else ctx.roundRect(cx - r, cy - r, r * 2, r * 2, shape === 'rounded' ? r * 0.32 : r * 0.08)
}

function rgba(hex: string, a: number) {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function drawPhoto(ctx: CanvasRenderingContext2D, o: PhotoGifOptions, cx: number, cy: number, r: number, zoom = 1) {
  ctx.save()
  shapePath(ctx, cx, cy, r, o.shape)
  ctx.clip()
  if (o.photo) {
    const s = Math.max((r * 2) / o.photo.width, (r * 2) / o.photo.height) * zoom
    const w = o.photo.width * s, h = o.photo.height * s
    ctx.drawImage(o.photo, cx - w / 2, cy - h / 2.3, w, h)
  } else {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
    g.addColorStop(0, o.primary)
    g.addColorStop(1, o.accent)
    ctx.fillStyle = g
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${r * 0.8}px Helvetica, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(o.initials, cx, cy + r * 0.04)
  }
  ctx.restore()
}

function ring(ctx: CanvasRenderingContext2D, o: PhotoGifOptions, cx: number, cy: number, r: number, width: number, style: string | CanvasGradient, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineWidth = width
  ctx.strokeStyle = style
  shapePath(ctx, cx, cy, r, o.shape)
  ctx.stroke()
  ctx.restore()
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.translate(x, y)
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? size : size * 0.28
    const a = (i / 8) * TAU - Math.PI / 2
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** Draw one frame of a photo effect at loop position t ∈ [0, 1). Also used for live previews. */
export function drawPhotoFrame(ctx: CanvasRenderingContext2D, o: PhotoGifOptions, t: number, size = SIZE) {
  const S = size
  const cx = S / 2, cy = S / 2
  const r = (S * PHOTO_FILL) / 2
  ctx.clearRect(0, 0, S, S)
  ctx.fillStyle = o.bg ?? '#ffffff'
  ctx.fillRect(0, 0, S, S)

  switch (o.effect) {
    case 'orbit': {
      const grad = ctx.createConicGradient(t * TAU, cx, cy)
      grad.addColorStop(0, o.primary)
      grad.addColorStop(0.5, o.accent)
      grad.addColorStop(1, o.primary)
      drawPhoto(ctx, o, cx, cy, r)
      ring(ctx, o, cx, cy, r + S * 0.035, S * 0.03, grad)
      for (const k of [0, 0.5]) {
        const a = (t + k) * TAU - Math.PI / 2
        const d = r + S * 0.1
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d
        const glow = ctx.createRadialGradient(x, y, 0, x, y, S * 0.05)
        glow.addColorStop(0, rgba(k ? o.accent : o.primary, 0.9))
        glow.addColorStop(1, rgba(k ? o.accent : o.primary, 0))
        ctx.fillStyle = glow
        ctx.beginPath(); ctx.arc(x, y, S * 0.05, 0, TAU); ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.arc(x, y, S * 0.012, 0, TAU); ctx.fill()
      }
      break
    }
    case 'halo': {
      for (const k of [0, 0.5]) {
        const p = (t + k) % 1
        ring(ctx, o, cx, cy, r + S * 0.02 + p * S * 0.14, S * 0.012 + (1 - p) * S * 0.012, k ? o.accent : o.primary, (1 - p) * 0.75)
      }
      drawPhoto(ctx, o, cx, cy, r)
      ring(ctx, o, cx, cy, r + S * 0.012, S * 0.02, o.primary)
      break
    }
    case 'shine': {
      drawPhoto(ctx, o, cx, cy, r)
      const p = (t - 0.12) / 0.45
      if (p > 0 && p < 1) {
        ctx.save()
        shapePath(ctx, cx, cy, r, o.shape)
        ctx.clip()
        const x = cx - r * 2 + ease(p) * r * 4
        const g = ctx.createLinearGradient(x - r * 0.5, 0, x + r * 0.5, 0)
        g.addColorStop(0, 'rgba(255,255,255,0)')
        g.addColorStop(0.5, 'rgba(255,255,255,0.55)')
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.translate(cx, cy); ctx.rotate(-0.5); ctx.translate(-cx, -cy)
        ctx.fillStyle = g
        ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4)
        ctx.restore()
      }
      const g2 = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
      g2.addColorStop(0, o.primary); g2.addColorStop(1, o.accent)
      ring(ctx, o, cx, cy, r + S * 0.025, S * 0.025, g2)
      break
    }
    case 'sparkle': {
      drawPhoto(ctx, o, cx, cy, r)
      ring(ctx, o, cx, cy, r + S * 0.02, S * 0.018, o.accent)
      const spots = [[-0.42, -0.36, 1], [0.44, -0.3, 0.8], [0.47, 0.32, 1.1], [-0.46, 0.34, 0.75], [0.05, -0.47, 0.6], [-0.1, 0.48, 0.7]]
      spots.forEach(([dx, dy, s], i) => {
        const p = (t + i / spots.length) % 1
        const a = Math.max(0, Math.sin(p * Math.PI))
        star(ctx, cx + dx * S, cy + dy * S, S * 0.045 * s * (0.6 + a * 0.6), i % 2 ? o.primary : o.accent, 0.25 + a * 0.75)
      })
      break
    }
    case 'breathe': {
      const p = Math.sin(t * TAU) * 0.5 + 0.5
      ctx.save()
      ctx.shadowColor = rgba(o.primary, 0.25 + p * 0.35)
      ctx.shadowBlur = S * (0.04 + p * 0.07)
      ctx.fillStyle = o.bg ?? '#ffffff'
      shapePath(ctx, cx, cy, r, o.shape)
      ctx.fill()
      ctx.restore()
      drawPhoto(ctx, o, cx, cy, r, 1 + p * 0.07)
      ring(ctx, o, cx, cy, r + S * 0.015, S * 0.015, rgba(o.primary, 0.6 + p * 0.4))
      break
    }
    case 'hello': {
      drawPhoto(ctx, o, cx, cy + S * 0.04, r * 0.94)
      ring(ctx, o, cx, cy + S * 0.04, r * 0.94 + S * 0.015, S * 0.018, o.primary)
      const bob = Math.sin(t * TAU) * S * 0.012
      const bx = S * 0.6, by = S * 0.06 + bob, bw = S * 0.38, bh = S * 0.17
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = S * 0.03; ctx.shadowOffsetY = S * 0.01
      ctx.fillStyle = o.primary
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh / 2); ctx.fill()
      ctx.beginPath(); ctx.moveTo(bx + bw * 0.22, by + bh - 1); ctx.lineTo(bx + bw * 0.12, by + bh + S * 0.05); ctx.lineTo(bx + bw * 0.42, by + bh - 1); ctx.fill()
      ctx.restore()
      ctx.fillStyle = '#fff'
      ctx.font = `700 ${S * 0.075}px Helvetica, Arial, sans-serif`
      ctx.textBaseline = 'middle'
      ctx.fillText(o.greeting || 'Hi!', bx + S * 0.035, by + bh / 2 + 1)
      const wave = Math.sin(t * TAU * 2) * 0.45
      ctx.save()
      ctx.translate(bx + bw - S * 0.075, by + bh / 2 + S * 0.01)
      ctx.rotate(wave)
      ctx.font = `${S * 0.08}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('👋', 0, 0)
      ctx.restore()
      break
    }
    case 'draw': {
      drawPhoto(ctx, o, cx, cy, r)
      // Complete at t=0 (Outlook's frame), erases near the end, then redraws.
      const p = t < 0.62 ? 1 : t < 0.7 ? 1 - (t - 0.62) / 0.08 : (t - 0.7) / 0.3
      const grad = ctx.createConicGradient(-Math.PI / 2, cx, cy)
      grad.addColorStop(0, o.primary); grad.addColorStop(0.5, o.accent); grad.addColorStop(1, o.primary)
      ctx.save()
      ctx.lineWidth = S * 0.03
      ctx.lineCap = 'round'
      ctx.strokeStyle = grad
      ctx.beginPath()
      const R = r + S * 0.04
      if (o.shape === 'circle') ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + ease(Math.max(0.001, p)) * TAU)
      else {
        ctx.setLineDash([R * 8 * ease(p), R * 8])
        ctx.roundRect(cx - R, cy - R, R * 2, R * 2, o.shape === 'rounded' ? R * 0.32 : R * 0.08)
      }
      ctx.stroke()
      ctx.restore()
      if (t < 0.62) ring(ctx, o, cx, cy, r + S * 0.09, S * 0.006, o.accent, Math.sin((t / 0.62) * Math.PI) * 0.6)
      break
    }
  }
}

function encode(frames: number, delay: number, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, t: number) => void): Blob {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const gif = GIFEncoder()
  // One palette for the whole loop (sampled across frames): smaller files, no colour flicker.
  const samples = [0, 0.25, 0.5, 0.75].map((t) => { draw(ctx, t); return ctx.getImageData(0, 0, w, h).data })
  const merged = new Uint8ClampedArray(samples.reduce((n, d) => n + d.length, 0))
  samples.reduce((o, d) => { merged.set(d, o); return o + d.length }, 0)
  const palette = quantize(merged, 256)
  for (let i = 0; i < frames; i++) {
    draw(ctx, i / frames)
    const { data } = ctx.getImageData(0, 0, w, h)
    gif.writeFrame(applyPalette(data, palette), w, h, { palette: i === 0 ? palette : undefined, delay })
  }
  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}

const EFFECT_TIMING: Record<PhotoEffect, [frames: number, delay: number]> = {
  orbit: [28, 65], halo: [26, 70], shine: [30, 70], sparkle: [28, 75], breathe: [28, 75], hello: [28, 70], draw: [34, 65],
}

export function photoGif(o: PhotoGifOptions): Blob {
  const [frames, delay] = EFFECT_TIMING[o.effect]
  return encode(frames, delay, SIZE, SIZE, (ctx, t) => drawPhotoFrame(ctx, o, t))
}

/** Pill button with a shimmer sweep and a nudging arrow. Rendered at 2× for crisp display. */
export function buttonGif(label: string, primary: string, accent: string, font = 'Helvetica, Arial, sans-serif') {
  const H = 64, pad = 40, fs = 26
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = `700 ${fs}px ${font}`
  const W = Math.ceil(measure.measureText(label).width + pad * 2 + 34)
  const blob = encode(30, 60, W, H, (ctx, t) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, primary); g.addColorStop(1, accent)
    ctx.save()
    ctx.beginPath(); ctx.roundRect(2, 2, W - 4, H - 4, (H - 4) / 2); ctx.clip()
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    const p = (t - 0.1) / 0.5
    if (p > 0 && p < 1) {
      const x = -W * 0.3 + ease(p) * W * 1.6
      const s = ctx.createLinearGradient(x - 50, 0, x + 50, 0)
      s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,0.45)'); s.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = s
      ctx.fillRect(0, 0, W, H)
    }
    ctx.restore()
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${fs}px ${font}`
    ctx.textBaseline = 'middle'
    ctx.fillText(label, pad, H / 2 + 1)
    const nudge = Math.max(0, Math.sin(t * Math.PI * 4)) * 6
    ctx.font = `700 ${fs}px ${font}`
    ctx.fillText('→', W - pad - 22 + nudge, H / 2)
  })
  return { blob, width: W / 2 }
}

/** Blue verified check that pops and glints. */
export function badgeGif() {
  const S = 48
  return encode(28, 70, S, S, (ctx, t) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, S, S)
    const pop = t > 0.7 ? 1 + Math.sin(((t - 0.7) / 0.3) * Math.PI) * 0.18 : 1
    ctx.save()
    ctx.translate(S / 2, S / 2)
    ctx.scale(pop, pop)
    ctx.fillStyle = '#1d9bf0'
    ctx.beginPath()
    for (let i = 0; i < 16; i++) {
      const rad = i % 2 === 0 ? 19 : 16
      const a = (i / 16) * TAU + t * 0.6
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
    }
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 4.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(-7.5, 0.5); ctx.lineTo(-2, 6); ctx.lineTo(8, -5.5); ctx.stroke()
    ctx.restore()
  })
}

/** Social icon in a brand-coloured circle that hops; `index` staggers icons into a wave. */
export function iconGif(icon: HTMLImageElement, color: string, index: number, count: number) {
  const S = 56
  return encode(24, 60, S, S, (ctx, t) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, S, S)
    const p = (t - index / Math.max(count, 1) * 0.5 + 1) % 1
    const hop = p < 0.3 ? Math.sin((p / 0.3) * Math.PI) : 0
    const y = S / 2 - hop * 5
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(S / 2, y, 24 - hop * 1.5, 0, TAU); ctx.fill()
    ctx.drawImage(icon, S / 2 - 13, y - 13, 26, 26)
  })
}

/** Stable key so assets are only regenerated when their inputs change. */
export function assetKey(parts: unknown[]) {
  const s = JSON.stringify(parts)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
