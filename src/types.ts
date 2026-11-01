export type SocialKey = 'linkedin' | 'x' | 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'github'

export interface NavLink {
  label: string
  url: string
}

export interface SignatureFields {
  fullName: string
  title: string
  department: string
  company: string
  pronouns: string
  phone: string
  mobile: string
  email: string
  website: string
  address: string
  photo: string
  logo: string
}

export interface SignatureDesign {
  primary: string
  accent: string
  text: string
  font: string
  photoShape: 'circle' | 'rounded' | 'square'
  size: 'sm' | 'md' | 'lg'
  iconStyle: 'filled' | 'outline' | 'plain'
}

/** Email-safe animation: settings plus the GIFs generated from them (hosted URLs). */
export interface SignatureMotion {
  photoEffect: 'none' | 'orbit' | 'halo' | 'shine' | 'sparkle' | 'breathe' | 'hello' | 'draw' | 'shards' | 'blinds' | 'mosaic' | 'ribbons'
  greeting: string
  animateCta: boolean
  animateBadge: boolean
  animateIcons: boolean
  photoGif?: string
  photoKey?: string
  ctaGif?: string
  ctaWidth?: number
  ctaKey?: string
  badgeGif?: string
  iconGifs?: Partial<Record<SocialKey, string>>
  iconsKey?: string
}

export interface SignatureExtras {
  verified: boolean
  animations: boolean
  motion?: SignatureMotion
  navLinks: NavLink[]
  cta: NavLink | null
  campaignId: string | null
  disclaimer: string
  quote: string
}

export interface Signature {
  id: string
  label: string
  templateId: string
  fields: SignatureFields
  socials: Partial<Record<SocialKey, string>>
  design: SignatureDesign
  extras: SignatureExtras
  createdAt: number
  updatedAt: number
}

export interface Employee {
  id: string
  fullName: string
  title: string
  department: string
  email: string
  phone: string
  photo: string
  templateId: string | null
  status: 'active' | 'invited' | 'outdated'
  source: 'manual' | 'csv' | 'microsoft'
  externalId: string | null
  /** Last time this person was emailed their signature. */
  sentAt?: number | null
  updatedAt: number
}

export interface Campaign {
  id: string
  name: string
  headline: string
  subline: string
  ctaLabel: string
  url: string
  image: string
  style: 'gradient' | 'dark' | 'light' | 'image'
  from: string
  to: string
  start: string
  end: string
  departments: string[]
  active: boolean
}

export type Role = 'owner' | 'admin' | 'member'

export interface Organization {
  id: string
  name: string
  msTenantId: string | null
  msSyncedAt: number | null
  msSyncStatus: string | null
}

export interface BrandKit {
  company: string
  website: string
  logo: string
  primary: string
  accent: string
  font: string
  address: string
  phone: string
  disclaimer: string
  defaultTemplateId: string
  /** Route signature links through /r/<code> to count clicks (default on). */
  trackClicks?: boolean
  socials: Partial<Record<SocialKey, string>>
}
