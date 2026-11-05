# Inkwell SMTP signature relay

Server-side email signatures for Microsoft 365. Exchange Online sends every
outgoing message from internal senders (transport rule + outbound connector) to
`<code>.relay.ittogether.com.au:25`. The relay:

1. accepts the message over STARTTLS, picking the certificate by SNI;
2. asks the Inkwell API for the sender's signature (`POST /api/relay/signature`);
3. inserts it into the first `text/html` and `text/plain` parts, above the quoted reply;
4. adds `X-Inkwell-Signed: 1` (so Exchange doesn't route it back to the relay);
5. delivers it to the tenant's MX (`<tenant>.mail.protection.outlook.com`) over
   TLS, presenting the per-tenant client certificate that the tenant's inbound
   connector trusts (`TlsSenderCertificateName = <code>.relay.ittogether.com.au`);
6. replies `250` to Exchange only after that delivery succeeds, and `451` otherwise
   so that Exchange retries;
7. posts a usage event to `POST /api/relay/event`. This is fire-and-forget.

The relay fails open. If the lookup or rewrite fails, or the API is down, it
delivers the original bytes unchanged, adding only the `X-Inkwell-Signed`
header. Messages that are `multipart/signed`, `multipart/encrypted` or
`application/pkcs7-mime` are never modified.

## Layout

| File | Purpose |
| --- | --- |
| `src/insert.ts` | Pure HTML and plain-text signature placement (Outlook desktop/web/mobile, iOS Mail, Gmail, new mail) |
| `src/rewrite.ts` | Streaming MIME rewrite with `@zone-eu/mailsplit`. Handles charset and transfer encoding. Other parts pass through byte-for-byte |
| `src/server.ts` | SMTP server, rDNS gate, delivery, events, and the `:8080` health/admin HTTP |
| `src/api.ts` | Inkwell API client (HMAC, 3 s timeout, 60 s cache) |
| `src/deliver.ts` | MX lookup (cached for 10 min) and nodemailer delivery with the client cert |
| `src/certs.ts` | Cert store backed by Supabase Storage `relay-certs/<host>/{fullchain,key}.pem`, reloaded every 10 min |
| `src/acme.ts` | Let's Encrypt DNS-01 via the Vercel DNS API, plus daily renewal |
| `src/hmac.ts` | Request signing shared with the API |

## Environment

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `INKWELL_API` | yes | | e.g. `https://inkwell.ittogether.com.au` |
| `RELAY_SECRET` | yes | | Shared HMAC secret. Also protects `/admin/cert` |
| `SUPABASE_URL` | yes | | |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | | Reads and writes the private `relay-certs` bucket |
| `VERCEL_TOKEN` | for ACME | | Enables `/admin/cert` and renewal. If unset, those return 503 or are off |
| `VERCEL_TEAM_ID` | for ACME | | |
| `DNS_DOMAIN` | | `ittogether.com.au` | Vercel DNS zone that holds `_acme-challenge` records |
| `ACME_EMAIL` | | `admin@ittogether.com.au` | Let's Encrypt account contact |
| `ACME_DIRECTORY_URL` | | LE production | Set to LE staging while testing |
| `RELAY_DOMAIN` | | `relay.ittogether.com.au` | `/admin/cert` only issues certs under this suffix |
| `RELAY_DEFAULT_HOST` | | `RELAY_DOMAIN` | Cert and tenant used when a client sends no SNI |
| `REQUIRE_OUTLOOK_RDNS` | | `true` | Forward-confirmed PTR must end in `.outbound.protection.outlook.com`. Set `false` for local tests |
| `USE_PROXY_PROTOCOL` | | `false` | Set `true` on Fly so the real client IP is visible (needed for the rDNS check) |
| `SMTP_PORT` / `HTTP_PORT` | | `25` / `8080` | |
| `SPOOL_DIR` | | `$TMPDIR/inkwell-relay` | Messages are spooled here while in flight (up to 150 MB each) and deleted afterwards |

## Contract with the Inkwell API

Every request carries these headers:

```
X-Inkwell-Timestamp: <unix seconds>
X-Inkwell-Signature: sha256=<hex HMAC-SHA256(RELAY_SECRET, "<timestamp>.<raw body>")>
```

The verifier should reject requests whose timestamp differs from its clock by
more than 300 s. `src/hmac.ts` has `sign` and `verify`.

- `POST /api/relay/signature` takes `{ tenantHost, sender }` and returns `{ apply: boolean, html?: string, text?: string }`.
- `POST /api/relay/event` takes `{ tenantHost, sender, client, status, ms }`.
  - `status` is one of `signed`, `skipped` (apply=false), `passthrough` (S/MIME, already signed, or duplicate), `failed_open`, `deferred` (451 returned) or `rejected` (too big).
  - `client` is one of `outlook-desktop`, `outlook-mac`, `outlook-mobile`, `apple-mail`, `gmail`, `thunderbird` or `other`. It comes from `X-Mailer` / `User-Agent`.

The relay logs metadata only: tenant, sender domain, recipient count, size,
status and timing. It never logs message content.

## Certificates

Each tenant host, `<code>.relay.ittogether.com.au`, has one certificate. It is
the SMTP server cert (chosen by SNI) and also the client cert presented to
Exchange Online. To issue or re-issue one:

```bash
BODY='{"host":"abc123.relay.ittogether.com.au"}'
TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$RELAY_SECRET" -hex | sed 's/^.* //')
curl -sS -X POST https://inkwell-relay.fly.dev/admin/cert \
  -H "X-Inkwell-Timestamp: $TS" -H "X-Inkwell-Signature: sha256=$SIG" \
  -H 'content-type: application/json' -d "$BODY"
```

The call creates `_acme-challenge.<host>` TXT records through Vercel DNS,
completes the DNS-01 order, writes `relay-certs/<host>/fullchain.pem` and
`key.pem`, and loads the new cert straight away. The other machine picks it up
on its next 10-minute reload. The ACME account key is stored at
`relay-certs/_acme/account-key.pem`.

Each machine runs renewal daily, starting at a random time 5–65 min after boot.
It renews any cert within 30 days of expiry, and reloads from storage first so
it skips certs the other machine has already renewed.

## Develop and test

```bash
npm install
npm test        # unit tests, MIME fixtures, and the local end-to-end test
npm run build   # tsc -> dist/
```

The end-to-end test (`test/e2e.test.ts`) runs these pieces locally:

- a fake Inkwell API;
- the relay on random high ports, with self-signed certs and the rDNS check off;
- a local `smtp-server` sink standing in for the tenant MX.

It sends mail with nodemailer and checks four things: the sink receives the
signed message, the tenant client cert is presented, the API requests are
correctly HMAC-signed, and the fail-open and 451 paths behave as described.

## Deploy (Fly.io)

**Prerequisites:**

- The Fly org must be allowed to send on outbound port 25. Fly blocks it by default, so ask Fly support.
- `fly.toml` uses `proxy_proto` v1 on port 25.

**Steps:**

1. Create the app and a dedicated IPv4 address. Port 25 needs a dedicated IP:
   ```bash
   fly apps create inkwell-relay
   fly ips allocate-v4 -a inkwell-relay
   fly ips allocate-v6 -a inkwell-relay
   ```
2. Set the secrets:
   ```bash
   fly secrets set -a inkwell-relay RELAY_SECRET=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... VERCEL_TOKEN=... VERCEL_TEAM_ID=...
   ```
3. Create the private Supabase Storage bucket `relay-certs`.
4. Deploy two machines in Sydney:
   ```bash
   fly deploy -a inkwell-relay
   fly scale count 2 --region syd -a inkwell-relay
   ```
5. DNS, handled by onboarding rather than this package:
   - `*.relay.ittogether.com.au` A/AAAA records pointing at the Fly IPs;
   - a PTR record for the IPv4, if Fly offers one.
6. Issue a cert for each tenant host with `/admin/cert` (onboarding does this) and point the tenant's connectors at it.

**Notes:**

- With no SNI, the relay can't tell which tenant a message is for. It uses
  `RELAY_DEFAULT_HOST`, which has no signature, so mail is delivered unsigned.
  Exchange Online sends SNI for smart-host connectors.
- Null-sender messages (`MAIL FROM:<>`) go to the last MX that worked for that
  tenant. If there isn't one yet, the relay returns `451`.
- Any downstream failure becomes `451`, so Exchange queues and retries. This
  includes a `5xx` from EOP, which is often a connector or certificate
  misconfiguration that gets fixed while the mail waits.
