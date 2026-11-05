/** Production entrypoint: reads the environment and starts the relay. */
import os from 'node:os';
import path from 'node:path';
import { VercelDns, type AcmeOptions } from './acme.js';
import { InkwellApi } from './api.js';
import { CertStore, SupabaseCertSource, type CertSource } from './certs.js';
import { InkwellCertSource, InkwellCertsApi, InkwellDns } from './inkwellStore.js';
import { MxResolver } from './deliver.js';
import { jsonLogger, startRelay } from './server.js';

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`missing env ${name}`);
  return v;
}

const flag = (name: string, dflt: boolean) => {
  const v = process.env[name];
  return v === undefined ? dflt : /^(1|true|yes|on)$/i.test(v);
};

async function main() {
  const log = jsonLogger;
  // Default: certificates and ACME records go through the Inkwell API (relay holds only RELAY_SECRET).
  // Direct Supabase / Vercel access is used only if their keys are explicitly configured.
  const inkwellCerts = new InkwellCertsApi(env('INKWELL_API'), env('RELAY_SECRET'));
  const source: CertSource = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? new SupabaseCertSource(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
    : new InkwellCertSource(inkwellCerts);
  const certs = new CertStore(source, log);
  await certs.reload().catch((e) => log('initial cert load failed', { err: String(e) }));
  certs.startAutoReload();

  const acme: AcmeOptions = {
    email: env('ACME_EMAIL', 'admin@ittogether.com.au'),
    directoryUrl: process.env.ACME_DIRECTORY_URL || undefined,
    dns: process.env.VERCEL_TOKEN
      ? new VercelDns(env('VERCEL_TOKEN'), process.env.VERCEL_TEAM_ID, env('DNS_DOMAIN', 'ittogether.com.au'))
      : new InkwellDns(inkwellCerts),
    source,
  };

  const relayDomain = env('RELAY_DOMAIN', 'relay.ittogether.com.au');
  const relay = await startRelay({
    smtpPort: Number(env('SMTP_PORT', '25')),
    httpPort: Number(env('HTTP_PORT', '8080')),
    defaultHost: env('RELAY_DEFAULT_HOST', relayDomain),
    relayDomain,
    requireRdns: flag('REQUIRE_OUTLOOK_RDNS', true),
    useProxy: flag('USE_PROXY_PROTOCOL', false),
    api: new InkwellApi({ baseUrl: env('INKWELL_API'), secret: env('RELAY_SECRET') }),
    certs,
    mx: new MxResolver(),
    spoolDir: env('SPOOL_DIR', path.join(os.tmpdir(), 'inkwell-relay')),
    secret: env('RELAY_SECRET'),
    acme,
    log,
  });
  log('relay listening', { smtp: relay.smtpPort, http: relay.httpPort, acme: !!acme });

  const shutdown = () => {
    log('shutting down');
    relay.close().finally(() => process.exit(0));
    setTimeout(() => process.exit(0), 25_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
