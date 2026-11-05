/**
 * Certificate storage and ACME DNS-01 records via the Inkwell API (POST /api/relay/certs),
 * so the relay holds no database or DNS credentials — only RELAY_SECRET.
 */
import { sign } from './hmac.js';
import type { DnsProvider } from './acme.js';
import type { CertPair, CertSource } from './certs.js';

export class InkwellCertsApi {
  constructor(
    private baseUrl: string,
    private secret: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async call<T>(payload: Record<string, unknown>): Promise<T> {
    const body = JSON.stringify(payload);
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/api/relay/certs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...sign(this.secret, body) },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    const out = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(`inkwell certs ${String(payload.op)} HTTP ${res.status}: ${out.error ?? ''}`);
    return out;
  }
}

export class InkwellCertSource implements CertSource {
  constructor(private api: InkwellCertsApi) {}

  async listHosts(): Promise<string[]> {
    return (await this.api.call<{ hosts: string[] }>({ op: 'list' })).hosts;
  }

  async getBlob(path: string): Promise<string | null> {
    return (await this.api.call<{ data: string | null }>({ op: 'get', path })).data;
  }

  async putBlob(path: string, data: string): Promise<void> {
    await this.api.call({ op: 'put', path, data });
  }

  async get(host: string): Promise<CertPair | null> {
    const [cert, key] = await Promise.all([this.getBlob(`${host}/fullchain.pem`), this.getBlob(`${host}/key.pem`)]);
    return cert && key ? { cert, key } : null;
  }

  async put(host: string, pair: CertPair): Promise<void> {
    await this.putBlob(`${host}/key.pem`, pair.key);
    await this.putBlob(`${host}/fullchain.pem`, pair.cert);
  }
}

export class InkwellDns implements DnsProvider {
  constructor(private api: InkwellCertsApi) {}
  async setTxt(name: string, value: string): Promise<void> {
    await this.api.call({ op: 'txt-set', name, value });
  }
  async removeTxt(name: string, value: string): Promise<void> {
    await this.api.call({ op: 'txt-remove', name, value });
  }
}
