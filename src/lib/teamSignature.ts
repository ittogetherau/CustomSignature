import type { BrandKit, Employee, Signature } from '../types'
import { DEFAULT_EXTRAS, templateById } from './templates.js'

// Pure (no React, no DOM, no Supabase client): used by the Team page and by the
// mail relay's server-side signature lookup (api/relay/signature.ts).
// Relative imports carry `.js` so Vercel's Node ESM runtime can load this file.

export const DEFAULT_BRAND: BrandKit = {
  company: '', website: '', logo: '', primary: '#0f766e', accent: '#e2643b', font: 'Helvetica, Arial, sans-serif',
  address: '', phone: '', disclaimer: '', defaultTemplateId: 'aurora', socials: {},
}

/** Turn a person + the brand kit into a full signature. */
export function employeeSignature(e: Employee, brand: BrandKit, campaignId: string | null): Signature {
  const meta = templateById(e.templateId ?? brand.defaultTemplateId)
  return {
    id: e.id, label: e.fullName, templateId: meta.id,
    fields: { fullName: e.fullName, title: e.title, department: e.department, company: brand.company, pronouns: '', phone: e.phone || brand.phone, mobile: '', email: e.email, website: brand.website, address: '', photo: e.photo, logo: brand.logo, logoLight: brand.logoLight ?? '' },
    socials: brand.socials,
    design: { primary: brand.primary, accent: brand.accent, text: meta.design.text ?? '#0f172a', font: brand.font, photoShape: meta.design.photoShape ?? 'circle', size: 'md', iconStyle: meta.design.iconStyle ?? 'filled' },
    extras: { ...DEFAULT_EXTRAS, animations: meta.animated, verified: false, disclaimer: brand.disclaimer, campaignId },
    createdAt: e.updatedAt, updatedAt: e.updatedAt,
  }
}
