export async function copyRich(html: string) {
  // Pasting into Gmail/Outlook settings needs text/html on the clipboard, not markup as text.
  if ('ClipboardItem' in window && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()], { type: 'text/plain' }),
        }),
      ])
      return
    } catch {
      // Blocked by browser or company policy — fall back to a selection copy below.
    }
  }
  const el = document.createElement('div')
  el.innerHTML = html
  el.contentEditable = 'true'
  el.style.position = 'fixed'
  el.style.left = '-9999px'
  document.body.appendChild(el)
  const range = document.createRange()
  range.selectNodeContents(el)
  const sel = document.getSelection()!
  sel.removeAllRanges()
  sel.addRange(range)
  const ok = document.execCommand('copy')
  sel.removeAllRanges()
  el.remove()
  if (!ok) throw new Error('Your browser blocked copying — use Download instead')
}

export const copyText = (text: string) => navigator.clipboard.writeText(text)

export function download(filename: string, content: string, type = 'text/html') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'signature'

/** Downscale an image in the browser before uploading it. */
export function readImage(file: File, max = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        // Keep transparency for formats that can carry it (logos); photos go to JPEG.
        resolve(canvas.toDataURL(/image\/(png|webp|gif)/.test(file.type) ? 'image/png' : 'image/jpeg', 0.88))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

/** Pick the most saturated common colour in an image — used for "match my logo". */
export function brandColors(dataUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = c.height = 48
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0, 48, 48)
      const data = ctx.getImageData(0, 0, 48, 48).data
      const buckets = new Map<string, { n: number; r: number; g: number; b: number; sat: number }>()
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
        if (a < 128) continue
        const max = Math.max(r, g, b), min = Math.min(r, g, b)
        const sat = max === 0 ? 0 : (max - min) / max
        if (max > 240 && sat < 0.1) continue // skip white background
        const key = `${r >> 5}-${g >> 5}-${b >> 5}`
        const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0, sat: 0 }
        e.n++; e.r += r; e.g += g; e.b += b; e.sat += sat
        buckets.set(key, e)
      }
      const hex = (e: { n: number; r: number; g: number; b: number }) =>
        '#' + [e.r, e.g, e.b].map((v) => Math.round(v / e.n).toString(16).padStart(2, '0')).join('')
      const ranked = [...buckets.values()].sort((a, b) => b.n * (0.3 + b.sat / b.n) - a.n * (0.3 + a.sat / a.n))
      resolve(ranked.slice(0, 2).map(hex))
    }
    img.onerror = () => resolve([])
    img.src = dataUrl
  })
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const split = (l: string) => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? []).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim())
  const head = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ''))
  return lines.slice(1).map((l) => {
    const cells = split(l)
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']))
  })
}

export const compact = (n: number) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

export function timeAgo(ts: number) {
  const s = (Date.now() - ts) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export async function dataUrlToBlob(dataUrl: string) {
  return (await fetch(dataUrl)).blob()
}
