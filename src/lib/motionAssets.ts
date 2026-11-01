import type { Signature, SignatureMotion, SocialKey } from '../types'
import { uploadAsset } from './supabase'
import { assetKey, badgeGif, buttonGif, iconGif, loadImage, photoGif, type PhotoEffect } from './motion'

export const DEFAULT_MOTION: SignatureMotion = { photoEffect: 'orbit', greeting: 'Hi!', animateCta: true, animateBadge: true, animateIcons: true }

const ICON_FILE: Record<SocialKey, string> = { linkedin: 'linkedin', x: 'twitterx', instagram: 'instagram-new', facebook: 'facebook-new', youtube: 'youtube-play', tiktok: 'tiktok', github: 'github' }

export type MotionProblem = 'photo-unreadable' | null

/** Keys describing what each GIF depends on — compare with the stored keys to know what's stale. */
export function motionKeys(s: Signature) {
  const m = s.extras.motion ?? DEFAULT_MOTION
  const socials = (Object.entries(s.socials) as [SocialKey, string][]).filter(([, v]) => v).map(([k]) => k)
  return {
    photo: m.photoEffect === 'none' ? '' : assetKey([s.fields.photo, s.fields.fullName, m.photoEffect, m.greeting, s.design.primary, s.design.accent, s.design.photoShape]),
    cta: m.animateCta && s.extras.cta?.label ? assetKey([s.extras.cta.label, s.design.primary, s.design.accent]) : '',
    icons: m.animateIcons && socials.length ? assetKey([socials, s.design.primary]) : '',
    socials,
  }
}

export function motionStale(s: Signature) {
  const m = s.extras.motion
  if (!m || !s.extras.animations) return false
  const k = motionKeys(s)
  return (k.photo !== (m.photoKey ?? '')) || (k.cta !== (m.ctaKey ?? '')) || (k.icons !== (m.iconsKey ?? '')) || (m.animateBadge && s.extras.verified && !m.badgeGif)
}

const put = (orgId: string, blob: Blob, name: string) => uploadAsset(orgId, blob, name)

/** Generate and upload whichever GIFs are out of date. Returns the updated motion settings. */
export async function buildMotion(s: Signature, orgId: string): Promise<{ motion: SignatureMotion; problem: MotionProblem }> {
  const m: SignatureMotion = { ...DEFAULT_MOTION, ...s.extras.motion }
  const k = motionKeys(s)
  let problem: MotionProblem = null

  if (k.photo !== (m.photoKey ?? '')) {
    if (!k.photo) { m.photoGif = undefined; m.photoKey = '' }
    else {
      let img: HTMLImageElement | null = null
      if (s.fields.photo) {
        try { img = await loadImage(s.fields.photo) } catch { problem = 'photo-unreadable' }
      }
      if (!problem) {
        const initials = s.fields.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'
        const blob = photoGif({ photo: img, initials, effect: m.photoEffect as PhotoEffect, primary: s.design.primary, accent: s.design.accent, shape: s.design.photoShape, greeting: m.greeting })
        m.photoGif = await put(orgId, blob, `motion/photo-${k.photo}`)
        m.photoKey = k.photo
      }
    }
  }

  if (k.cta !== (m.ctaKey ?? '')) {
    if (!k.cta) { m.ctaGif = undefined; m.ctaKey = '' }
    else {
      const { blob, width } = buttonGif(`${s.extras.cta!.label}`, s.design.primary, s.design.accent)
      m.ctaGif = await put(orgId, blob, `motion/cta-${k.cta}`)
      m.ctaWidth = width
      m.ctaKey = k.cta
    }
  }

  if (m.animateBadge && s.extras.verified && !m.badgeGif) m.badgeGif = await put(orgId, badgeGif(), 'motion/badge')

  if (k.icons !== (m.iconsKey ?? '')) {
    if (!k.icons) { m.iconGifs = undefined; m.iconsKey = '' }
    else {
      const gifs: Partial<Record<SocialKey, string>> = {}
      for (const [i, key] of k.socials.entries()) {
        const icon = await loadImage(`https://img.icons8.com/ios-filled/100/ffffff/${ICON_FILE[key]}.png`)
        gifs[key] = await put(orgId, iconGif(icon, s.design.primary, i, k.socials.length), `motion/icon-${key}-${k.icons}`)
      }
      m.iconGifs = gifs
      m.iconsKey = k.icons
    }
  }

  return { motion: m, problem }
}
