import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Request signing shared with the Inkwell API.
 *   X-Inkwell-Timestamp: <unix seconds>
 *   X-Inkwell-Signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<body>")>
 */
export const SIG_HEADER = 'X-Inkwell-Signature';
export const TS_HEADER = 'X-Inkwell-Timestamp';
export const MAX_SKEW_SECONDS = 300;

export function sign(secret: string, body: string, now = Date.now()): Record<string, string> {
  const ts = Math.floor(now / 1000).toString();
  const mac = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  return { [SIG_HEADER]: `sha256=${mac}`, [TS_HEADER]: ts };
}

export function verify(
  secret: string,
  body: string,
  signature: string | undefined | null,
  timestamp: string | undefined | null,
  now = Date.now(),
): boolean {
  if (!secret || !signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) return false;
  const expected = Buffer.from(
    `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`,
  );
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
