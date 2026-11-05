/** Downstream delivery to the tenant's Exchange Online MX with nodemailer. */
import dns from 'node:dns/promises';
import { isIP } from 'node:net';
import type { Readable } from 'node:stream';
import nodemailer from 'nodemailer';
import type { CertPair } from './certs.js';

export class MxResolver {
  private cache = new Map<string, { at: number; hosts: string[] }>();
  constructor(private ttlMs = 10 * 60_000) {}

  async resolve(domain: string): Promise<string[]> {
    const d = domain.toLowerCase();
    const hit = this.cache.get(d);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.hosts;
    const records = await dns.resolveMx(d);
    const hosts = records
      .filter((r) => r.exchange && r.exchange !== '.')
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.exchange.replace(/\.$/, ''));
    if (!hosts.length) throw new Error(`no MX for ${d}`);
    this.cache.set(d, { at: Date.now(), hosts });
    return hosts;
  }
}

export interface DeliverOptions {
  /** EHLO name, i.e. the tenant relay hostname */
  name: string;
  /** client certificate to present (matches the Exchange inbound connector) */
  clientCert?: CertPair;
  port?: number;
  rejectUnauthorized?: boolean;
  timeoutMs?: number;
}

export interface Envelope {
  from: string;
  to: string[];
}

/** Try each host in order; resolves with the host that accepted the message. */
export async function deliver(
  hosts: string[],
  envelope: Envelope,
  makeStream: () => Readable,
  opts: DeliverOptions,
): Promise<{ host: string; response: string }> {
  let lastErr: unknown;
  for (const host of hosts) {
    const transport = nodemailer.createTransport({
      host,
      port: opts.port ?? 25,
      secure: false,
      requireTLS: true,
      name: opts.name,
      connectionTimeout: opts.timeoutMs ?? 30_000,
      greetingTimeout: opts.timeoutMs ?? 30_000,
      socketTimeout: 5 * 60_000,
      tls: {
        ...(isIP(host) ? {} : { servername: host }),
        minVersion: 'TLSv1.2',
        rejectUnauthorized: opts.rejectUnauthorized ?? true,
        ...(opts.clientCert ? { cert: opts.clientCert.cert, key: opts.clientCert.key } : {}),
      },
      logger: false,
      debug: false,
    });
    try {
      const info = (await transport.sendMail({ envelope: { from: envelope.from, to: envelope.to }, raw: makeStream() })) as { response?: string };
      return { host, response: String(info.response ?? '') };
    } catch (err) {
      lastErr = err;
      // A definite rejection from a reachable MX is not retried on the next MX.
      const code = (err as { responseCode?: number }).responseCode;
      if (code && code >= 500) break;
    } finally {
      transport.close();
    }
  }
  throw lastErr ?? new Error('delivery failed');
}
