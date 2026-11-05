import { env } from './microsoft.js'

// Records in the ittogether.com.au zone on Vercel DNS (per-tenant relay verification TXT records).
// Env: VERCEL_TOKEN (scoped to the team), VERCEL_TEAM_ID, optional DNS_DOMAIN.

const API = 'https://api.vercel.com'
export const DNS_DOMAIN = () => process.env.DNS_DOMAIN ?? 'ittogether.com.au'

interface DnsRecord { id: string; name: string; type: string; value: string; ttl?: number }

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const team = process.env.VERCEL_TEAM_ID
  const url = `${API}${path}${team ? `${path.includes('?') ? '&' : '?'}teamId=${team}` : ''}`
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${env('VERCEL_TOKEN')}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!res.ok) throw new Error(`Vercel DNS: ${body.error?.message ?? res.status}`)
  return body
}

/** Name relative to the zone: "abc.relay.ittogether.com.au" → "abc.relay". */
export const relName = (fqdn: string) => fqdn.toLowerCase().replace(new RegExp(`\\.?${DNS_DOMAIN().replace(/\./g, '\\.')}$`), '')

export async function listRecords(name: string, type?: string) {
  const out: DnsRecord[] = []
  let until: number | undefined
  for (let page = 0; page < 20; page++) {
    const r = await call<{ records: DnsRecord[]; pagination?: { next?: number | null } }>(
      `/v4/domains/${DNS_DOMAIN()}/records?limit=100${until ? `&until=${until}` : ''}`,
    )
    out.push(...r.records)
    if (!r.pagination?.next) break
    until = r.pagination.next
  }
  return out.filter((r) => r.name === name && (!type || r.type === type))
}

/** Create the record unless an identical one exists. */
export async function ensureRecord(name: string, type: 'TXT' | 'A' | 'CNAME', value: string, ttl = 60) {
  const existing = await listRecords(name, type)
  const same = existing.find((r) => r.value === value)
  if (same) return same.id
  const r = await call<{ uid: string }>(`/v2/domains/${DNS_DOMAIN()}/records`, { method: 'POST', body: JSON.stringify({ name, type, value, ttl }) })
  return r.uid
}

export async function deleteRecords(name: string, type?: string) {
  for (const r of await listRecords(name, type)) await call(`/v2/domains/${DNS_DOMAIN()}/records/${r.id}`, { method: 'DELETE' })
}
