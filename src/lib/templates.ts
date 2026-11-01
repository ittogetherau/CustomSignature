import type { Signature, SignatureDesign, SignatureExtras, SignatureFields } from '../types'

export interface TemplateMeta {
  id: string
  name: string
  tagline: string
  categories: string[]
  pro: boolean
  animated: boolean
  design: Partial<SignatureDesign>
  extras?: Partial<SignatureExtras>
  sample?: Partial<SignatureFields>
}

export const CATEGORIES = ['All', 'Modern', 'Corporate', 'Creative', 'Real Estate', 'Healthcare', 'Finance', 'Legal', 'Education', 'Minimal', 'Marketing']

export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'aurora', name: 'Aurora', tagline: 'Glowing profile ring, gradient rail & interactive nav',
    categories: ['Modern', 'Marketing'], pro: true, animated: true,
    design: { primary: '#0f766e', accent: '#e2643b', text: '#0f172a', iconStyle: 'filled' },
    extras: { verified: true, navLinks: [{ label: 'Book a call', url: 'cal.com' }, { label: 'Portfolio', url: 'example.com/work' }, { label: 'Blog', url: 'example.com/blog' }] },
  },
  {
    id: 'neon', name: 'Neon Night', tagline: 'Dark card with neon glow for bold creatives',
    categories: ['Creative', 'Modern'], pro: true, animated: true,
    design: { primary: '#7c3aed', accent: '#22d3ee', text: '#ffffff', iconStyle: 'outline' },
    extras: { verified: true, navLinks: [{ label: 'Showreel', url: 'example.com/reel' }, { label: 'Hire me', url: 'example.com/hire' }] },
    sample: { title: 'Creative Director', company: 'Pixel & Pulse' },
  },
  {
    id: 'startup', name: 'Launchpad', tagline: 'Gradient header bar with clickable navigation',
    categories: ['Modern', 'Marketing'], pro: true, animated: true,
    design: { primary: '#0ea5e9', accent: '#6366f1', text: '#0f172a' },
    extras: { navLinks: [{ label: 'Product', url: 'example.com' }, { label: 'Pricing', url: 'example.com/pricing' }, { label: 'Demo', url: 'example.com/demo' }] },
    sample: { title: 'Co-founder & CEO', company: 'Nimbus' },
  },
  {
    id: 'executive', name: 'Executive', tagline: 'Serif elegance with a gold accent rule',
    categories: ['Corporate', 'Finance'], pro: true, animated: false,
    design: { primary: '#1e293b', accent: '#b8893b', text: '#1e293b', iconStyle: 'outline' },
    sample: { title: 'Managing Partner', company: 'Sterling & Co.' },
  },
  {
    id: 'creator', name: 'Creator', tagline: 'Centered spinning gradient ring & big socials',
    categories: ['Creative', 'Marketing'], pro: true, animated: true,
    design: { primary: '#ec4899', accent: '#f59e0b', text: '#1f2937' },
    extras: { quote: '“Make it simple, but significant.”', cta: { label: 'Watch my latest video', url: 'youtube.com' } },
    sample: { title: 'Content Creator', company: 'Studio Bloom' },
  },
  {
    id: 'realtor', name: 'Open House', tagline: 'Big headshot, listing CTA & brokerage footer',
    categories: ['Real Estate'], pro: true, animated: false,
    design: { primary: '#0f3d3e', accent: '#c2410c', text: '#0f172a', photoShape: 'rounded' },
    extras: { cta: { label: 'View my listings', url: 'example.com/listings' } },
    sample: { title: 'Licensed Realtor®', company: 'Harbor Realty Group' },
  },
  {
    id: 'clinic', name: 'Clinic', tagline: 'Calm, trustworthy with appointment booking',
    categories: ['Healthcare'], pro: false, animated: false,
    design: { primary: '#0d9488', accent: '#0284c7', text: '#134e4a' },
    extras: { cta: { label: 'Book appointment', url: 'example.com/book' }, disclaimer: 'CONFIDENTIALITY NOTICE: This email may contain protected health information. If you received it in error, please notify the sender and delete it.' },
    sample: { fullName: 'Dr. Priya Nair', title: 'MBBS, FRACGP', department: 'General Practice', company: 'Northside Medical' },
  },
  {
    id: 'finance', name: 'Ledger', tagline: 'Structured two-column layout with compliance note',
    categories: ['Finance', 'Corporate'], pro: false, animated: false,
    design: { primary: '#1e3a8a', accent: '#16a34a', text: '#0f172a' },
    extras: { disclaimer: 'General advice only. Past performance is not indicative of future returns. AFSL 000000.' },
    sample: { title: 'Senior Wealth Advisor', company: 'Meridian Capital' },
  },
  {
    id: 'counsel', name: 'Counsel', tagline: 'Classic law-firm typography & legal disclaimer',
    categories: ['Legal', 'Corporate'], pro: false, animated: false,
    design: { primary: '#7f1d1d', accent: '#7f1d1d', text: '#1c1917' },
    extras: { disclaimer: 'This message is confidential and may be legally privileged. If you are not the intended recipient, you must not use, copy or disclose it.' },
    sample: { title: 'Senior Associate', company: 'Whitmore Legal' },
  },
  {
    id: 'campus', name: 'Campus', tagline: 'Warm academic style with office hours',
    categories: ['Education'], pro: false, animated: false,
    design: { primary: '#9a3412', accent: '#eab308', text: '#292524' },
    extras: { quote: 'Office hours: Tue & Thu, 2–4pm, Room B204' },
    sample: { title: 'Senior Lecturer', department: 'School of Computing', company: 'Churchill Institute' },
  },
  {
    id: 'spotlight', name: 'Spotlight', tagline: 'Compact header plus a campaign banner',
    categories: ['Marketing', 'Modern'], pro: true, animated: true,
    design: { primary: '#f43f5e', accent: '#8b5cf6', text: '#0f172a' },
    extras: { cta: { label: 'Join our webinar on Nov 20', url: 'example.com/webinar' }, quote: 'Free seats are limited — save yours today.' },
  },
  {
    id: 'horizon', name: 'Horizon', tagline: 'Logo-first with contact chips & gradient underline',
    categories: ['Modern', 'Corporate'], pro: false, animated: false,
    design: { primary: '#4f46e5', accent: '#06b6d4', text: '#0f172a', iconStyle: 'outline' },
  },
  {
    id: 'pastel', name: 'Pastel', tagline: 'Soft gradient card, friendly and approachable',
    categories: ['Creative', 'Education'], pro: false, animated: true,
    design: { primary: '#8b5cf6', accent: '#f472b6', text: '#1e1b4b' },
    extras: { navLinks: [{ label: 'Say hello', url: 'example.com/contact' }] },
  },
  {
    id: 'mono', name: 'Mono', tagline: 'High-contrast black & white editorial look',
    categories: ['Minimal', 'Creative'], pro: false, animated: false,
    design: { primary: '#111111', accent: '#111111', text: '#111111', photoShape: 'square', font: 'Helvetica, Arial, sans-serif' },
    extras: { cta: { label: 'See my work', url: 'example.com' } },
  },
  {
    id: 'minimal', name: 'Minimal', tagline: 'Clean typography, nothing extra',
    categories: ['Minimal'], pro: false, animated: false,
    design: { primary: '#2563eb', accent: '#2563eb', text: '#111827', iconStyle: 'plain' },
  },
  {
    id: 'compact', name: 'Reply Line', tagline: 'Two-line signature for replies & forwards',
    categories: ['Minimal'], pro: false, animated: false,
    design: { primary: '#059669', accent: '#059669', text: '#111827', size: 'sm' },
  },
]

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]

export const DEFAULT_FIELDS: SignatureFields = {
  fullName: 'Alex Morgan',
  title: 'Head of Growth',
  department: '',
  company: 'Brightwave Studio',
  pronouns: '',
  phone: '+61 2 9000 1234',
  mobile: '',
  email: 'alex@brightwave.studio',
  website: 'brightwave.studio',
  address: '',
  photo: '',
  logo: '',
}

export const DEFAULT_DESIGN: SignatureDesign = {
  primary: '#0f766e',
  accent: '#e2643b',
  text: '#0f172a',
  font: 'Helvetica, Arial, sans-serif',
  photoShape: 'circle',
  size: 'md',
  iconStyle: 'filled',
}

export const DEFAULT_EXTRAS: SignatureExtras = {
  verified: false,
  animations: true,
  navLinks: [],
  cta: null,
  campaignId: null,
  disclaimer: '',
  quote: '',
}

const SAMPLE_PHOTOS = [
  'https://randomuser.me/api/portraits/women/44.jpg',
  'https://randomuser.me/api/portraits/men/32.jpg',
  'https://randomuser.me/api/portraits/women/68.jpg',
  'https://randomuser.me/api/portraits/men/75.jpg',
  'https://randomuser.me/api/portraits/women/12.jpg',
  'https://randomuser.me/api/portraits/men/46.jpg',
]

export const samplePhoto = (i: number) => SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length]

export const uid = () => Math.random().toString(36).slice(2, 10)

/** A signature preloaded with a template's showcase content — used for gallery cards and "use template". */
export function signatureFromTemplate(templateId: string, overrides: Partial<SignatureFields> = {}, index = 0): Signature {
  const t = templateById(templateId)
  const now = Date.now()
  return {
    id: uid(),
    label: `${t.name} signature`,
    templateId: t.id,
    fields: { ...DEFAULT_FIELDS, photo: samplePhoto(index), ...t.sample, ...overrides },
    socials: { linkedin: 'linkedin.com', instagram: 'instagram.com', x: 'x.com', youtube: t.categories.includes('Creative') ? 'youtube.com' : '' },
    design: { ...DEFAULT_DESIGN, ...t.design },
    extras: { ...DEFAULT_EXTRAS, ...t.extras, animations: t.animated },
    createdAt: now,
    updatedAt: now,
    stats: { impressions: 0, clicks: 0 },
  }
}
