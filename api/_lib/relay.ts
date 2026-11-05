import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { env, json } from './microsoft.js'

// Shared by /api/relay/* — calls from the Inkwell SMTP relay, never from browsers.
// Every request carries (same contract as relay/src/hmac.ts):
//   X-Inkwell-Timestamp: <unix seconds>   (rejected if more than 300 s from our clock)
//   X-Inkwell-Signature: sha256=<hex HMAC-SHA256(RELAY_SECRET, "<timestamp>.<raw body>")>

export function verify(body: string, signature: string | null, timestamp: string | null, now = Date.now()) {
  const given = (signature ?? '').trim().replace(/^sha256=/i, '').toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(given) || !/^\d+$/.test(timestamp ?? '')) return false
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false
  const expected = createHmac('sha256', env('RELAY_SECRET')).update(`${timestamp}.${body}`, 'utf8').digest()
  return timingSafeEqual(expected, Buffer.from(given, 'hex'))
}

/** Hex signature + timestamp headers for calls from Inkwell to the relay's admin endpoint. */
export function signHeaders(body: string, now = Date.now()): Record<string, string> {
  const ts = Math.floor(now / 1000).toString()
  const mac = createHmac('sha256', env('RELAY_SECRET')).update(`${ts}.${body}`, 'utf8').digest('hex')
  return { 'X-Inkwell-Timestamp': ts, 'X-Inkwell-Signature': `sha256=${mac}` }
}

/** Read and authenticate a relay request. Returns the parsed body or an error response. */
export async function relayRequest<T>(req: Request): Promise<{ body: T } | { error: Response }> {
  const raw = await req.text()
  if (!verify(raw, req.headers.get('x-inkwell-signature'), req.headers.get('x-inkwell-timestamp'))) return { error: json({ error: 'Bad signature' }, 401) }
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
