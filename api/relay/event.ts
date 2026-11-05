import { admin, json } from '../_lib/microsoft.js'
import { normEmail, normHost, orgByHost, relayRequest } from '../_lib/relay.js'

// POST /api/relay/event — the SMTP relay reports what it did with a message.
// Body: { tenantHost, sender, client?, status, ms? }. Rows are pruned after 30 days by the daily cron.

interface EventBody { tenantHost?: unknown; sender?: unknown; client?: unknown; status?: unknown; ms?: unknown }

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export async function POST(req: Request) {
  try {
    const parsed = await relayRequest<EventBody>(req)
    if ('error' in parsed) return parsed.error
    const b = parsed.body
    const host = normHost(b.tenantHost)
    const sender = normEmail(b.sender)
    const status = str(b.status, 64)
    if (!host || !sender || !status) return json({ error: 'tenantHost, sender and status are required' }, 400)

    const db = admin()
    const org = await orgByHost(db, host, 'id')
    if (!org) return json({ ok: false, reason: 'unknown_tenant' }, 404)

    const ms = typeof b.ms === 'number' && Number.isFinite(b.ms) ? Math.max(0, Math.min(2_147_483_647, Math.round(b.ms))) : null
    const { error } = await db.from('relay_events').insert({ org_id: org.id, sender: sender.slice(0, 320), client: str(b.client, 120), status, ms })
    if (error) throw new Error(error.message)
    return json({ ok: true })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
}
