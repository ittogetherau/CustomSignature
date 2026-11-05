import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { env, json } from './microsoft.js'

// Shared by /api/relay/* — calls from the Inkwell SMTP relay, never from browsers.
// Every request carries X-Inkwell-Signature = hex HMAC-SHA256(raw body, RELAY_SECRET)
// (a "sha256=" prefix is accepted too).

export function verify(body: string, header: string | null) {
  const given = (header ?? '').trim().replace(/^sha256=/i, '').toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(given)) return false
  const expected = createHmac('sha256', env('RELAY_SECRET')).update(body, 'utf8').digest()
  return timingSafeEqual(expected, Buffer.from(given, 'hex'))
}

/** Read and authenticate a relay request. Returns the parsed body or an error response. */
export async function relayRequest<T>(req: Request): Promise<{ body: T } | { error: Response }> {
  const raw = await req.text()
  if (!verify(raw, req.headers.get('x-inkwell-signature'))) return { error: json({ error: 'Bad signature' }, 401) }
  try {
    return { body: JSON.parse(raw) as T }
  } catch {
    return { error: json({ error: 'Body must be JSON' }, 400) }
  }
}

export const normHost = (h: unknown) => (typeof h === 'string' ? h.trim().toLowerCase().replace(/\.$/, '') : '')
export const normEmail = (e: unknown) => (typeof e === 'string' ? e.trim().toLowerCase().replace(/^<|>$/g, '') : '')

/** The workspace whose relay is registered for this tenant host. */
export async function orgByHost<C extends string>(db: SupabaseClient, host: string, columns: C) {
  const { data, error } = await db.from('organizations').select(columns).eq('relay->>host', host).limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  return data as Record<string, unknown> | null
}
