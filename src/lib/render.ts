import type { Campaign, Signature, SocialKey } from '../types'
import { CLASSIC, type Block, type ClassicRecipe } from './classic.js'

// Email clients ignore <head> styles and most modern CSS, so every template is
// built from nested tables with inline styles. Animation classes are progressive
// enhancement: clients that keep the <style> block (Apple Mail, iOS, Outlook.com
// preview, this app) animate; the rest show the static design.

export interface RenderContext {
  campaigns?: Campaign[]
  /** Disable animation classes, e.g. for thumbnails. */
  still?: boolean
}

type Ctx = {
  s: Signature
  campaign: Campaign | null
  anim: boolean
  base: number
  font: string
}

const SOCIAL_ICON: Record<SocialKey, string> = {
  linkedin: 'linkedin',
  x: 'twitterx',
  instagram: 'instagram-new',
  facebook: 'facebook-new',
  youtube: 'youtube-play',
  tiktok: 'tiktok',
  github: 'github',
}

export const SOCIAL_LABEL: Record<SocialKey, string> = {
  linkedin: 'LinkedIn',
  x: 'X / Twitter',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  github: 'GitHub',
}

export const FONTS = [
  { label: 'Helvetica / Arial', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Segoe UI', value: "'Segoe UI', Tahoma, Arial, sans-serif" },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet', value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: 'Georgia (serif)', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Palatino (serif)', value: "'Palatino Linotype', Palatino, Georgia, serif" },
  { label: 'Courier (mono)', value: "'Courier New', Courier, monospace" },
]

// ---------- primitives ----------

export const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const url = (v: string) => (!v ? '#' : /^(https?:|mailto:|tel:)/i.test(v) ? v : `https://${v}`)
const bare = (v: string) => v.replace(/^https?:\/\//i, '').replace(/\/$/, '')
const hex = (c: string) => c.replace('#', '')

export function tint(color: string, amount: number) {
  const h = hex(color)
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

const icon = (name: string, color: string, outline = false) =>
  `https://img.icons8.com/${outline ? 'ios' : 'ios-filled'}/100/${hex(color)}/${name}.png`

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'

function radius(c: Ctx, size: number) {
  return c.s.design.photoShape === 'circle' ? '50%' : c.s.design.photoShape === 'rounded' ? `${Math.round(size / 5)}px` : '4px'
}

/** Generated GIFs replace CSS motion when the signature has them and animation is on. */
const motion = (c: Ctx) => (c.anim ? c.s.extras.motion : undefined)
// Photo GIFs include a margin for rings/bubbles; the photo itself is this share of the image.
// Sliced effects (shards, blinds…) fill nearly the whole image, so they scale less.
const PHOTO_FILL = 0.66
const FULL_BLEED_EFFECTS = ['shards', 'blinds', 'mosaic', 'ribbons']

function photo(c: Ctx, size: number, opts: { ring?: boolean; glow?: boolean; border?: string; pad?: number } = {}) {
  const { fields, design } = c.s
  const m = motion(c)
  if (m?.photoGif && m.photoEffect !== 'none') {
    const w = Math.round(size / (FULL_BLEED_EFFECTS.includes(m.photoEffect) ? 0.86 : PHOTO_FILL))
    return `<img src="${esc(m.photoGif)}" width="${w}" height="${w}" alt="${esc(fields.fullName)}" style="display:block;width:${w}px;height:${w}px;border:0;" />`
  }
  const r = radius(c, size)
  const cls = [opts.glow && c.anim ? 'sc-glow' : '', opts.ring && c.anim ? 'sc-ring' : ''].filter(Boolean).join(' ')
  const border = opts.border ?? (opts.ring ? `3px solid ${design.primary}` : 'none')
  const inner = fields.photo
    ? `<img src="${esc(fields.photo)}" width="${size}" height="${size}" alt="${esc(fields.fullName)}" style="display:block;width:${size}px;height:${size}px;border-radius:${r};object-fit:cover;border:${border};padding:${opts.pad ?? 0}px;background:#ffffff;" />`
    : `<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td width="${size}" height="${size}" align="center" valign="middle" bgcolor="${design.primary}" style="width:${size}px;height:${size}px;border-radius:${r};background:${design.primary};background-image:linear-gradient(135deg,${design.primary},${design.accent});color:#ffffff;font-family:${c.font};font-size:${Math.round(size / 2.6)}px;font-weight:700;border:${border};">${esc(initials(fields.fullName))}</td></tr></table>`
  return cls ? `<div class="${cls}" style="display:inline-block;border-radius:${r};">${inner}</div>` : inner
}

/** Logo for this spot. On dark backgrounds use the light variant, or put the primary logo on a white chip so it stays visible. */
function logo(c: Ctx, height: number, onDark = false) {
  const { fields, design } = c.s
  const img = (src: string) => `<img src="${esc(src)}" height="${height}" alt="${esc(fields.company)}" class="${c.anim ? 'sc-float' : ''}" style="display:block;height:${height}px;width:auto;max-width:180px;border:0;" />`
  if (onDark && fields.logoLight) return img(fields.logoLight)
  if (fields.logo)
    return onDark
      ? `<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:8px;padding:4px 8px;">${img(fields.logo)}</td></tr></table>`
      : img(fields.logo)
  if (!fields.company) return ''
  return `<span class="${c.anim ? 'sc-float' : ''}" style="display:inline-block;font-family:${c.font};font-size:${Math.round(height * 0.5)}px;font-weight:800;letter-spacing:-0.5px;color:${onDark ? '#ffffff' : design.primary};">${esc(fields.company)}</span>`
}

function badge(c: Ctx, size = 15) {
  if (!c.s.extras.verified) return ''
  const m = motion(c)
  if (m?.animateBadge && m.badgeGif)
    return `&nbsp;<img src="${esc(m.badgeGif)}" width="${size + 2}" height="${size + 2}" alt="Verified" style="display:inline-block;vertical-align:-3px;width:${size + 2}px;height:${size + 2}px;border:0;" />`
  return `&nbsp;<img src="${icon('checked-2', '#1d9bf0')}" width="${size}" height="${size}" alt="Verified" class="${c.anim ? 'sc-pop' : ''}" style="display:inline-block;vertical-align:-2px;width:${size}px;height:${size}px;border:0;" />`
}

function nameLine(c: Ctx, color: string, size: number, extra = '') {
  const { fields } = c.s
  const pron = fields.pronouns ? ` <span style="font-size:${c.base - 1}px;font-weight:400;color:${tint(color, 0.45)};">(${esc(fields.pronouns)})</span>` : ''
  return `<div style="font-family:${c.font};font-size:${size}px;line-height:1.2;font-weight:700;color:${color};${extra}">${esc(fields.fullName)}${badge(c, Math.round(size * 0.78))}${pron}</div>`
}

function roleLine(c: Ctx, color: string, opts: { company?: boolean; sep?: string } = {}) {
  const { fields } = c.s
  const parts = [fields.title, fields.department, opts.company === false ? '' : fields.company].filter(Boolean)
  if (!parts.length) return ''
  return `<div style="font-family:${c.font};font-size:${c.base}px;line-height:1.5;color:${color};">${parts.map(esc).join(opts.sep ?? ' &nbsp;|&nbsp; ')}</div>`
}

type ContactItem = { icon: string; label: string; href: string }

function contacts(c: Ctx): ContactItem[] {
  const f = c.s.fields
  const items: ContactItem[] = []
  if (f.phone) items.push({ icon: 'phone', label: f.phone, href: `tel:${f.phone.replace(/[^\d+]/g, '')}` })
  if (f.mobile) items.push({ icon: 'iphone', label: f.mobile, href: `tel:${f.mobile.replace(/[^\d+]/g, '')}` })
  if (f.email) items.push({ icon: 'new-post', label: f.email, href: `mailto:${f.email}` })
  if (f.website) items.push({ icon: 'globe', label: bare(f.website), href: url(f.website) })
  if (f.address) items.push({ icon: 'marker', label: f.address, href: `https://maps.google.com/?q=${encodeURIComponent(f.address)}` })
  return items
}

function contactList(c: Ctx, opts: { color: string; iconColor: string; icons?: boolean; chip?: boolean; gap?: number }) {
  const items = contacts(c)
  if (!items.length) return ''
  const rows = items
    .map((it) => {
      const ic = opts.icons === false
        ? ''
        : opts.chip
          ? `<td valign="middle" style="padding:0 8px 0 0;"><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td width="20" height="20" align="center" valign="middle" bgcolor="${opts.iconColor}" style="width:20px;height:20px;border-radius:50%;background:${opts.iconColor};"><img src="${icon(it.icon, '#ffffff')}" width="11" height="11" alt="" style="display:block;width:11px;height:11px;border:0;" /></td></tr></table></td>`
          : `<td valign="middle" style="padding:0 8px 0 0;"><img src="${icon(it.icon, opts.iconColor)}" width="13" height="13" alt="" style="display:block;width:13px;height:13px;border:0;" /></td>`
      return `<tr>${ic}<td valign="middle" style="padding:${opts.gap ?? 2}px 0;font-family:${c.font};font-size:${c.base}px;line-height:1.4;"><a href="${esc(it.href)}" style="color:${opts.color};text-decoration:none;">${esc(it.label)}</a></td></tr>`
    })
    .join('')
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation">${rows}</table>`
}

function contactInline(c: Ctx, color: string, sepColor: string, withAddress = true) {
  const items = contacts(c).filter((i) => withAddress || i.icon !== 'marker')
  return items
    .map((it) => `<a href="${esc(it.href)}" style="color:${color};text-decoration:none;white-space:nowrap;">${esc(it.label)}</a>`)
    .join(`<span style="color:${sepColor};">&nbsp;&nbsp;•&nbsp;&nbsp;</span>`)
}

function socials(c: Ctx, color: string, opts: { size?: number; onDark?: boolean; style?: 'filled' | 'outline' | 'plain'; vertical?: boolean; gif?: boolean } = {}) {
  const entries = (Object.entries(c.s.socials) as [SocialKey, string][]).filter(([, v]) => v)
  if (!entries.length) return ''
  const size = opts.size ?? 24
  const m = motion(c)
  const gifs = opts.gif && m?.animateIcons ? m.iconGifs : undefined
  if (opts.vertical || gifs) {
    const cells = entries.map(([k, v]) => {
      const img = gifs?.[k]
        ? `<img src="${esc(gifs[k]!)}" width="${size}" height="${size}" alt="${SOCIAL_LABEL[k]}" style="display:block;width:${size}px;height:${size}px;border:0;" />`
        : `<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td width="${size}" height="${size}" align="center" valign="middle" bgcolor="${color}" style="width:${size}px;height:${size}px;border-radius:50%;background:${color};"><img src="${icon(SOCIAL_ICON[k], '#ffffff')}" width="${Math.round(size * 0.52)}" height="${Math.round(size * 0.52)}" alt="${SOCIAL_LABEL[k]}" style="display:block;border:0;" /></td></tr></table>`
      const link = `<a href="${esc(url(v))}" class="${c.anim ? 'sc-lift' : ''}" style="display:inline-block;text-decoration:none;">${img}</a>`
      return opts.vertical ? `<tr><td style="padding:3px 0;">${link}</td></tr>` : `<td style="padding:0 6px 0 0;">${link}</td>`
    }).join('')
    return `<table cellpadding="0" cellspacing="0" border="0" role="presentation">${opts.vertical ? cells : `<tr>${cells}</tr>`}</table>`
  }
  const style = opts.style ?? c.s.design.iconStyle
  const cells = entries
    .map(([k, v]) => {
      const inner = Math.round(size * 0.56)
      let cell: string
      if (style === 'filled') {
        const fg = opts.onDark ? color : '#ffffff'
        const bg = opts.onDark ? '#ffffff' : color
        cell = `<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td width="${size}" height="${size}" align="center" valign="middle" bgcolor="${bg}" style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};"><img src="${icon(SOCIAL_ICON[k], fg)}" width="${inner}" height="${inner}" alt="${SOCIAL_LABEL[k]}" style="display:block;width:${inner}px;height:${inner}px;border:0;" /></td></tr></table>`
      } else if (style === 'outline') {
        cell = `<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td width="${size - 2}" height="${size - 2}" align="center" valign="middle" style="width:${size - 2}px;height:${size - 2}px;border-radius:50%;border:1px solid ${color};"><img src="${icon(SOCIAL_ICON[k], color)}" width="${inner}" height="${inner}" alt="${SOCIAL_LABEL[k]}" style="display:block;width:${inner}px;height:${inner}px;border:0;" /></td></tr></table>`
      } else {
        cell = `<img src="${icon(SOCIAL_ICON[k], color)}" width="${Math.round(size * 0.75)}" height="${Math.round(size * 0.75)}" alt="${SOCIAL_LABEL[k]}" style="display:block;border:0;" />`
      }
      return `<td style="padding:0 6px 0 0;"><a href="${esc(url(v))}" class="${c.anim ? 'sc-lift' : ''}" style="display:inline-block;text-decoration:none;">${cell}</a></td>`
    })
    .join('')
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>${cells}</tr></table>`
}

function navBar(c: Ctx, opts: { bg: string; color: string; border?: string; radius?: number }) {
  const links = c.s.extras.navLinks.filter((l) => l.label)
  if (!links.length) return ''
  const cells = links
    .map(
      (l) =>
        `<td style="padding:0 4px 0 0;"><a href="${esc(url(l.url))}" class="${c.anim ? 'sc-nav' : ''}" style="display:inline-block;padding:5px 12px;border-radius:${opts.radius ?? 999}px;background:${opts.bg};border:${opts.border ?? '0'};color:${opts.color};font-family:${c.font};font-size:${c.base - 1}px;font-weight:600;text-decoration:none;">${esc(l.label)}</a></td>`,
    )
    .join('')
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>${cells}</tr></table>`
}

function ctaButton(c: Ctx, bg: string, fg = '#ffffff', square = false) {
  const cta = c.s.extras.cta
  if (!cta?.label) return ''
  const m = motion(c)
  if (m?.animateCta && m.ctaGif)
    return `<a href="${esc(url(cta.url))}" style="display:inline-block;text-decoration:none;"><img src="${esc(m.ctaGif)}" width="${m.ctaWidth ?? 140}" alt="${esc(cta.label)}" style="display:block;border:0;width:${m.ctaWidth ?? 140}px;height:auto;" /></a>`
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td bgcolor="${bg}" style="border-radius:${square ? 4 : 999}px;background:${bg};"><a href="${esc(url(cta.url))}" class="${c.anim ? 'sc-nav' : ''}" style="display:inline-block;padding:8px 18px;font-family:${c.font};font-size:${c.base}px;font-weight:700;color:${fg};text-decoration:none;border-radius:${square ? 4 : 999}px;">${esc(cta.label)} &rarr;</a></td></tr></table>`
}

export function bannerHtml(b: Campaign, font: string, anim: boolean, width = 600) {
  if ((b.style === 'image' || b.style === 'designed') && b.image)
    return `<a href="${esc(url(b.url))}" style="display:block;text-decoration:none;"><img src="${esc(b.image)}" width="${width}" alt="${esc(b.headline)}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;border-radius:12px;" /></a>`
  const dark = b.style !== 'light'
  const bg = b.style === 'dark' ? '#0f172a' : b.style === 'light' ? tint(b.from, 0.9) : b.from
  const bgImg = b.style === 'gradient' ? `background-image:linear-gradient(120deg,${b.from},${b.to});` : b.style === 'dark' ? `background-image:linear-gradient(120deg,#0f172a,${b.from});` : ''
  const fg = dark ? '#ffffff' : '#0f172a'
  const sub = dark ? 'rgba(255,255,255,0.82)' : '#475569'
  const btnBg = dark ? '#ffffff' : b.from
  const btnFg = dark ? b.from : '#ffffff'
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="max-width:${width}px;"><tr><td bgcolor="${bg}" class="${anim ? 'sc-shine' : ''}" style="background:${bg};${bgImg}border-radius:12px;padding:16px 20px;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%"><tr>
<td valign="middle" style="font-family:${font};"><div style="font-size:16px;font-weight:800;line-height:1.25;color:${fg};">${esc(b.headline)}</div>${b.subline ? `<div style="font-size:12px;line-height:1.45;color:${sub};padding-top:3px;">${esc(b.subline)}</div>` : ''}</td>
${b.ctaLabel ? `<td valign="middle" align="right" style="padding-left:12px;white-space:nowrap;"><a href="${esc(url(b.url))}" style="display:inline-block;padding:8px 14px;border-radius:999px;background:${btnBg};color:${btnFg};font-family:${font};font-size:12px;font-weight:700;text-decoration:none;">${esc(b.ctaLabel)}</a></td>` : ''}
</tr></table></td></tr></table>`
}

function banner(c: Ctx, width = 600) {
  return c.campaign ? `<tr><td style="padding-top:14px;">${bannerHtml(c.campaign, c.font, c.anim, width)}</td></tr>` : ''
}

function disclaimer(c: Ctx, color = '#94a3b8') {
  const d = c.s.extras.disclaimer
  return d ? `<tr><td style="padding-top:12px;font-family:${c.font};font-size:${Math.max(9, c.base - 3)}px;line-height:1.5;color:${color};max-width:520px;">${esc(d)}</td></tr>` : ''
}

function quote(c: Ctx, color: string, italic = true) {
  const q = c.s.extras.quote
  return q ? `<div style="font-family:${c.font};font-size:${c.base - 1}px;line-height:1.5;color:${color};${italic ? 'font-style:italic;' : ''}padding-top:6px;">${esc(q)}</div>` : ''
}

const wrap = (c: Ctx, body: string, extra = '') =>
  `<table cellpadding="0" cellspacing="0" border="0" role="presentation" class="sc-root" style="--sc-c:${c.s.design.primary};font-family:${c.font};color:${c.s.design.text};${extra}">${body}</table>`

// ---------- templates ----------

const T: Record<string, (c: Ctx) => string> = {
  aurora(c) {
    const { primary, accent, text } = c.s.design
    return wrap(
      c,
      `<tr><td><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
<td valign="middle" style="padding-right:18px;">${photo(c, 96, { ring: true, glow: true, border: `3px solid #ffffff` })}<div style="padding-top:10px;text-align:center;">${logo(c, 26)}</div></td>
<td valign="top" width="4" bgcolor="${primary}" style="width:4px;border-radius:4px;background:${primary};background-image:linear-gradient(180deg,${primary},${accent});">&nbsp;</td>
<td valign="top" style="padding-left:18px;">
${nameLine(c, text, c.base + 7)}
${roleLine(c, primary)}
<div style="height:10px;line-height:10px;">&nbsp;</div>
${contactList(c, { color: tint(text, 0.2), iconColor: primary, chip: true, gap: 3 })}
<div style="height:10px;line-height:10px;">&nbsp;</div>
${socials(c, primary)}
</td></tr></table></td></tr>
${c.s.extras.navLinks.length ? `<tr><td style="padding-top:14px;">${navBar(c, { bg: tint(primary, 0.88), color: primary })}</td></tr>` : ''}
${c.s.extras.cta ? `<tr><td style="padding-top:12px;">${ctaButton(c, primary)}</td></tr>` : ''}
${banner(c)}${disclaimer(c)}`,
    )
  },

  minimal(c) {
    const { primary, text } = c.s.design
    return wrap(
      c,
      `<tr><td>${nameLine(c, text, c.base + 5)}${roleLine(c, tint(text, 0.4))}</td></tr>
<tr><td style="padding:10px 0;"><div style="width:44px;height:2px;background:${primary};line-height:2px;font-size:0;">&nbsp;</div></td></tr>
<tr><td style="font-family:${c.font};font-size:${c.base}px;line-height:1.6;">${contactInline(c, tint(text, 0.25), primary)}</td></tr>
${Object.values(c.s.socials).some(Boolean) ? `<tr><td style="padding-top:10px;">${socials(c, primary, { size: 20, style: 'plain' })}</td></tr>` : ''}
${c.s.extras.cta ? `<tr><td style="padding-top:10px;">${ctaButton(c, primary)}</td></tr>` : ''}
${banner(c)}${disclaimer(c)}`,
    )
  },

  executive(c) {
    const { primary, accent, text } = c.s.design
    const serif = "Georgia, 'Times New Roman', serif"
    return wrap(
      c,
      `<tr><td><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
<td valign="middle" align="center" style="padding-right:22px;border-right:1px solid ${tint(accent, 0.4)};">${photo(c, 84)}<div style="padding-top:12px;">${logo(c, 24)}</div></td>
<td valign="middle" style="padding-left:22px;">
<div style="font-family:${serif};font-size:${c.base + 8}px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${text};">${esc(c.s.fields.fullName)}${badge(c, 16)}</div>
<div style="width:56px;height:2px;background:${accent};margin:8px 0;line-height:2px;font-size:0;">&nbsp;</div>
<div style="font-family:${serif};font-size:${c.base + 1}px;font-style:italic;color:${primary};padding-bottom:8px;">${esc([c.s.fields.title, c.s.fields.company].filter(Boolean).join(', '))}</div>
${contactList(c, { color: tint(text, 0.25), iconColor: accent })}
<div style="padding-top:10px;">${socials(c, accent, { size: 22, style: 'outline' })}</div>
</td></tr></table></td></tr>
${c.s.extras.cta ? `<tr><td style="padding-top:14px;">${ctaButton(c, primary, '#ffffff', true)}</td></tr>` : ''}
${banner(c)}${disclaimer(c)}`,
    )
  },

  neon(c) {
    const { primary, accent } = c.s.design
    return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" class="sc-root" style="--sc-c:${accent};font-family:${c.font};"><tr><td bgcolor="#0b0b1e" style="background:#0b0b1e;background-image:radial-gradient(circle at 0% 0%,${primary}55,transparent 55%),radial-gradient(circle at 100% 100%,${accent}40,transparent 50%);border-radius:18px;padding:22px 24px;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
<td valign="middle" style="padding-right:18px;">${photo(c, 84, { glow: true, ring: true, border: `2px solid ${accent}` })}</td>
<td valign="middle">
${nameLine(c, '#ffffff', c.base + 7)}
<div style="font-family:${c.font};font-size:${c.base}px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${accent};padding:4px 0 10px;">${esc([c.s.fields.title, c.s.fields.company].filter(Boolean).join(' · '))}</div>
${contactList(c, { color: '#cbd5e1', iconColor: accent })}
</td></tr></table>
<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.12);"><tr>
<td style="padding-top:14px;">${socials(c, accent, { style: 'outline', size: 26 })}</td>
<td align="right" style="padding-top:14px;">${navBar(c, { bg: 'rgba(255,255,255,0.08)', color: '#ffffff', border: `1px solid ${accent}66` }) || ctaButton(c, accent, '#0b0b1e')}</td>
</tr></table>
</td></tr>${banner(c)}${disclaimer(c, '#64748b')}</table>`
  },

  realtor(c) {
    const { primary, accent, text } = c.s.design
    return wrap(
      c,
      `<tr><td style="border:1px solid ${tint(primary, 0.82)};border-radius:14px;overflow:hidden;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
<td valign="top" style="padding:16px;">${photo(c, 112, { border: `4px solid ${tint(accent, 0.6)}` })}</td>
<td valign="top" style="padding:16px 18px 16px 4px;">
${nameLine(c, text, c.base + 7)}
<div style="font-family:${c.font};font-size:${c.base}px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:1px;padding:3px 0 10px;">${esc(c.s.fields.title)}</div>
${contactList(c, { color: tint(text, 0.2), iconColor: primary, chip: true, gap: 3 })}
<div style="padding-top:12px;">${ctaButton(c, accent, '#ffffff', true)}</div>
</td>
<td valign="top" align="right" style="padding:16px;">${logo(c, 34)}</td>
</tr></table>
<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%"><tr><td bgcolor="${primary}" style="background:${primary};padding:9px 16px;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%"><tr>
<td style="font-family:${c.font};font-size:${c.base - 1}px;color:#ffffff;font-weight:600;">${esc(c.s.fields.company)}</td>
<td align="right">${socials(c, '#ffffff', { size: 20, style: 'plain' })}</td>
</tr></table></td></tr></table>
</td></tr>${banner(c)}${disclaimer(c)}`,
    )
  },

  clinic(c) {
    const { primary, accent, text } = c.s.design
    return wrap(
      c,
      `<tr><td bgcolor="${tint(primary, 0.92)}" style="background:${tint(primary, 0.92)};border-radius:14px 14px 0 0;padding:14px 18px;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
<td valign="middle" style="padding-right:14px;">${photo(c, 64, { border: '3px solid #ffffff' })}</td>
<td valign="middle">${nameLine(c, text, c.base + 5)}<div style="font-family:${c.font};font-size:${c.base}px;color:${primary};font-weight:600;">${esc([c.s.fields.title, c.s.fields.department].filter(Boolean).join(' · '))}</div></td>
</tr></table></td></tr>
<tr><td style="border:1px solid ${tint(primary, 0.85)};border-top:0;border-radius:0 0 14px 14px;padding:14px 18px;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%"><tr>
<td valign="top">${contactList(c, { color: tint(text, 0.2), iconColor: primary })}</td>
<td valign="top" align="right" style="padding-left:16px;">${logo(c, 30)}<div style="padding-top:10px;">${ctaButton(c, accent)}</div></td>
</tr></table>
${Object.values(c.s.socials).some(Boolean) ? `<div style="padding-top:10px;">${socials(c, primary, { size: 22 })}</div>` : ''}
</td></tr>${banner(c)}${disclaimer(c)}`,
    )
  },

  finance(c) {
    const { primary, accent, text } = c.s.design
    const items = contacts(c)
    const half = Math.ceil(items.length / 2)
    const col = (list: ContactItem[]) =>
      list.map((i) => `<div style="font-family:${c.font};font-size:${c.base}px;line-height:1.7;"><span style="color:${accent};font-weight:700;">${i.icon === 'phone' ? 'T' : i.icon === 'iphone' ? 'M' : i.icon === 'new-post' ? 'E' : i.icon === 'globe' ? 'W' : 'A'}</span>&nbsp;&nbsp;<a href="${esc(i.href)}" style="color:${tint(text, 0.2)};text-decoration:none;">${esc(i.label)}</a></div>`).join('')
    return wrap(
      c,
      `<tr><td><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
<td valign="middle" bgcolor="${primary}" style="background:${primary};border-radius:12px;padding:16px;text-align:center;">${c.s.fields.logo ? logo(c, 34) : `<span style="font-family:${c.font};font-size:22px;font-weight:800;color:#ffffff;">${esc(initials(c.s.fields.company || c.s.fields.fullName))}</span>`}</td>
<td valign="middle" style="padding-left:18px;">
${nameLine(c, primary, c.base + 6)}
${roleLine(c, tint(text, 0.35))}
</td></tr></table></td></tr>
<tr><td style="padding-top:12px;border-bottom:2px solid ${accent};"></td></tr>
<tr><td style="padding-top:10px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td valign="top" style="padding-right:28px;">${col(items.slice(0, half))}</td><td valign="top">${col(items.slice(half))}</td></tr></table></td></tr>
${Object.values(c.s.socials).some(Boolean) || c.s.extras.cta ? `<tr><td style="padding-top:10px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td>${socials(c, primary, { size: 22, style: 'filled' })}</td><td style="padding-left:12px;">${ctaButton(c, accent, '#ffffff', true)}</td></tr></table></td></tr>` : ''}
${banner(c)}${disclaimer(c)}`,
    )
  },

  startup(c) {
    const { primary, accent, text } = c.s.design
    return wrap(
      c,
      `<tr><td style="border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%"><tr><td bgcolor="${primary}" style="background:${primary};background-image:linear-gradient(110deg,${primary},${accent});padding:12px 16px;border-radius:16px 16px 0 0;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%"><tr>
<td valign="middle">${logo(c, 24, true)}</td>
<td valign="middle" align="right">${navBar(c, { bg: 'rgba(255,255,255,0.18)', color: '#ffffff' })}</td>
</tr></table></td></tr></table>
<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
<td valign="top" style="padding:16px 14px 16px 16px;">${photo(c, 76, { glow: true })}</td>
<td valign="top" style="padding:16px 18px 16px 0;">
${nameLine(c, text, c.base + 6)}
${roleLine(c, tint(text, 0.4), { company: false })}
<div style="padding-top:8px;font-family:${c.font};font-size:${c.base}px;line-height:1.7;">${contactInline(c, tint(text, 0.2), accent, false)}</div>
<div style="padding-top:10px;">${socials(c, primary, { size: 22 })}</div>
</td></tr></table>
</td></tr>
${c.s.extras.cta ? `<tr><td style="padding-top:12px;">${ctaButton(c, primary)}</td></tr>` : ''}
${banner(c)}${disclaimer(c)}`,
    )
  },

  creator(c) {
    const { primary, accent, text } = c.s.design
    return wrap(
      c,
      `<tr><td align="center" style="text-align:center;padding:4px 24px;">
<div style="display:inline-block;padding:4px;border-radius:50%;background:${primary};background-image:conic-gradient(${primary},${accent},${primary});" class="${c.anim ? 'sc-spin-ring' : ''}"><div style="padding:3px;border-radius:50%;background:#ffffff;">${photo(c, 88)}</div></div>
<div style="padding-top:10px;">${nameLine(c, text, c.base + 7, 'text-align:center;')}</div>
<div style="font-family:${c.font};font-size:${c.base}px;color:${primary};font-weight:600;">${esc([c.s.fields.title, c.s.fields.company].filter(Boolean).join(' @ '))}</div>
${quote(c, tint(text, 0.4))}
<div style="padding-top:12px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" style="margin:0 auto;"><tr><td>${socials(c, primary, { size: 30 })}</td></tr></table></div>
<div style="padding-top:12px;font-family:${c.font};font-size:${c.base - 1}px;">${contactInline(c, tint(text, 0.3), accent, false)}</div>
${c.s.extras.cta ? `<div style="padding-top:12px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center" style="margin:0 auto;"><tr><td>${ctaButton(c, accent)}</td></tr></table></div>` : ''}
</td></tr>${banner(c)}${disclaimer(c)}`,
    )
  },

  counsel(c) {
    const { primary, text } = c.s.design
    const serif = "Georgia, 'Times New Roman', serif"
    return wrap(
      c,
      `<tr><td style="font-family:${serif};">
<div style="font-size:${c.base + 6}px;font-weight:700;color:${text};">${esc(c.s.fields.fullName)}${badge(c, 15)}</div>
<div style="font-size:${c.base}px;color:${tint(text, 0.35)};padding-top:2px;">${esc(c.s.fields.title)}</div>
<div style="font-size:${c.base + 1}px;font-weight:700;color:${primary};letter-spacing:2px;text-transform:uppercase;padding-top:8px;">${esc(c.s.fields.company)}</div>
</td></tr>
<tr><td style="padding:10px 0;"><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="360"><tr><td style="border-top:1px solid ${primary};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
<tr><td><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td valign="top" style="padding-right:20px;">${contactList(c, { color: tint(text, 0.2), iconColor: primary, icons: false })}</td><td valign="top">${logo(c, 40)}</td></tr></table></td></tr>
${Object.values(c.s.socials).some(Boolean) ? `<tr><td style="padding-top:8px;">${socials(c, primary, { size: 20, style: 'plain' })}</td></tr>` : ''}
${banner(c)}${disclaimer(c)}`,
    )
  },

  campus(c) {
    const { primary, accent, text } = c.s.design
    return wrap(
      c,
      `<tr><td><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
<td valign="top" style="padding-right:16px;">${photo(c, 80, { border: `3px solid ${accent}` })}</td>
<td valign="top">
${nameLine(c, primary, c.base + 6)}
<div style="font-family:${c.font};font-size:${c.base}px;color:${text};font-weight:600;padding-top:2px;">${esc(c.s.fields.title)}</div>
<div style="font-family:${c.font};font-size:${c.base}px;color:${tint(text, 0.4)};">${esc([c.s.fields.department, c.s.fields.company].filter(Boolean).join(', '))}</div>
${c.s.extras.quote ? `<div style="margin-top:8px;padding:6px 10px;border-left:3px solid ${accent};background:${tint(accent, 0.9)};font-family:${c.font};font-size:${c.base - 1}px;color:${text};">${esc(c.s.extras.quote)}</div>` : ''}
<div style="padding-top:8px;">${contactList(c, { color: tint(text, 0.2), iconColor: accent })}</div>
</td>
<td valign="top" style="padding-left:16px;">${logo(c, 44)}</td>
</tr></table></td></tr>
${Object.values(c.s.socials).some(Boolean) || c.s.extras.cta ? `<tr><td style="padding-top:12px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td>${socials(c, primary, { size: 22 })}</td><td style="padding-left:10px;">${ctaButton(c, accent)}</td></tr></table></td></tr>` : ''}
${banner(c)}${disclaimer(c)}`,
    )
  },

  spotlight(c) {
    const { primary, accent, text } = c.s.design
    const fallback: Campaign = {
      id: 'inline', name: '', headline: c.s.extras.cta?.label || `Discover ${c.s.fields.company || 'what we do'}`,
      subline: c.s.extras.quote || bare(c.s.fields.website), ctaLabel: c.s.extras.cta ? 'Learn more' : '',
      url: c.s.extras.cta?.url || c.s.fields.website, image: '', style: 'gradient', from: primary, to: accent,
      start: '', end: '', departments: [], active: true,
    }
    return wrap(
      c,
      `<tr><td><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%"><tr>
<td valign="middle" style="padding-right:14px;" width="64">${photo(c, 60)}</td>
<td valign="middle">${nameLine(c, text, c.base + 5)}${roleLine(c, primary, { sep: ' · ' })}</td>
<td valign="middle" align="right">${socials(c, primary, { size: 24 })}</td>
</tr></table></td></tr>
<tr><td style="padding-top:8px;font-family:${c.font};font-size:${c.base}px;">${contactInline(c, tint(text, 0.3), accent, false)}</td></tr>
<tr><td style="padding-top:14px;">${bannerHtml(c.campaign ?? fallback, c.font, c.anim)}</td></tr>
${disclaimer(c)}`,
    )
  },

  compact(c) {
    const { primary, text } = c.s.design
    const f = c.s.fields
    return wrap(
      c,
      `<tr><td style="font-family:${c.font};font-size:${c.base}px;line-height:1.6;color:${tint(text, 0.3)};">
<strong style="color:${text};">${esc(f.fullName)}</strong>${badge(c, 13)}<span style="color:${primary};">&nbsp;&nbsp;/&nbsp;&nbsp;</span>${esc([f.title, f.company].filter(Boolean).join(', '))}<br />
${contactInline(c, tint(text, 0.3), primary, false)}
</td></tr>
${Object.values(c.s.socials).some(Boolean) ? `<tr><td style="padding-top:6px;">${socials(c, primary, { size: 18, style: 'plain' })}</td></tr>` : ''}
${banner(c)}${disclaimer(c)}`,
    )
  },

  horizon(c) {
    const { primary, accent, text } = c.s.design
    const chips = contacts(c)
      .filter((i) => i.icon !== 'marker')
      .map((i) => `<td style="padding:0 6px 6px 0;"><a href="${esc(i.href)}" style="display:inline-block;padding:4px 10px;border-radius:999px;background:${tint(primary, 0.9)};color:${primary};font-family:${c.font};font-size:${c.base - 1}px;font-weight:600;text-decoration:none;white-space:nowrap;"><img src="${icon(i.icon, primary)}" width="11" height="11" alt="" style="vertical-align:-1px;border:0;" />&nbsp; ${esc(i.label)}</a></td>`)
      .join('')
    return wrap(
      c,
      `<tr><td style="padding-bottom:10px;">${logo(c, 28)}</td></tr>
<tr><td><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%"><tr>
<td valign="bottom">${nameLine(c, text, c.base + 10, 'letter-spacing:-0.5px;')}${roleLine(c, tint(text, 0.4))}</td>
<td valign="bottom" align="right" style="padding-left:16px;">${photo(c, 58)}</td>
</tr></table></td></tr>
<tr><td style="padding-top:10px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>${chips}</tr></table></td></tr>
<tr><td style="padding-top:4px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%"><tr><td>${socials(c, primary, { size: 22, style: 'outline' })}</td><td align="right">${ctaButton(c, primary)}</td></tr></table></td></tr>
<tr><td style="padding-top:12px;"><div style="height:4px;border-radius:4px;background:${primary};background-image:linear-gradient(90deg,${primary},${accent},${tint(accent, 0.6)});line-height:4px;font-size:0;">&nbsp;</div></td></tr>
${banner(c)}${disclaimer(c)}`,
    )
  },

  mono(c) {
    const f = c.s.fields
    const ink = c.s.design.text
    return wrap(
      c,
      `<tr><td><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
<td valign="top" style="padding-right:18px;">${photo(c, 90, { border: `2px solid ${ink}` })}</td>
<td valign="top">
<div style="font-family:${c.font};font-size:${c.base + 12}px;line-height:1;font-weight:900;letter-spacing:-1px;color:${ink};text-transform:uppercase;">${esc(f.fullName.split(' ')[0] || '')}</div>
<div style="font-family:${c.font};font-size:${c.base + 12}px;line-height:1.05;font-weight:300;letter-spacing:-1px;color:${ink};text-transform:uppercase;">${esc(f.fullName.split(' ').slice(1).join(' '))}${badge(c, 16)}</div>
<div style="display:inline-block;margin-top:8px;padding:3px 8px;background:${ink};color:#ffffff;font-family:${c.font};font-size:${c.base - 2}px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${esc([f.title, f.company].filter(Boolean).join(' / '))}</div>
<div style="padding-top:10px;">${contactList(c, { color: ink, iconColor: ink })}</div>
</td></tr></table></td></tr>
${Object.values(c.s.socials).some(Boolean) || c.s.extras.cta ? `<tr><td style="padding-top:12px;border-top:2px solid ${ink};"><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin-top:10px;"><tr><td>${socials(c, ink, { size: 22, style: 'filled' })}</td><td align="right">${ctaButton(c, ink, '#ffffff', true)}</td></tr></table></td></tr>` : ''}
${banner(c)}${disclaimer(c)}`,
    )
  },

  motion(c) {
    const { primary, accent, text } = c.s.design
    const f = c.s.fields
    const hasSocial = Object.values(c.s.socials).some(Boolean)
    const line = (label: string, href: string) =>
      `<div style="font-family:${c.font};font-size:${c.base}px;line-height:1.65;"><a href="${esc(href)}" style="color:${tint(text, 0.18)};text-decoration:none;">${esc(label)}</a></div>`
    return wrap(
      c,
      `<tr><td style="border:1px solid #e6e3dd;border-radius:14px;padding:16px 18px;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
${hasSocial ? `<td valign="middle" style="padding-right:18px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td align="center" style="border:1px solid #e6e3dd;border-radius:999px;padding:8px 7px;">${socials(c, primary, { size: 26, vertical: true, gif: true })}</td></tr></table></td>` : ''}
<td valign="middle">
${f.logo || f.company ? `<div style="padding-bottom:10px;">${logo(c, 26)}</div>` : ''}
${nameLine(c, text, c.base + 5)}
<div style="font-family:${c.font};font-size:${c.base - 1}px;color:${tint(text, 0.38)};padding:2px 0 6px;">${esc(f.title)}</div>
${f.company ? `<div style="font-family:${c.font};font-size:${c.base - 2}px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${primary};padding-bottom:6px;">${esc(f.company)}</div>` : ''}
${f.phone ? line(f.phone, `tel:${f.phone.replace(/[^\d+]/g, '')}`) : ''}
${f.mobile ? line(f.mobile, `tel:${f.mobile.replace(/[^\d+]/g, '')}`) : ''}
${f.email ? line(f.email, `mailto:${f.email}`) : ''}
${f.website ? line(bare(f.website), url(f.website)) : ''}
${c.s.extras.cta ? `<div style="padding-top:10px;">${ctaButton(c, primary)}</div>` : ''}
</td>
<td valign="middle" style="padding-left:16px;">${photo(c, 112, { ring: true, glow: true, border: `3px solid ${accent}` })}</td>
</tr></table>
</td></tr>${banner(c)}${disclaimer(c)}`,
    )
  },

  pastel(c) {
    const { primary, accent, text } = c.s.design
    return wrap(
      c,
      `<tr><td bgcolor="${tint(accent, 0.86)}" style="background:${tint(accent, 0.86)};background-image:linear-gradient(135deg,${tint(primary, 0.88)},${tint(accent, 0.84)});border-radius:22px;padding:18px 20px;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
<td valign="middle" style="padding-right:16px;">${photo(c, 82, { border: '4px solid #ffffff', glow: true })}</td>
<td valign="middle">
${nameLine(c, text, c.base + 6)}
<div style="font-family:${c.font};font-size:${c.base}px;color:${primary};font-weight:600;padding-bottom:8px;">${esc([c.s.fields.title, c.s.fields.company].filter(Boolean).join(' · '))}</div>
${contactList(c, { color: tint(text, 0.15), iconColor: primary })}
</td></tr></table>
<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="margin-top:12px;"><tr>
<td>${socials(c, primary, { size: 24, onDark: true, style: 'filled' })}</td>
<td align="right">${navBar(c, { bg: '#ffffff', color: primary }) || ctaButton(c, primary)}</td>
</tr></table>
</td></tr>${banner(c)}${disclaimer(c)}`,
    )
  },
}


// ---------- classic layout engine ----------

const CONTACT_META: Record<string, { label: string; letter: string; icon: string }> = {
  phone: { label: 'Phone', letter: 'P', icon: 'phone' },
  iphone: { label: 'Mobile', letter: 'M', icon: 'iphone' },
  'new-post': { label: 'Email', letter: 'E', icon: 'mail' },
  globe: { label: 'Website', letter: 'W', icon: 'globe' },
  marker: { label: 'Address', letter: 'A', icon: 'marker' },
}
const CLASSIC_COLOR_ICON: Record<SocialKey, string> = { linkedin: 'linkedin', x: 'twitterx', instagram: 'instagram-new', facebook: 'facebook-new', youtube: 'youtube-play', tiktok: 'tiktok', github: 'github' }

function classic(c: Ctx, r: ClassicRecipe) {
  const { primary, text } = c.s.design
  const f = c.s.fields
  const muted = '#6b7280'
  const ink = tint(text, 0.12)
  const nameCol = r.nameColor === 'accent' ? primary : text
  const titleCol = r.titleColor === 'accent' ? primary : muted
  const ruleCol = r.ruleColor === 'accent' ? primary : r.ruleColor === 'ink' ? text : '#e4e5e7'
  const items = contacts(c)
  const td = (inner: string, style = '') => `<td valign="middle" style="${style}">${inner}</td>`
  const T0 = '<table cellpadding="0" cellspacing="0" border="0" role="presentation"'

  const photoHtml = () =>
    r.photo === 'ring' ? photo(c, r.photoSize, { border: `5px solid ${primary}` })
      : r.photo === 'thinring' ? photo(c, r.photoSize, { border: `2px solid ${primary}`, pad: 3 })
        : photo(c, r.photoSize)

  const nameHtml = (align: string) => {
    const full = r.nameUpper ? f.fullName.toUpperCase() : f.fullName
    const parts = full.split(' ')
    const shown = r.nameStacked && parts.length > 1 ? `${esc(parts[0])}<br />${esc(parts.slice(1).join(' '))}` : esc(full)
    const role = [f.title, f.company].filter(Boolean).map(esc).join(' - ')
    return `<div style="font-family:${c.font};font-size:${c.base + 6}px;line-height:1.15;font-weight:700;letter-spacing:${r.nameUpper ? 0.4 : 0}px;color:${nameCol};text-align:${align};">${shown}${badge(c, 14)}</div>`
      + (role ? `<div style="font-family:${c.font};font-size:${c.base - 1}px;line-height:1.4;color:${titleCol};padding-top:3px;text-align:${align};">${role}</div>` : '')
      + (f.logo ? `<div style="padding-top:8px;">${logo(c, 24)}</div>` : '')
  }

  const link = (it: ContactItem) => `<a href="${esc(it.href)}" style="color:${ink};text-decoration:none;">${esc(it.label)}</a>`
  const ico = (name: string, sz = 13) => `<img src="${icon(CONTACT_META[name].icon, primary, true)}" width="${sz}" height="${sz}" alt="" style="display:inline-block;vertical-align:-2px;width:${sz}px;height:${sz}px;border:0;" />`
  const rowStyle = `font-family:${c.font};font-size:${c.base - 1}px;line-height:1.6;color:${ink};`

  const contactsHtml = () => {
    if (!items.length) return ''
    switch (r.contacts) {
      case 'letter': {
        const by = (k: string) => items.find((i) => i.icon === k)
        const L = (it: ContactItem) => `<b style="color:${primary};">${CONTACT_META[it.icon].letter}:</b> ${link(it)}`
        const first = [by('new-post'), by('globe')].filter(Boolean) as ContactItem[]
        const rest = items.filter((i) => !first.includes(i))
        return [first.length ? `<div style="${rowStyle}">${first.map(L).join('&nbsp;&nbsp;')}</div>` : '', ...rest.map((i) => `<div style="${rowStyle}">${L(i)}</div>`)].join('')
      }
      case 'label':
        return `${T0}>${items.map((i) => `<tr><td valign="top" style="${rowStyle}font-weight:700;color:${primary};padding-right:6px;white-space:nowrap;">${CONTACT_META[i.icon].label}</td><td valign="top" style="${rowStyle}color:${primary};padding-right:6px;">:</td><td valign="top" style="${rowStyle}">${link(i)}</td></tr>`).join('')}</table>`
      case 'icon':
        return `${T0}>${items.map((i) => `<tr><td valign="top" style="padding:3px 8px 0 0;">${ico(i.icon)}</td><td valign="top" style="${rowStyle}">${link(i)}</td></tr>`).join('')}</table>`
      case 'plain':
        return items.map((i) => `<div style="${rowStyle}">${link(i)}</div>`).join('')
      case 'inline': {
        const top = items.filter((i) => i.icon !== 'marker')
        const addr = items.find((i) => i.icon === 'marker')
        return `<div style="${rowStyle}">${top.map((i) => `${ico(i.icon, 12)}&nbsp;${link(i)}`).join(`<span style="color:${primary};">&nbsp;&nbsp;•&nbsp;&nbsp;</span>`)}</div>` + (addr ? `<div style="${rowStyle}">${ico('marker', 12)}&nbsp;${link(addr)}</div>` : '')
      }
      case 'grid': {
        const rows: ContactItem[][] = []
        for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2))
        return `${T0}>${rows.map((row) => `<tr>${row.map((i) => `<td valign="top" style="padding:2px 18px 2px 0;"><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td valign="top" style="padding:3px 6px 0 0;">${ico(i.icon)}</td><td style="${rowStyle}">${link(i)}</td></tr></table></td>`).join('')}</tr>`).join('')}</table>`
      }
    }
  }

  const socialsHtml = (align = 'left') => {
    const entries = (Object.entries(c.s.socials) as [SocialKey, string][]).filter(([, v]) => v)
    if (!entries.length) return ''
    const m = motion(c)
    const cells = entries.map(([k, v]) => {
      let inner: string
      if (m?.animateIcons && m.iconGifs?.[k]) inner = `<img src="${esc(m.iconGifs[k]!)}" width="22" height="22" alt="${SOCIAL_LABEL[k]}" style="display:block;border:0;" />`
      else if (r.socials === 'color') inner = `<img src="https://img.icons8.com/color/48/${CLASSIC_COLOR_ICON[k]}.png" width="22" height="22" alt="${SOCIAL_LABEL[k]}" style="display:block;border:0;" />`
      else if (r.socials === 'dark') inner = `<img src="${icon(SOCIAL_ICON[k], '#222222')}" width="18" height="18" alt="${SOCIAL_LABEL[k]}" style="display:block;border:0;" />`
      else {
        const col = r.socials === 'accent' ? primary : muted
        inner = `<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td width="20" height="20" align="center" valign="middle" style="width:20px;height:20px;border:1px solid ${r.socials === 'accent' ? primary : '#d1d5db'};border-radius:4px;"><img src="${icon(SOCIAL_ICON[k], col)}" width="12" height="12" alt="${SOCIAL_LABEL[k]}" style="display:block;border:0;" /></td></tr></table>`
      }
      return `<td style="padding:0 5px 0 0;"><a href="${esc(url(v))}" class="${c.anim ? 'sc-lift' : ''}" style="display:inline-block;text-decoration:none;">${inner}</a></td>`
    }).join('')
    return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" align="${align}" style="margin-top:8px;"><tr>${cells}</tr></table>`
  }

  const block = (b: Block, align: string) =>
    b === 'photo' ? `<div style="text-align:${align};">${photoHtml()}</div>`
      : b === 'name' ? nameHtml(align)
        : b === 'bar' ? `<div style="width:56px;height:3px;background:${primary};margin:8px 0 10px;line-height:3px;font-size:0;">&nbsp;</div>`
          : b === 'contacts' ? `<div style="padding-top:2px;">${contactsHtml()}</div>`
            : socialsHtml(align === 'center' ? 'center' : 'left')

  const cellsRow = (cells: Block[][], dividers: boolean) => {
    const out: string[] = []
    cells.forEach((cell, i) => {
      const align = cell.includes('photo') && cell.length <= 2 && !cell.includes('contacts') ? 'center' : 'left'
      // Dividers are a cell border: it always spans the row height, in every mail client.
      const edge = i === 0 ? '' : dividers ? `border-left:2px solid ${primary};padding-left:14px;` : 'padding-left:18px;'
      const trail = dividers && i < cells.length - 1 ? 'padding-right:14px;' : ''
      out.push(td(cell.map((b) => block(b, align)).join(''), `text-align:${align};${edge}${trail}`))
    })
    return `${T0}><tr>${out.join('')}</tr></table>`
  }

  let body = ''
  if (r.layout === 'header') {
    const a = r.headerAlign ?? 'left'
    const head = [
      r.headerPhoto === 'left' ? td(photoHtml(), 'padding-right:14px;') : '',
      td(nameHtml(r.headerPhoto ? 'left' : a)),
      r.headerPhoto === 'right' ? td(photoHtml(), 'padding-left:14px;') : '',
    ].join('')
    body += `<tr><td>${T0} width="100%"><tr><td align="${a}">${T0}><tr>${head}</tr></table></td>${r.headerSocials ? `<td align="right" valign="middle">${socialsHtml('right')}</td>` : ''}</tr></table></td></tr>`
    if (r.rule === 'header') body += `<tr><td style="padding-top:10px;"><div style="height:${r.ruleWeight ?? 2}px;background:${ruleCol};line-height:0;font-size:0;">&nbsp;</div></td></tr>`
    body += `<tr><td style="padding-top:10px;">${cellsRow(r.cells, false)}</td></tr>`
  } else {
    body += `<tr><td>${cellsRow(r.cells, Boolean(r.dividers))}</td></tr>`
  }
  if (r.rule === 'bottom') body += `<tr><td style="padding-top:12px;"><div style="height:${r.ruleWeight ?? 2}px;background:${ruleCol};line-height:0;font-size:0;">&nbsp;</div></td></tr>`
  if (c.s.extras.cta) body += `<tr><td style="padding-top:12px;">${ctaButton(c, primary)}</td></tr>`

  const disc = c.s.extras.disclaimer
    ? `<tr><td style="padding-top:12px;"><div style="border-top:1px solid #e4e5e7;padding-top:8px;font-family:${c.font};font-size:${Math.max(9, c.base - 3)}px;line-height:1.55;color:#80838a;max-width:560px;">${esc(c.s.extras.disclaimer)}</div></td></tr>`
    : ''
  return wrap(c, body + banner(c, 600) + disc, "max-width:600px;")
}

for (const r of CLASSIC) T[r.id] = (c) => classic(c, r)

// Shared animation styles. Kept in the exported HTML so clients that honour
// <style> blocks get the motion; inline styles remain the source of truth.
export const ANIMATION_CSS = `
.sc-root .sc-glow{animation:scGlow 2.6s ease-in-out infinite}
@keyframes scGlow{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--sc-c) 55%,transparent)}50%{box-shadow:0 0 0 9px color-mix(in srgb,var(--sc-c) 0%,transparent)}}
.sc-root .sc-ring{position:relative}
.sc-root .sc-float{animation:scFloat 3.2s ease-in-out infinite}
@keyframes scFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.sc-root .sc-pop{animation:scPop 2.8s ease-in-out infinite}
@keyframes scPop{0%,80%,100%{transform:scale(1)}88%{transform:scale(1.3)}}
.sc-root .sc-spin-ring{animation:scSpin 6s linear infinite}
.sc-root .sc-spin-ring > div{animation:scSpin 6s linear infinite reverse}
@keyframes scSpin{to{transform:rotate(360deg)}}
.sc-root .sc-lift{transition:transform .2s ease}
.sc-root .sc-lift:hover{transform:translateY(-3px) scale(1.08)}
.sc-root .sc-nav{transition:transform .2s ease,filter .2s ease}
.sc-root .sc-nav:hover{transform:translateY(-2px);filter:brightness(1.1)}
.sc-root .sc-shine{position:relative;overflow:hidden;background-size:200% 100%!important;animation:scShine 6s ease-in-out infinite}
@keyframes scShine{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
`

/** campaignId meaning: null = automatic (whatever is live), NO_BANNER = opt out, otherwise a pinned campaign. */
export const NO_BANNER = 'none'

const todayISO = () => new Date().toISOString().slice(0, 10)

/** Live = switched on and today falls inside its start/end dates. */
export const isLive = (c: Campaign, today = todayISO()) => c.active && (!c.start || c.start <= today) && (!c.end || c.end >= today)

/**
 * The banner a signature should carry right now. A pinned campaign wins while it is live;
 * otherwise the newest live campaign aimed at everyone or at this person's department.
 */
export function resolveCampaign(s: Signature, campaigns: Campaign[] = []): Campaign | null {
  const choice = s.extras.campaignId
  if (choice === NO_BANNER) return null
  const today = todayISO()
  if (choice) {
    const pinned = campaigns.find((c) => c.id === choice)
    if (pinned && isLive(pinned, today)) return pinned
  }
  const dept = s.fields.department.trim().toLowerCase()
  return campaigns.find((c) => isLive(c, today) && (c.departments.length === 0 || c.departments.some((d) => d.trim().toLowerCase() === dept))) ?? null
}

export function renderSignature(s: Signature, ctx: RenderContext = {}) {
  const fn = T[s.templateId] ?? T.aurora
  const campaign = resolveCampaign(s, ctx.campaigns)
  const base = { sm: 12, md: 13, lg: 14 }[s.design.size]
  const anim = s.extras.animations && !ctx.still
  const body = fn({ s, campaign, anim, base, font: s.design.font })
  return anim ? `<style>${ANIMATION_CSS}</style>${body}` : body
}

/** Standalone HTML file. Pass `html` to wrap an already-rendered (e.g. link-tracked) signature. */
export function exportDocument(s: Signature, ctx: RenderContext = {}, html?: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(s.fields.fullName)} — Email signature</title></head>
<body style="margin:0;padding:24px;background:#ffffff;">
${html ?? renderSignature(s, ctx)}
</body></html>`
}
