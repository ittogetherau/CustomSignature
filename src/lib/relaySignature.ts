import type { BrandKit, Campaign, Employee } from '../types'
import { renderSignature } from './render.js'
import { DEFAULT_BRAND, employeeSignature } from './teamSignature.js'
import { trackHtml, type TrackTarget, type TrackedLink } from './trackingCore.js'
import { plainTextSignature } from './plainText.js'

// The decision + rendering half of the mail relay's signature lookup, kept pure so it can
// be tested without a database. api/relay/signature.ts does the I/O around it.

export const RELAY_TRACKING_BASE = 'https://inkwell.ittogether.com.au'

export interface RelayScope {
  /** test: only `testEmails`; departments: only listed departments; all: everyone. */
  mode: 'test' | 'departments' | 'all'
  departments: string[]
  paused: boolean
  testEmails: string[]
}

export const DEFAULT_RELAY_SCOPE: RelayScope = { mode: 'test', departments: [], paused: false, testEmails: [] }

export type RelaySkip = 'no_employee' | 'paused' | 'not_test_sender' | 'department_not_enabled'

const lc = (v: string) => v.trim().toLowerCase()

/** Should this sender get a server-side signature? Returns the reason when not. */
export function relaySkipReason(raw: Partial<RelayScope> | null | undefined, employee: Employee | null, sender: string): RelaySkip | null {
  const scope = { ...DEFAULT_RELAY_SCOPE, ...(raw ?? {}) }
  if (!employee) return 'no_employee'
  if (scope.paused) return 'paused'
  if (scope.mode === 'test' && !(scope.testEmails ?? []).some((e) => lc(e) === lc(sender))) return 'not_test_sender'
  if (scope.mode === 'departments' && !(scope.departments ?? []).some((d) => lc(d) === lc(employee.department))) return 'department_not_enabled'
  return null
}

export interface EmployeeRow {
  id: string; full_name: string; title: string | null; department: string | null; email: string; phone: string | null; photo: string | null
  template_id: string | null; status: Employee['status']; source: Employee['source']; external_id: string | null; updated_at: string
}

export const employeeFromRow = (r: EmployeeRow): Employee => ({
  id: r.id, fullName: r.full_name, title: r.title ?? '', department: r.department ?? '', email: r.email, phone: r.phone ?? '', photo: r.photo ?? '',
  templateId: r.template_id, status: r.status, source: r.source, externalId: r.external_id, updatedAt: Date.parse(r.updated_at),
})

export interface RelaySignatureInput {
  orgId: string
  brand: Partial<BrandKit> | null
  employee: Employee
  campaigns: Campaign[]
  base?: string
}

export interface RelaySignatureResult {
  html: string
  text: string
  /** Tracked links to register in `links` (empty when click tracking is off). */
  links: TrackedLink[]
  target: TrackTarget
}

export function buildRelaySignature({ orgId, brand: rawBrand, employee, campaigns, base = RELAY_TRACKING_BASE }: RelaySignatureInput): RelaySignatureResult {
  const brand: BrandKit = { ...DEFAULT_BRAND, ...(rawBrand ?? {}) }
  // Automatic banners: the renderer picks the live campaign for the person's department.
  const sig = employeeSignature(employee, brand, null)
  const target: TrackTarget = { orgId, personType: 'emp', personId: employee.id }
  const raw = renderSignature(sig, { campaigns })

  let html = raw
  let links: TrackedLink[] = []
  if (brand.trackClicks !== false) {
    const tracked = trackHtml(raw, sig, target, base, campaigns)
    html = tracked.html
    links = tracked.links
  }
  const byUrl = new Map(links.map((l) => [l.url, `${base}/r/${l.code}`]))
  const text = plainTextSignature(sig, { campaigns, link: (u) => byUrl.get(u) ?? u })
  return { html: `<div data-inkwell-sig>${html}</div>`, text, links, target }
}
