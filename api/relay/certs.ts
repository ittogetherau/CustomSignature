import { admin, json } from '../_lib/microsoft.js'
import { relayRequest } from '../_lib/relay.js'
import { DNS_DOMAIN, deleteRecordValue, ensureRecord, relName } from '../_lib/vercelDns.js'

// POST /api/relay/certs — certificate storage and ACME DNS-01 records for the SMTP relay.
// Keeps the relay free of database and DNS credentials: it only holds RELAY_SECRET.
//
//   { op: 'list' }                         → { hosts: string[] }
//   { op: 'get', path }                    → { data: string | null }
//   { op: 'put', path, data }              → { ok }
//   { op: 'txt-set' | 'txt-remove', name, value } → { ok }   (only _acme-challenge.*.<RELAY_DOMAIN>)

const BUCKET = 'relay-certs'
const RELAY_DOMAIN = () => process.env.RELAY_DOMAIN ?? 'relay.ittogether.com.au'
const SAFE_PATH = /^(_acme|[a-z0-9-]+(\.[a-z0-9-]+)+)\/[a-z0-9-]+\.pem$/

interface Body { op?: string; path?: string; data?: string; name?: string; value?: string }

export async function POST(req: Request) {
  try {
    const parsed = await relayRequest<Body>(req)
    if ('error' in parsed) return parsed.error
    const b = parsed.body
    const storage = admin().storage.from(BUCKET)

    switch (b.op) {
      case 'list': {
        const { data, error } = await storage.list('', { limit: 10_000 })
        if (error) throw new Error(error.message)
        // Folders have no id; skip the ACME account folder.
        return json({ hosts: (data ?? []).filter((i) => !i.id && !i.name.startsWith('_')).map((i) => i.name) })
      }
      case 'get': {
        if (!b.path || !SAFE_PATH.test(b.path)) return json({ error: 'bad path' }, 400)
        const { data, error } = await storage.download(b.path)
        if (error || !data) return json({ data: null })
        return json({ data: await data.text() })
      }
      case 'put': {
        if (!b.path || !SAFE_PATH.test(b.path) || typeof b.data !== 'string' || b.data.length > 64_000) return json({ error: 'bad put' }, 400)
        const { error } = await storage.upload(b.path, new Blob([b.data], { type: 'application/x-pem-file' }), { upsert: true })
        if (error) throw new Error(error.message)
        return json({ ok: true })
      }
      case 'txt-set':
      case 'txt-remove': {
        const name = String(b.name ?? '').toLowerCase().replace(/\.$/, '')
        const value = String(b.value ?? '')
        const suffix = `.${RELAY_DOMAIN()}`
        if (!name.startsWith('_acme-challenge.') || !(name.endsWith(suffix) || name === `_acme-challenge.${RELAY_DOMAIN()}`) || !value || value.length > 255) {
          return json({ error: `only _acme-challenge records under ${RELAY_DOMAIN()}` }, 400)
        }
        if (!name.endsWith(`.${DNS_DOMAIN()}`)) return json({ error: 'outside zone' }, 400)
        if (b.op === 'txt-set') await ensureRecord(relName(name), 'TXT', value, 60)
        else await deleteRecordValue(relName(name), 'TXT', value)
        return json({ ok: true })
      }
    }
    return json({ error: 'unknown op' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
}
