/**
 * Local end-to-end: nodemailer -> relay (STARTTLS + SNI, rDNS check off)
 * -> local smtp-server sink, with a fake Inkwell API.
 */
import { X509Certificate } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { TLSSocket } from 'node:tls';
import nodemailer from 'nodemailer';
import { SMTPServer } from 'smtp-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { InkwellApi } from '../src/api.js';
import { CertStore, MemoryCertSource, selfSignedPair } from '../src/certs.js';
import { sign, verify } from '../src/hmac.js';
import { checkRdns, startRelay, type Relay } from '../src/server.js';
import { decode, parts, SIG } from './helpers.js';

const SECRET = 'test-secret';
const TENANT_HOST = 't1.relay.ittogether.test';

interface ApiCall {
  path: string;
  body: any;
  validSig: boolean;
}

let api: http.Server;
let apiUrl: string;
let apiCalls: ApiCall[] = [];
let apiMode: 'ok' | 'down' | 'no-apply' = 'ok';

interface Received {
  from: string;
  to: string[];
  raw: Buffer;
  clientCertCN?: string;
  sni?: string;
}
let sink: SMTPServer;
let sinkPort: number;
let received: Received[] = [];
let sinkReject: number | null = null;

let relay: Relay;
const logs: Array<{ msg: string; extra?: Record<string, unknown> }> = [];

beforeAll(async () => {
  // ---- fake Inkwell API ----
  api = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const validSig = verify(SECRET, raw, req.headers['x-inkwell-signature'] as string, req.headers['x-inkwell-timestamp'] as string);
      apiCalls.push({ path: req.url!, body: JSON.parse(raw), validSig });
      if (apiMode === 'down' && req.url === '/api/relay/signature') {
        res.writeHead(503).end();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      if (req.url === '/api/relay/signature') {
        res.end(JSON.stringify(apiMode === 'no-apply' ? { apply: false } : { apply: true, ...SIG }));
      } else res.end('{}');
    });
  });
  await new Promise<void>((r) => api.listen(0, '127.0.0.1', r));
  apiUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;

  // ---- downstream sink (stands in for <tenant>.mail.protection.outlook.com) ----
  const sinkCert = await selfSignedPair('contoso-com.mail.protection.outlook.test');
  const peer = new WeakMap<object, { cn?: string; sni?: string }>();
  sink = new SMTPServer({
    key: sinkCert.key,
    cert: sinkCert.cert,
    requestCert: true,
    rejectUnauthorized: false,
    authOptional: true,
    disabledCommands: ['AUTH'],
    disableReverseLookup: true,
    logger: false,
    onSecure(socket, session, cb) {
      const pc = (socket as TLSSocket).getPeerCertificate();
      peer.set(session, { cn: pc?.subject?.CN as string | undefined });
      cb();
    },
    onMailFrom(_a, session, cb) {
      if (!session.secure) return cb(Object.assign(new Error('5.7.0 STARTTLS required'), { responseCode: 530 }));
      cb();
    },
    onData(stream, session, cb) {
      const chunks: Buffer[] = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => {
        if (sinkReject) return cb(Object.assign(new Error('rejected by sink'), { responseCode: sinkReject }));
        received.push({
          from: session.envelope.mailFrom ? session.envelope.mailFrom.address : '',
          to: session.envelope.rcptTo.map((r) => r.address),
          raw: Buffer.concat(chunks),
          clientCertCN: peer.get(session)?.cn,
        });
        cb(null, 'queued');
      });
    },
  });
  await new Promise<void>((r) => sink.listen(0, '127.0.0.1', r));
  sinkPort = ((sink as any).server.address() as AddressInfo).port;

  // ---- relay ----
  const source = new MemoryCertSource();
  await source.put(TENANT_HOST, await selfSignedPair(TENANT_HOST));
  const certs = new CertStore(source);
  await certs.reload();

  relay = await startRelay({
    smtpPort: 0,
    httpPort: 0,
    bindHost: '127.0.0.1',
    defaultHost: 'relay.ittogether.test',
    relayDomain: 'relay.ittogether.test',
    requireRdns: false,
    api: new InkwellApi({ baseUrl: apiUrl, secret: SECRET, cacheMs: 0 }),
    certs,
    mx: { resolve: async () => ['127.0.0.1'] },
    deliveryPort: sinkPort,
    deliveryRejectUnauthorized: false,
    spoolDir: path.join(os.tmpdir(), `inkwell-relay-test-${process.pid}`),
    secret: SECRET,
    renewIntervalMs: 0,
    log: (msg, extra) => logs.push({ msg, extra }),
  });
});

afterAll(async () => {
  await relay?.close();
  await new Promise<void>((r) => sink.close(() => r()));
  await new Promise<void>((r) => api.close(() => r()));
});

afterEach(() => {
  apiCalls = [];
  received = [];
  apiMode = 'ok';
  sinkReject = null;
});

function client(opts: { ignoreTLS?: boolean } = {}) {
  return nodemailer.createTransport({
    host: '127.0.0.1',
    port: relay.smtpPort,
    secure: false,
    requireTLS: !opts.ignoreTLS,
    ignoreTLS: !!opts.ignoreTLS,
    name: 'SY4PR01CU001.outbound.protection.outlook.com',
    tls: { servername: TENANT_HOST, rejectUnauthorized: false },
  });
}

const message = {
  from: 'jane@contoso.com',
  to: ['bob@example.com', 'carol@fabrikam.com'],
  subject: 'Hello from the relay test',
  headers: { 'X-Mailer': 'Microsoft Outlook 16.0' },
  text: 'Hi Bob,\r\n\r\nSee you soon.\r\n',
  html: '<html><body><p>Hi Bob,</p><p>See you soon.</p></body></html>',
};

/** events are fire-and-forget, so wait for them */
async function waitFor<T>(fn: () => T | undefined, ms = 3000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('relay end-to-end', () => {
  it('delivers a signed message to the sink', async () => {
    const info = await client().sendMail(message);
    expect(info.response).toMatch(/^250 .*Relayed \(signed\)/);

    expect(received).toHaveLength(1);
    const got = received[0];
    expect(got.from).toBe('jane@contoso.com');
    expect(got.to).toEqual(['bob@example.com', 'carol@fabrikam.com']);
    expect(got.raw.toString().startsWith('X-Inkwell-Signed: 1\r\n')).toBe(true);
    // the tenant client cert was presented downstream
    expect(got.clientCertCN).toBe(TENANT_HOST);

    const p = await parts(got.raw);
    const html = decode(p.find((x) => x.contentType === 'text/html')!);
    expect(html).toContain('<div data-inkwell-sig="1"><table><tr><td><b>Jane Doe</b>');
    expect(decode(p.find((x) => x.contentType === 'text/plain')!)).toContain('Jane Doe · IT Together');

    const lookup = apiCalls.find((c) => c.path === '/api/relay/signature')!;
    expect(lookup.body).toEqual({ tenantHost: TENANT_HOST, sender: 'jane@contoso.com' });
    expect(lookup.validSig).toBe(true);

    const ev = await waitFor(() => apiCalls.find((c) => c.path === '/api/relay/event'));
    expect(ev.validSig).toBe(true);
    expect(ev.body).toMatchObject({ tenantHost: TENANT_HOST, sender: 'jane@contoso.com', client: 'outlook-desktop', status: 'signed' });
    expect(typeof ev.body.ms).toBe('number');

    // nothing from the message body reaches the logs
    expect(JSON.stringify(logs)).not.toContain('See you soon');
  });

  it('fails open when the signature API is down', async () => {
    apiMode = 'down';
    const info = await client().sendMail(message);
    expect(info.response).toMatch(/^250 /);
    expect(received).toHaveLength(1);
    const raw = received[0].raw.toString();
    expect(raw.startsWith('X-Inkwell-Signed: 1\r\n')).toBe(true);
    expect(raw).not.toContain('data-inkwell-sig');
    const ev = await waitFor(() => apiCalls.find((c) => c.path === '/api/relay/event'));
    expect(ev.body.status).toBe('failed_open');
  });

  it('passes through when the API says not to apply', async () => {
    apiMode = 'no-apply';
    await client().sendMail(message);
    expect(received[0].raw.toString()).not.toContain('data-inkwell-sig');
    const ev = await waitFor(() => apiCalls.find((c) => c.path === '/api/relay/event'));
    expect(ev.body.status).toBe('skipped');
  });

  it('returns 451 when downstream delivery fails', async () => {
    sinkReject = 550;
    await expect(client().sendMail(message)).rejects.toMatchObject({ responseCode: 451 });
    expect(received).toHaveLength(0);
    const ev = await waitFor(() => apiCalls.find((c) => c.path === '/api/relay/event'));
    expect(ev.body.status).toBe('deferred');
  });

  it('requires STARTTLS', async () => {
    await expect(client({ ignoreTLS: true }).sendMail(message)).rejects.toMatchObject({ responseCode: 530 });
  });

  it('serves the SNI-selected certificate', async () => {
    const tls = await import('node:tls');
    const net = await import('node:net');
    const cert = await new Promise<X509Certificate>((resolve, reject) => {
      const sock = net.connect(relay.smtpPort, '127.0.0.1');
      let buf = '';
      sock.on('data', (d) => {
        buf += d.toString();
        if (/^220 /m.test(buf) && !buf.includes('EHLO-SENT')) {
          buf += 'EHLO-SENT';
          sock.write('EHLO test\r\n');
        } else if (/^250 /m.test(buf.split('EHLO-SENT')[1] ?? '') && !buf.includes('TLS-SENT')) {
          buf += 'TLS-SENT';
          sock.write('STARTTLS\r\n');
        } else if (buf.includes('TLS-SENT') && /^220 /m.test(buf.split('TLS-SENT')[1] ?? '')) {
          sock.removeAllListeners('data');
          const t = tls.connect({ socket: sock, servername: TENANT_HOST, rejectUnauthorized: false }, () => {
            const c = t.getPeerX509Certificate()!;
            t.destroy();
            resolve(c);
          });
          t.on('error', reject);
        }
      });
      sock.on('error', reject);
    });
    expect(cert.subject).toContain(`CN=${TENANT_HOST}`);
  });
});

describe('admin http', () => {
  const base = () => `http://127.0.0.1:${relay.httpPort}`;

  it('GET /health', async () => {
    const res = await fetch(`${base()}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, certs: 1 });
  });

  it('POST /admin/cert rejects a bad signature', async () => {
    const res = await fetch(`${base()}/admin/cert`, {
      method: 'POST',
      headers: { 'x-inkwell-signature': 'sha256=00', 'x-inkwell-timestamp': String(Math.floor(Date.now() / 1000)) },
      body: JSON.stringify({ host: 'a.relay.ittogether.test' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /admin/cert validates the host and needs ACME config', async () => {
    const post = (host: string) => {
      const body = JSON.stringify({ host });
      return fetch(`${base()}/admin/cert`, { method: 'POST', headers: sign(SECRET, body), body });
    };
    expect((await post('evil.example.com')).status).toBe(400);
    expect((await post('a.relay.ittogether.test')).status).toBe(503);
  });
});

describe('checkRdns', () => {
  const rev = (names: string[]) => async () => names;
  const fwd = (ips: string[]) => async () => ips;

  it('accepts forward-confirmed Exchange Online hosts', async () => {
    const name = 'mail-sy4aus01on2101.outbound.protection.outlook.com';
    expect(await checkRdns('::ffff:40.107.1.2', undefined, rev([name]), fwd(['40.107.1.2']))).toBe(name);
  });

  it('rejects other PTRs and unconfirmed PTRs', async () => {
    expect(await checkRdns('1.2.3.4', undefined, rev(['mail.example.com']), fwd(['1.2.3.4']))).toBeNull();
    expect(await checkRdns('1.2.3.4', undefined, rev(['x.outbound.protection.outlook.com']), fwd(['5.6.7.8']))).toBeNull();
    expect(
      await checkRdns('1.2.3.4', undefined, async () => {
        throw new Error('NXDOMAIN');
      }, fwd([])),
    ).toBeNull();
  });
});
