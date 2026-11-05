/**
 * Per-host TLS certificates. The same cert is used as the SMTP server cert
 * (picked by SNI) and as the client cert presented to the tenant's Exchange
 * Online MX (matched by the inbound connector's TlsSenderCertificateName).
 */
import { X509Certificate } from 'node:crypto';
import tls from 'node:tls';
import selfsigned from 'selfsigned';

export interface CertPair {
  cert: string; // PEM, full chain
  key: string; // PEM
}

export interface LoadedCert extends CertPair {
  host: string;
  notAfter: Date;
  context: tls.SecureContext;
}

/** Backing store for certs (and small blobs such as the ACME account key). */
export interface CertSource {
  listHosts(): Promise<string[]>;
  get(host: string): Promise<CertPair | null>;
  put(host: string, pair: CertPair): Promise<void>;
  getBlob(path: string): Promise<string | null>;
  putBlob(path: string, data: string): Promise<void>;
}

const BUCKET = 'relay-certs';

/** Supabase Storage via its REST API: relay-certs/<host>/fullchain.pem + key.pem */
export class SupabaseCertSource implements CertSource {
  constructor(
    private url: string,
    private serviceKey: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...extra };
  }

  private base(): string {
    return `${this.url.replace(/\/$/, '')}/storage/v1`;
  }

  async listHosts(): Promise<string[]> {
    const res = await this.fetchImpl(`${this.base()}/object/list/${BUCKET}`, {
      method: 'POST',
      headers: this.headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ prefix: '', limit: 10_000, offset: 0 }),
    });
    if (!res.ok) throw new Error(`storage list HTTP ${res.status}`);
    const items = (await res.json()) as Array<{ name: string; id: string | null }>;
    // Folders come back with id === null.
    return items.filter((i) => i.id === null && !i.name.startsWith('_')).map((i) => i.name);
  }

  async getBlob(path: string): Promise<string | null> {
    const res = await this.fetchImpl(`${this.base()}/object/${BUCKET}/${path}`, { headers: this.headers() });
    if (res.status === 400 || res.status === 404) return null;
    if (!res.ok) throw new Error(`storage get ${path} HTTP ${res.status}`);
    return res.text();
  }

  async putBlob(path: string, data: string): Promise<void> {
    const res = await this.fetchImpl(`${this.base()}/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: this.headers({ 'content-type': 'application/x-pem-file', 'x-upsert': 'true' }),
      body: data,
    });
    if (!res.ok) throw new Error(`storage put ${path} HTTP ${res.status}`);
  }

  async get(host: string): Promise<CertPair | null> {
    const [cert, key] = await Promise.all([this.getBlob(`${host}/fullchain.pem`), this.getBlob(`${host}/key.pem`)]);
    return cert && key ? { cert, key } : null;
  }

  async put(host: string, pair: CertPair): Promise<void> {
    // Key first so a reader never sees a new cert with an old key for long.
    await this.putBlob(`${host}/key.pem`, pair.key);
    await this.putBlob(`${host}/fullchain.pem`, pair.cert);
  }
}

/** In-memory source for tests and local development. */
export class MemoryCertSource implements CertSource {
  certs = new Map<string, CertPair>();
  blobs = new Map<string, string>();
  async listHosts() {
    return [...this.certs.keys()];
  }
  async get(host: string) {
    return this.certs.get(host) ?? null;
  }
  async put(host: string, pair: CertPair) {
    this.certs.set(host, pair);
  }
  async getBlob(path: string) {
    return this.blobs.get(path) ?? null;
  }
  async putBlob(path: string, data: string) {
    this.blobs.set(path, data);
  }
}

export function loadPair(host: string, pair: CertPair): LoadedCert {
  const x509 = new X509Certificate(pair.cert);
  return {
    host,
    ...pair,
    notAfter: new Date(x509.validTo),
    context: tls.createSecureContext({ cert: pair.cert, key: pair.key, minVersion: 'TLSv1.2' }),
  };
}

export async function selfSignedPair(host: string, days = 30): Promise<CertPair> {
  const r = await selfsigned.generate([{ name: 'commonName', value: host }], {
    keySize: 2048,
    algorithm: 'sha256',
    notAfterDate: new Date(Date.now() + days * 86_400_000),
    extensions: [{ name: 'subjectAltName', altNames: [{ type: 2, value: host }] }],
  });
  return { cert: r.cert, key: r.private };
}

export class CertStore {
  private certs = new Map<string, LoadedCert>();
  private fallback: LoadedCert | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private source: CertSource,
    private log: (msg: string, extra?: Record<string, unknown>) => void = () => {},
  ) {}

  /** Load every host. Hosts that fail to load keep their previous cert. */
  async reload(): Promise<void> {
    const hosts = await this.source.listHosts();
    await Promise.all(
      hosts.map(async (host) => {
        try {
          const pair = await this.source.get(host);
          if (pair) this.certs.set(host.toLowerCase(), loadPair(host.toLowerCase(), pair));
        } catch (err) {
          this.log('cert load failed', { host, err: String(err) });
        }
      }),
    );
    this.log('certs loaded', { count: this.certs.size });
  }

  startAutoReload(intervalMs = 10 * 60_000): void {
    this.timer = setInterval(() => this.reload().catch((e) => this.log('cert reload failed', { err: String(e) })), intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  set(host: string, pair: CertPair): void {
    this.certs.set(host.toLowerCase(), loadPair(host.toLowerCase(), pair));
  }

  get(host: string | undefined | null): LoadedCert | undefined {
    return host ? this.certs.get(host.toLowerCase()) : undefined;
  }

  hosts(): LoadedCert[] {
    return [...this.certs.values()];
  }

  /** Cert used when the client sends no SNI or an unknown name. */
  async defaultCert(defaultHost: string): Promise<LoadedCert> {
    const known = this.get(defaultHost) ?? this.hosts()[0];
    if (known) return known;
    if (!this.fallback) this.fallback = loadPair(defaultHost, await selfSignedPair(defaultHost));
    return this.fallback;
  }

  context(host: string | undefined | null): tls.SecureContext | undefined {
    return this.get(host)?.context;
  }
}
