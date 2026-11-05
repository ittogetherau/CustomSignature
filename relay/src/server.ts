/**
 * The relay: SMTP in from Exchange Online (STARTTLS, SNI-selected cert),
 * signature insertion, SMTP out to the tenant's MX with a client cert.
 * Port 8080 serves /health and the HMAC-protected /admin/cert endpoint.
 */
import { randomUUID } from 'node:crypto';
import dns from 'node:dns/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { SMTPServer, type SMTPServerSession } from 'smtp-server';
import { issueCertificate, renewDue, type AcmeOptions } from './acme.js';
import type { EventStatus, InkwellApi } from './api.js';
import type { CertStore } from './certs.js';
import { deliver } from './deliver.js';
import { verify, SIG_HEADER, TS_HEADER } from './hmac.js';
import type { Signature } from './insert.js';
import { detectClient, parseHeaderBlock, rewriteMessage, SIGNED_HEADER, type ClientKind, type RewriteResult } from './rewrite.js';

export type Logger = (msg: string, extra?: Record<string, unknown>) => void;

export const jsonLogger: Logger = (msg, extra) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));

export interface RelayConfig {
  smtpPort: number;
  httpPort: number;
  bindHost?: string;
  /** hostname used when the client sends no SNI (and as the EHLO greeting) */
  defaultHost: string;
  /** only issue certs for hosts under this suffix, e.g. relay.ittogether.com.au */
  relayDomain: string;
  requireRdns: boolean;
  /** expect a PROXY protocol v1 header (Fly.io proxy_proto handler) so the real client IP is visible */
  useProxy?: boolean;
  rdnsSuffix?: string;
  maxSize?: number;
  api: InkwellApi;
  certs: CertStore;
  mx: { resolve(domain: string): Promise<string[]> };
  deliveryPort?: number;
  deliveryRejectUnauthorized?: boolean;
  spoolDir: string;
  /** secret for the admin endpoint (RELAY_SECRET) */
  secret: string;
  acme?: AcmeOptions;
  renewIntervalMs?: number;
  log?: Logger;
  reverseLookup?: (ip: string) => Promise<string[]>;
  forwardLookup?: (host: string) => Promise<string[]>;
}

export const DEFAULT_MAX_SIZE = 150 * 1024 * 1024;
const OUTLOOK_RDNS = '.outbound.protection.outlook.com';

/** Forward-confirmed reverse DNS: PTR must end in `suffix` and resolve back to `ip`. */
export async function checkRdns(
  ip: string,
  suffix = OUTLOOK_RDNS,
  reverse: (ip: string) => Promise<string[]> = (i) => dns.reverse(i),
  forward: (host: string) => Promise<string[]> = async (h) => {
    const [a, b] = await Promise.allSettled([dns.resolve4(h), dns.resolve6(h)]);
    return [...(a.status === 'fulfilled' ? a.value : []), ...(b.status === 'fulfilled' ? b.value : [])];
  },
): Promise<string | null> {
  const addr = ip.replace(/^::ffff:/, '');
  const names = await reverse(addr).catch(() => [] as string[]);
  for (const name of names) {
    const n = name.toLowerCase().replace(/\.$/, '');
    if (!n.endsWith(suffix)) continue;
    const ips = await forward(n).catch(() => [] as string[]);
    if (ips.some((x) => x.replace(/^::ffff:/, '').toLowerCase() === addr.toLowerCase())) return n;
  }
  return null;
}

function smtpError(message: string, responseCode: number): Error {
  return Object.assign(new Error(message), { responseCode });
}

function statusFor(r: RewriteResult): EventStatus {
  if (r.signed) return 'signed';
  return r.reason === 'no-signature' ? 'skipped' : 'passthrough';
}

async function readHead(file: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of createReadStream(file, { end: 64 * 1024 - 1 })) {
    chunks.push(c as Buffer);
    size += (c as Buffer).length;
    if (size >= 64 * 1024) break;
  }
  return Buffer.concat(chunks);
}

export interface Relay {
  smtp: SMTPServer;
  http: http.Server;
  smtpPort: number;
  httpPort: number;
  close(): Promise<void>;
}

export async function startRelay(cfg: RelayConfig): Promise<Relay> {
  const log = cfg.log ?? jsonLogger;
  const maxSize = cfg.maxSize ?? DEFAULT_MAX_SIZE;
  await mkdir(cfg.spoolDir, { recursive: true });
  const fallback = await cfg.certs.defaultCert(cfg.defaultHost);
  /** last MX that accepted mail per tenant, used for null-sender messages */
  const tenantMx = new Map<string, string[]>();

  const smtp = new SMTPServer({
    name: cfg.defaultHost,
    banner: 'Inkwell signature relay',
    secure: false,
    key: fallback.key,
    cert: fallback.cert,
    minVersion: 'TLSv1.2',
    SNICallback: (servername: string, cb: (err: Error | null, ctx?: import('node:tls').SecureContext) => void) => {
      cb(null, cfg.certs.context(servername) ?? fallback.context);
    },
    size: maxSize,
    authOptional: true,
    disabledCommands: ['AUTH'],
    disableReverseLookup: true,
    useProxy: cfg.useProxy ?? false,
    hideSTARTTLS: false,
    logger: false,

    onConnect(session, cb) {
      if (!cfg.requireRdns) return cb();
      checkRdns(session.remoteAddress, cfg.rdnsSuffix, cfg.reverseLookup, cfg.forwardLookup)
        .then((name) => {
          if (name) return cb();
          log('rejected connection', { ip: session.remoteAddress });
          cb(smtpError('5.7.1 Relay access is limited to Exchange Online', 550));
        })
        .catch(() => cb(smtpError('4.4.3 rDNS check failed', 421)));
    },

    onMailFrom(_address, session, cb) {
      if (!session.secure) return cb(smtpError('5.7.0 Must issue a STARTTLS command first', 530));
      cb();
    },

    onRcptTo(_address, session, cb) {
      if (!session.secure) return cb(smtpError('5.7.0 Must issue a STARTTLS command first', 530));
      cb();
    },

    onData(stream, session, cb) {
      handleMessage(stream, session)
        .then((msg) => cb(null, msg))
        .catch((err: Error & { responseCode?: number }) => cb(err));
    },
  });

  async function handleMessage(stream: Readable & { sizeExceeded?: boolean }, session: SMTPServerSession): Promise<string> {
    const t0 = Date.now();
    const tenantHost = (session.servername || cfg.defaultHost).toLowerCase();
    const mailFrom = session.envelope.mailFrom;
    const sender = (mailFrom && mailFrom.address) || '';
    const rcpts = session.envelope.rcptTo.map((r) => r.address);
    const id = randomUUID();
    const orig = path.join(cfg.spoolDir, `${id}.in.eml`);
    const out = path.join(cfg.spoolDir, `${id}.out.eml`);

    // Start the lookup while the message body is still arriving.
    const sigPromise: Promise<{ ok: boolean; sig: Signature | null }> = sender
      ? cfg.api.lookup(tenantHost, sender).then(
          (sig) => ({ ok: true, sig }),
          (err) => {
            log('signature lookup failed', { tenantHost, err: String(err?.message ?? err) });
            return { ok: false, sig: null };
          },
        )
      : Promise.resolve({ ok: true, sig: null });

    let status: EventStatus = 'failed_open';
    let client: ClientKind = 'other';
    try {
      await pipeline(stream, createWriteStream(orig));
      if (stream.sizeExceeded) {
        status = 'rejected';
        throw smtpError('5.3.4 Message exceeds maximum size', 552);
      }

      const { ok, sig } = await sigPromise;
      let file = orig;
      let prependHeader = false;
      try {
        const r = await rewriteMessage(createReadStream(orig), createWriteStream(out), sig);
        client = r.client;
        status = ok ? statusFor(r) : 'failed_open';
        file = out;
      } catch (err) {
        // Fail open: the original bytes, plus the loop-prevention header.
        log('rewrite failed', { tenantHost, err: String((err as Error)?.message ?? err) });
        status = 'failed_open';
        prependHeader = true;
        const h = parseHeaderBlock(await readHead(orig));
        client = detectClient(h.get('x-mailer') ?? '', h.get('user-agent') ?? '');
      }

      const makeStream = (): Readable => {
        const body = createReadStream(file);
        if (!prependHeader) return body;
        const pt = new PassThrough();
        pt.write(`${SIGNED_HEADER}: 1\r\n`);
        body.on('error', (e) => pt.destroy(e));
        body.pipe(pt);
        return pt;
      };

      let hosts: string[];
      const domain = sender.split('@')[1];
      try {
        if (domain) hosts = await cfg.mx.resolve(domain);
        else if (tenantMx.has(tenantHost)) hosts = tenantMx.get(tenantHost)!;
        else throw new Error('null sender and no known MX for tenant');
      } catch (err) {
        status = 'deferred';
        throw smtpError(`4.4.4 Cannot resolve tenant MX: ${(err as Error).message}`, 451);
      }

      try {
        const res = await deliver(hosts, { from: sender, to: rcpts }, makeStream, {
          name: tenantHost,
          clientCert: cfg.certs.get(tenantHost) ?? undefined,
          port: cfg.deliveryPort,
          rejectUnauthorized: cfg.deliveryRejectUnauthorized,
        });
        tenantMx.set(tenantHost, hosts);
        log('delivered', {
          tenantHost,
          senderDomain: domain,
          rcpts: rcpts.length,
          size: (await stat(file)).size,
          status,
          client,
          mx: res.host,
          ms: Date.now() - t0,
        });
        return `2.0.0 Relayed (${status})`;
      } catch (err) {
        status = 'deferred';
        const e = err as Error & { responseCode?: number };
        log('delivery failed', { tenantHost, senderDomain: domain, code: e.responseCode, err: e.message });
        throw smtpError('4.4.2 Downstream delivery failed, try again later', 451);
      }
    } finally {
      await Promise.all([rm(orig, { force: true }), rm(out, { force: true })]);
      if (sender || status !== 'rejected') {
        cfg.api.event({ tenantHost, sender, client, status, ms: Date.now() - t0 });
      }
    }
  }

  smtp.on('error', (err) => log('smtp error', { err: err.message }));

  // ---- admin / health HTTP ----
  const inFlight = new Map<string, Promise<unknown>>();
  const httpServer = http.createServer((req, res) => {
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET' && req.url === '/health') {
      return send(200, { ok: true, certs: cfg.certs.hosts().length });
    }
    if (req.method === 'POST' && req.url === '/admin/cert') {
      let raw = '';
      let tooBig = false;
      req.setEncoding('utf8');
      req.on('data', (c: string) => {
        raw += c;
        if (raw.length > 10_000) tooBig = true;
      });
      req.on('end', () => {
        if (tooBig) return send(413, { error: 'too large' });
        const ok = verify(cfg.secret, raw, req.headers[SIG_HEADER.toLowerCase()] as string, req.headers[TS_HEADER.toLowerCase()] as string);
        if (!ok) return send(401, { error: 'bad signature' });
        let host = '';
        try {
          host = String(JSON.parse(raw).host ?? '').toLowerCase().trim();
        } catch {
          return send(400, { error: 'bad json' });
        }
        if (!host || !host.endsWith(`.${cfg.relayDomain}`) || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) {
          return send(400, { error: `host must be under ${cfg.relayDomain}` });
        }
        if (!cfg.acme) return send(503, { error: 'ACME not configured' });
        const acmeOpts = cfg.acme;
        const job =
          inFlight.get(host) ??
          issueCertificate(host, acmeOpts)
            .then((pair) => cfg.certs.set(host, pair))
            .finally(() => inFlight.delete(host));
        inFlight.set(host, job);
        job.then(
          () => send(200, { host, notAfter: cfg.certs.get(host)?.notAfter.toISOString() }),
          (err) => {
            log('cert issue failed', { host, err: String(err?.message ?? err) });
            send(502, { error: 'issue failed', detail: String(err?.message ?? err) });
          },
        );
      });
      return;
    }
    send(404, { error: 'not found' });
  });

  let renewTimer: NodeJS.Timeout | null = null;
  if (cfg.acme && cfg.renewIntervalMs !== 0) {
    const acmeOpts = cfg.acme;
    const run = () => renewDue(cfg.certs, acmeOpts, log).catch((e) => log('renew run failed', { err: String(e) }));
    // Jitter so the two machines don't renew at the same moment.
    const first = setTimeout(run, 5 * 60_000 + Math.floor(Math.random() * 60 * 60_000));
    first.unref();
    renewTimer = setInterval(run, cfg.renewIntervalMs ?? 24 * 60 * 60_000);
    renewTimer.unref();
  }

  await new Promise<void>((resolve, reject) => {
    smtp.once('error', reject);
    smtp.listen(cfg.smtpPort, cfg.bindHost, () => {
      smtp.off('error', reject);
      resolve();
    });
  });
  await new Promise<void>((resolve) => httpServer.listen(cfg.httpPort, cfg.bindHost, resolve));

  const smtpAddr = (smtp as unknown as { server: import('node:net').Server }).server.address() as AddressInfo;
  return {
    smtp,
    http: httpServer,
    smtpPort: smtpAddr.port,
    httpPort: (httpServer.address() as AddressInfo).port,
    async close() {
      if (renewTimer) clearInterval(renewTimer);
      cfg.certs.stop();
      await Promise.all([
        new Promise<void>((r) => smtp.close(() => r())),
        new Promise<void>((r) => httpServer.close(() => r())),
      ]);
    },
  };
}
