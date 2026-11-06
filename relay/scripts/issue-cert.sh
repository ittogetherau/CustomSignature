#!/usr/bin/env bash
# Ask the relay to issue (or re-issue) the TLS certificate for one tenant host.
# Usage: RELAY_SECRET=... relay/scripts/issue-cert.sh abc123.relay.ittogether.com.au
set -euo pipefail
HOST="${1:?host required}"
RELAY="${RELAY_ADMIN_URL:-https://inkwell-relay.fly.dev}"
BODY="{\"host\":\"$HOST\"}"
TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$RELAY_SECRET" -hex | sed 's/^.* //')
curl -sS --max-time 240 -X POST "$RELAY/admin/cert" \
  -H "X-Inkwell-Timestamp: $TS" -H "X-Inkwell-Signature: sha256=$SIG" \
  -H 'content-type: application/json' -d "$BODY"
echo
