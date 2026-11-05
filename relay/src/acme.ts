/**
 * Let's Encrypt certificates via ACME DNS-01, with the TXT records written
 * through a pluggable DNS provider (Vercel DNS in production).
 */
import acme from 'acme-client';
import type { CertPair, CertSource, CertStore } from './certs.js';

export interface DnsProvider {
  /** `name` is the fully-qualified record name, e.g. _acme-challenge.abc.relay.ittogether.com.au */
  setTxt(name: string, value: string): Promise<void>;
  removeTxt(name: string, value: string): Promise<void>;
}

/** Vercel DNS API. Records are created relative to `domain`. */
export class VercelDns implements DnsProvider {
  private ids = new Map<string, string>();

  constructor(
    private token: string,
    private teamId: string | undefined,
    private domain = 'ittogether.com.au',
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private relative(name: string): string {
    const fqdn = name.replace(/\.$/, '').toLowerCase();
    const suffix = `.${this.domain}`;
    if (!fqdn.endsWith(suffix)) throw new Error(`${name} is not under ${this.domain}`);
    return fqdn.slice(0, -suffix.length);
  }

  private url(path: string): string {
    const q = this.teamId ? `?teamId=${encodeURIComponent(this.teamId)}` : '';
    return `https://api.vercel.com${path}${q}`;
  }

  async setTxt(name: string, value: string): Promise<void> {
    const res = await this.fetchImpl(this.url(`/v2/domains/${this.domain}/records`), {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: this.relative(name), type: 'TXT', value, ttl: 60 }),
    });
    if (!res.ok) throw new Error(`vercel dns create HTTP ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { uid?: string; id?: string };
    const id = body.uid ?? body.id;
    if (id) this.ids.set(`${name}\n${value}`, id);
  }

  async removeTxt(name: string, value: string): Promise<void> {
    const id = this.ids.get(`${name}\n${value}`);
    if (!id) return;
    const res = await this.fetchImpl(this.url(`/v2/domains/${this.domain}/records/${id}`), {
      method: 'DELETE',
      headers: { authorization: `Bearer ${this.token}` },
    });
    if (res.ok || res.status === 404) this.ids.delete(`${name}\n${value}`);
  }
}

export interface AcmeOptions {
  email: string;
  directoryUrl?: string;
  dns: DnsProvider;
  source: CertSource;
  /** wait after creating the TXT record before asking the CA to validate */
  propagationDelayMs?: number;
}

const ACCOUNT_KEY_PATH = '_acme/account-key.pem';

async function accountKey(source: CertSource): Promise<string> {
  const existing = await source.getBlob(ACCOUNT_KEY_PATH);
  if (existing) return existing;
  const key = (await acme.crypto.createPrivateKey()).toString();
  await source.putBlob(ACCOUNT_KEY_PATH, key);
  return key;
}

/** Order a certificate for `host` and store it. */
export async function issueCertificate(host: string, opts: AcmeOptions): Promise<CertPair> {
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host)) throw new Error('invalid host');
  const client = new acme.Client({
    directoryUrl: opts.directoryUrl ?? acme.directory.letsencrypt.production,
    accountKey: await accountKey(opts.source),
  });
  const [key, csr] = await acme.crypto.createCsr({ commonName: host, altNames: [host] });
  const delay = opts.propagationDelayMs ?? 15_000;
  const cert = await client.auto({
    csr,
    email: opts.email,
    termsOfServiceAgreed: true,
    challengePriority: ['dns-01'],
    challengeCreateFn: async (authz, challenge, keyAuthorization) => {
      if (challenge.type !== 'dns-01') throw new Error('only dns-01 is supported');
      await opts.dns.setTxt(`_acme-challenge.${authz.identifier.value}`, keyAuthorization);
      if (delay) await new Promise((r) => setTimeout(r, delay));
    },
    challengeRemoveFn: async (authz, _challenge, keyAuthorization) => {
      await opts.dns.removeTxt(`_acme-challenge.${authz.identifier.value}`, keyAuthorization).catch(() => {});
    },
  });
  const pair = { cert, key: key.toString() };
  await opts.source.put(host, pair);
  return pair;
}

const RENEW_BEFORE_MS = 30 * 86_400_000;

/** Renew every loaded cert within 30 days of expiry. Returns renewed hosts. */
export async function renewDue(
  store: CertStore,
  opts: AcmeOptions,
  log: (msg: string, extra?: Record<string, unknown>) => void = () => {},
): Promise<string[]> {
  await store.reload().catch(() => {}); // pick up renewals done by the other machine
  const renewed: string[] = [];
  for (const c of store.hosts()) {
    if (c.notAfter.getTime() - Date.now() > RENEW_BEFORE_MS) continue;
    try {
      const pair = await issueCertificate(c.host, opts);
      store.set(c.host, pair);
      renewed.push(c.host);
      log('cert renewed', { host: c.host });
    } catch (err) {
      log('cert renew failed', { host: c.host, err: String(err) });
    }
  }
  return renewed;
}
