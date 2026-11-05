import { admin, json } from '../_lib/microsoft.js'
import { normEmail, normHost, orgByHost, relayRequest } from '../_lib/relay.js'
import { buildRelaySignature, employeeFromRow, relaySkipReason, type EmployeeRow, type RelayScope } from '../../src/lib/relaySignature.js'
import { linkRows } from '../../src/lib/trackingCore.js'
import type { BrandKit, Campaign } from '../../src/types.js'

// POST /api/relay/signature — the SMTP relay asks, per outgoing message, which signature to stamp.
// Body: { tenantHost, sender }. Reply: { apply:false } or { apply:true, html, text }.

export async function POST(req: Request) {
  try {
    return await handle(req)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
}

async function handle(req: Request) {
  const parsed = await relayRequest<{ tenantHost?: unknown; sender?: unknown }>(req)
  if ('error' in parsed) return parsed.error
  const host = normHost(parsed.body.tenantHost)
  const sender = normEmail(parsed.body.sender)
  if (!host || !sender) return json({ error: 'tenantHost and sender are required' }, 400)

  const db = admin()
  const org = await orgByHost(db, host, 'id, brand, relay_scope')
  if (!org) return json({ apply: false, reason: 'unknown_tenant' })
  const orgId = org.id as string

  // Emails are stored lowercase (CSV import, manual entry and Microsoft sync all lowercase them),
  // so equality on the lowercased sender is a case-insensitive match without ilike's wildcards.
  const { data: row, error } = await db
    .from('employees')
    .select('id, full_name, title, department, email, phone, photo, template_id, status, source, external_id, updated_at')
    .eq('org_id', orgId)
    .eq('email', sender)
    .neq('status', 'outdated')
    .maybeSingle()
  if (error) throw new Error(error.message)
  const employee = row ? employeeFromRow(row as EmployeeRow) : null

  const skip = relaySkipReason(org.relay_scope as Partial<RelayScope> | null, employee, sender)
  if (skip || !employee) return json({ apply: false, reason: skip ?? 'no_employee' })

  const { data: camps, error: campErr } = await db.from('campaigns').select('id, data').eq('org_id', orgId)
  if (campErr) throw new Error(campErr.message)
  const campaigns: Campaign[] = (camps ?? []).map((c) => ({ ...(c.data as Omit<Campaign, 'id'>), id: c.id as string }))

  const sig = buildRelaySignature({ orgId, brand: org.brand as Partial<BrandKit> | null, employee, campaigns })
  if (sig.links.length) {
    const { error: linkErr } = await db.from('links').upsert(linkRows(sig.target, sig.links), { onConflict: 'code', ignoreDuplicates: true })
    if (linkErr) {
      // Never block mail over analytics: fall back to untracked links.
      const plain = buildRelaySignature({ orgId, brand: { ...(org.brand as Partial<BrandKit>), trackClicks: false }, employee, campaigns })
      return json({ apply: true, html: plain.html, text: plain.text })
    }
  }
  return json({ apply: true, html: sig.html, text: sig.text })
}
