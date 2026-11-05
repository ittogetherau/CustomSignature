/** Client for the Inkwell API: signature lookup (cached) and delivery events. */
import { sign } from './hmac.js';
import type { Signature } from './insert.js';
import type { ClientKind } from './rewrite.js';

export interface SignatureResponse {
  apply: boolean;
  html?: string;
  text?: string;
}

export type EventStatus = 'signed' | 'skipped' | 'passthrough' | 'failed_open' | 'deferred' | 'rejected';

export interface RelayEvent {
  tenantHost: string;
  sender: string;
  client: ClientKind;
  status: EventStatus;
  ms: number;
}

export interface ApiOptions {
  baseUrl: string;
  secret: string;
  timeoutMs?: number;
  cacheMs?: number;
  fetchImpl?: typeof fetch;
}

export class InkwellApi {
  private cache = new Map<string, { at: number; value: SignatureResponse }>();
  private timeoutMs: number;
  private cacheMs: number;
  private fetchImpl: typeof fetch;

  constructor(private opts: ApiOptions) {
    this.timeoutMs = opts.timeoutMs ?? 3000;
    this.cacheMs = opts.cacheMs ?? 60_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async post(path: string, payload: unknown, timeoutMs: number): Promise<Response> {
    const body = JSON.stringify(payload);
    return this.fetchImpl(`${this.opts.baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...sign(this.opts.secret, body) },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  /**
   * Returns the signature to apply, or null when none should be applied.
   * Throws on network errors / timeouts / bad responses (the caller fails open).
   */
  async lookup(tenantHost: string, sender: string): Promise<Signature | null> {
    const key = `${tenantHost}\n${sender.toLowerCase()}`;
    const hit = this.cache.get(key);
    let value: SignatureResponse;
    if (hit && Date.now() - hit.at < this.cacheMs) {
      value = hit.value;
    } else {
      const res = await this.post('/api/relay/signature', { tenantHost, sender }, this.timeoutMs);
      if (!res.ok) throw new Error(`signature lookup HTTP ${res.status}`);
      value = (await res.json()) as SignatureResponse;
      if (typeof value?.apply !== 'boolean') throw new Error('signature lookup: bad response');
      this.cache.set(key, { at: Date.now(), value });
      if (this.cache.size > 50_000) this.prune();
    }
    if (!value.apply || (!value.html && !value.text)) return null;
    return { html: value.html ?? '', text: value.text ?? '' };
  }

  private prune(): void {
    const now = Date.now();
    for (const [k, v] of this.cache) if (now - v.at >= this.cacheMs) this.cache.delete(k);
  }

  /** Fire-and-forget. Never throws, never blocks the SMTP transaction. */
  event(ev: RelayEvent): void {
    this.post('/api/relay/event', ev, 5000)
      .then((r) => r.body?.cancel())
      .catch(() => {});
  }
}
