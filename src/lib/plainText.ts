import type { Campaign, Signature } from '../types'
import { resolveCampaign } from './render.js'

// Plain-text signature for text/plain message parts (the relay appends it to plain-text mail).
// Pure: no DOM. Relative imports carry `.js` for Vercel's Node ESM runtime.

const withScheme = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)

export interface PlainTextOptions {
  campaigns?: Campaign[]
  /** Map a URL to the one to print, e.g. its tracked /r/<code> link. */
  link?: (url: string) => string
}

export function plainTextSignature(sig: Signature, opts: PlainTextOptions = {}): string {
  const f = sig.fields
  const link = opts.link ?? ((u: string) => u)
  const lines: string[] = []
  const push = (v: string | undefined | null) => { const t = (v ?? '').trim(); if (t) lines.push(t) }

  push(f.pronouns ? `${f.fullName} (${f.pronouns})` : f.fullName)
  push([f.title, f.department].filter((x) => x?.trim()).join(', '))
  push(f.company)
  if (lines.length) lines.push('')

  const contact = lines.length
  if (f.phone?.trim()) push(`P: ${f.phone}`)
  if (f.mobile?.trim()) push(`M: ${f.mobile}`)
  if (f.email?.trim()) push(`E: ${f.email}`)
  if (f.website?.trim()) push(`W: ${link(withScheme(f.website.trim()))}`)
  push(f.address)

  const banner = resolveCampaign(sig, opts.campaigns ?? [])
  if (banner && (banner.headline?.trim() || banner.url?.trim())) {
    if (lines.length > contact) lines.push('')
    push(banner.headline)
    if (banner.url?.trim()) push(link(withScheme(banner.url.trim())))
  }

  const disclaimer = sig.extras.disclaimer?.trim()
  if (disclaimer) {
    lines.push('', disclaimer)
  }

  while (lines.length && !lines[lines.length - 1]) lines.pop()
  return lines.join('\n')
}
