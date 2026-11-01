import type { Campaign, Signature } from '../types'
import { supabase } from './supabase'

// Signature links become /r/<code>. Codes are deterministic (org + person + url), so
// re-copying a signature reuses the same links and click history stays continuous.

export interface TrackTarget {
  orgId: string
  personType: 'sig' | 'emp'
  personId: string
}

export interface TrackedLink { code: string; url: string; kind: string }

const SOCIAL_HOSTS: [RegExp, string][] = [
  [/linkedin\.com/i, 'LinkedIn'], [/(^|\.)x\.com|twitter\.com/i, 'X / Twitter'], [/instagram\.com/i, 'Instagram'],
  [/facebook\.com|fb\.com/i, 'Facebook'], [/youtube\.com|youtu\.be/i, 'YouTube'], [/tiktok\.com/i, 'TikTok'], [/github\.com/i, 'GitHub'],
]

function hash(s: string, seed: number) {
  let h = seed >>> 0
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 2654435761) >>> 0
  h ^= h >>> 16
  return h.toString(36).padStart(7, '0').slice(-7)
}

export const linkCode = (t: TrackTarget, url: string) => {
  const key = `${t.orgId}|${t.personId}|${url}`
  return hash(key, 0x9e3779b9) + hash(key, 0x85ebca6b)
}

const norm = (u: string) => u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase()

/** Human label for what was clicked. */
export function linkKind(url: string, sig: Signature, campaigns: Campaign[] = []): string {
  const n = norm(url)
  if (sig.fields.website && n === norm(sig.fields.website.startsWith('http') ? sig.fields.website : `https://${sig.fields.website}`)) return 'Website'
  if (sig.extras.cta?.url && n === norm(sig.extras.cta.url.startsWith('http') ? sig.extras.cta.url : `https://${sig.extras.cta.url}`)) return `Button: ${sig.extras.cta.label}`
  const banner = campaigns.find((c) => c.id === sig.extras.campaignId)
  if (banner?.url && n === norm(banner.url.startsWith('http') ? banner.url : `https://${banner.url}`)) return `Banner: ${banner.name}`
  const nav = sig.extras.navLinks.find((l) => l.url && n === norm(l.url.startsWith('http') ? l.url : `https://${l.url}`))
  if (nav) return `Nav: ${nav.label}`
  if (/maps\.google\./i.test(url)) return 'Address'
  for (const [re, label] of SOCIAL_HOSTS) if (re.test(n)) return label
  return 'Other link'
}

const unescape = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")

/** Rewrite every http(s) href in the signature HTML to a tracked short link. mailto:/tel: stay direct. */
export function trackHtml(html: string, sig: Signature, t: TrackTarget, base: string, campaigns: Campaign[] = []) {
  const links = new Map<string, TrackedLink>()
  const out = html.replace(/href="(https?:\/\/[^"]+)"/gi, (whole, raw: string) => {
    const url = unescape(raw)
    if (url.startsWith(`${base}/r/`)) return whole
    const code = linkCode(t, url)
    links.set(code, { code, url, kind: linkKind(url, sig, campaigns) })
    return `href="${base}/r/${code}"`
  })
  return { html: out, links: [...links.values()] }
}

/** Register links so the redirect endpoint can resolve them. Safe to call repeatedly. */
export async function registerLinks(t: TrackTarget, links: TrackedLink[]) {
  if (!links.length) return
  const { error } = await supabase.from('links').upsert(
    links.map((l) => ({ code: l.code, org_id: t.orgId, person_type: t.personType, person_id: t.personId, kind: l.kind, url: l.url })),
    { onConflict: 'code', ignoreDuplicates: true },
  )
  if (error) throw new Error(`Couldn't prepare tracked links: ${error.message}`)
}

/** Public base for tracked links — the domain the app is served from (custom domain in production). */
export const trackingBase = () => location.origin
