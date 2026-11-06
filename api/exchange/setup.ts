import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { appUrl, authorize, env, json } from '../_lib/microsoft.js'
import { signHeaders } from '../_lib/relay.js'
import { ExchangeError, NAMES, SIGNED_HEADER, find, invoke } from '../_lib/exchange.js'
import { deleteRecords, ensureRecord, relName } from '../_lib/vercelDns.js'

export const maxDuration = 300

/**
 * Server-side signature onboarding: the customer's Microsoft 365 admin signs in once, then this
 * function configures their tenant step by step. Every step is idempotent and resumable, so the
 * page simply calls `step` until the status is `active` (or `removed`).
 *
 * POST { orgId, action: 'start', purpose?: 'setup'|'remove' } → { url }  (Microsoft sign-in)
 * POST { orgId, action: 'callback', code, state }                 → { ok }   (store the admin grant)
 * POST { orgId, action: 'step' }                                  → { relay } (run what's next)
 *
 * The admin grant (a refresh token) is kept encrypted only until the run finishes, then deleted.
 * Inkwell keeps no standing Exchange admin access.
 */

// Exchange: request the app's configured delegated permissions (Exchange.Manage) via .default, exactly as
// the Exchange Online PowerShell module does. A named scope like outlook.office365.com/Exchange.Manage gets
// remapped to Microsoft Graph by Entra (AADSTS650053). .default here also consents Graph Domain.ReadWrite.All,
// which is likewise configured on the app, in the same admin consent screen.
const EXO = 'https://outlook.office365.com/.default'
const GRAPH = 'https://graph.microsoft.com/Domain.ReadWrite.All'
const GRAPH_API = 'https://graph.microsoft.com/v1.0'
const RELAY_DOMAIN = () => process.env.RELAY_DOMAIN ?? 'relay.ittogether.com.au'
const RELAY_ADMIN = () => process.env.RELAY_ADMIN_URL ?? 'https://inkwell-relay.fly.dev'

type Purpose = 'setup' | 'remove'
type StepState = 'pending' | 'running' | 'done' | 'waiting' | 'error'
export interface RelayInfo {
  host?: string
  code?: string
  status: 'not_setup' | 'setting_up' | 'active' | 'removing' | 'removed' | 'error'
  purpose?: Purpose
  steps: Record<string, { state: StepState; detail?: string; at?: string }>
  warnings?: string[]
  adminUpn?: string
  activeAt?: string
}

export const SETUP_STEPS = ['host', 'domain', 'verify', 'accepted', 'cert', 'inbound', 'outbound', 'rule'] as const
export const REMOVE_STEPS = ['rule', 'outbound', 'inbound', 'domain', 'dns'] as const

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { orgId?: string; action?: string; purpose?: Purpose; code?: string; state?: string }
    if (!body.orgId) return json({ error: 'orgId is required' }, 400)
    const auth = await authorize(req, body.orgId)
    if ('error' in auth) return json({ error: auth.error }, auth.status)
    if (auth.role === 'member') return json({ error: 'Only workspace admins can change mail routing' }, 403)
    const { db, user } = auth
    const { data: org } = await db.from('organizations').select('id, ms_tenant_id, relay, relay_scope').eq('id', body.orgId).single()
    if (!org?.ms_tenant_id) return json({ error: 'Connect Microsoft 365 first (Team → Connect Microsoft 365).' }, 409)
    const tenant = org.ms_tenant_id as string

    if (body.action === 'start') {
      const purpose: Purpose = body.purpose === 'remove' ? 'remove' : 'setup'
      const state = signState({ o: org.id, u: user.id, p: purpose, exp: Date.now() + 20 * 60_000 })
      const p = new URLSearchParams({
        client_id: env('AZURE_CLIENT_ID'),
        response_type: 'code',
        response_mode: 'query',
        redirect_uri: redirectUri(req),
        scope: `openid profile offline_access ${EXO}`,
        state,
        prompt: 'select_account',
      })
      return json({ url: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${p}` })
    }

    if (body.action === 'callback') {
      const st = readState(body.state)
      if (!st || st.o !== org.id || st.u !== user.id) return json({ error: 'This sign-in link has expired. Start again from Mail routing.' }, 400)
      if (!body.code) return json({ error: 'Microsoft did not return a sign-in code' }, 400)
      const tok = await tokenRequest(tenant, { grant_type: 'authorization_code', code: body.code, redirect_uri: redirectUri(req), scope: `openid profile offline_access ${EXO}` })
      const claims = decodeJwt(tok.id_token)
      if (claims.tid && claims.tid !== tenant) return json({ error: 'That Microsoft account belongs to a different organisation than the one connected to this workspace.' }, 400)
      const upn = String(claims.preferred_username ?? claims.upn ?? '')
      await db.from('relay_setup').upsert({
        org_id: org.id, purpose: st.p, tenant, upn, refresh_token: encrypt(tok.refresh_token ?? ''),
        created_by: user.id, expires_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
      })
      const prev = (org.relay as RelayInfo | null) ?? { status: 'not_setup', steps: {} }
      const steps = Object.fromEntries((st.p === 'remove' ? REMOVE_STEPS : SETUP_STEPS).map((s) => [s, { state: 'pending' as StepState }]))
      const relay: RelayInfo = { ...prev, status: st.p === 'remove' ? 'removing' : 'setting_up', purpose: st.p, steps, warnings: [], adminUpn: upn }
      await saveRelay(db, org.id, relay)
      return json({ ok: true, relay })
    }

    if (body.action === 'step') {
      const { data: grant } = await db.from('relay_setup').select('*').eq('org_id', org.id).maybeSingle()
      const relay = (org.relay as RelayInfo | null) ?? { status: 'not_setup', steps: {} }
      if (!grant || Date.parse(grant.expires_at) < Date.now()) {
        if (relay.status === 'setting_up' || relay.status === 'removing') {
          relay.status = 'error'
          relay.warnings = [...(relay.warnings ?? []), 'The Microsoft admin sign-in expired before setup finished. Sign in again to continue — finished steps are kept.']
          await saveRelay(db, org.id, relay)
        }
        return json({ relay })
      }
      const run = new Run(db, org.id, tenant, grant.upn, decrypt(grant.refresh_token), relay, user.email ?? '')
      await run.go(grant.purpose as Purpose, Date.now() + 240_000)
      return json({ relay: run.relay })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
}

const redirectUri = (req: Request) => `${appUrl(req)}/exchange/callback`

// ---------------------------------------------------------------- the runner

class Waiting extends Error {}

class Run {
  private tokens = new Map<string, string>()
  constructor(
    private db: SupabaseClient, private orgId: string, private tenant: string, private upn: string,
    private refresh: string, public relay: RelayInfo, private inkwellEmail: string,
  ) {}

  async go(purpose: Purpose, deadline: number) {
    const order = purpose === 'remove' ? REMOVE_STEPS : SETUP_STEPS
    this.relay.status = purpose === 'remove' ? 'removing' : 'setting_up'
    for (const id of order) {
      const s = (this.relay.steps[id] ??= { state: 'pending' })
      if (s.state === 'done') continue
      if (Date.now() > deadline) return this.save()
      s.state = 'running'
      s.detail = undefined
      await this.save()
      try {
        s.detail = (await (purpose === 'remove' ? this.remove(id) : this.setup(id))) || undefined
        s.state = 'done'
        s.at = new Date().toISOString()
      } catch (e) {
        s.state = e instanceof Waiting ? 'waiting' : 'error'
        s.detail = (e as Error).message
        if (s.state === 'error') this.relay.status = 'error'
        return this.save()
      }
      await this.save()
    }
    // Finished: forget the admin grant.
    await this.db.from('relay_setup').delete().eq('org_id', this.orgId)
    if (purpose === 'remove') {
      this.relay = { status: 'removed', steps: {}, warnings: [] }
    } else {
      this.relay.status = 'active'
      this.relay.activeAt = new Date().toISOString()
      await this.seedTestUsers()
    }
    await this.save()
  }

  private save() { return saveRelay(this.db, this.orgId, this.relay) }

  private get host() {
    if (!this.relay.host) throw new Error('Relay address missing — start setup again')
    return this.relay.host
  }

  private async setup(id: string): Promise<string | void> {
    switch (id) {
      case 'host': {
        if (!this.relay.host) {
          this.relay.code = randomBytes(5).toString('hex')
          this.relay.host = `${this.relay.code}.${RELAY_DOMAIN()}`
        }
        return this.relay.host
      }
      case 'domain': {
        const token = await this.token(GRAPH)
        const existing = await graph(token, `/domains/${this.host}`).catch((e) => (e.status === 404 ? null : Promise.reject(e)))
        if (!existing) await graph(token, '/domains', { method: 'POST', body: JSON.stringify({ id: this.host }) })
        const d = existing ?? (await graph(token, `/domains/${this.host}`))
        if (d.isVerified) return 'Already verified'
        const recs = (await graph(token, `/domains/${this.host}/verificationDnsRecords`)).value as { recordType: string; text?: string }[]
        const txt = recs.find((r) => r.recordType?.toLowerCase() === 'txt')?.text
        if (!txt) throw new Error('Microsoft returned no TXT verification record')
        await ensureRecord(relName(this.host), 'TXT', txt)
        return `Added ${this.host} and published ${txt}`
      }
      case 'verify': {
        const token = await this.token(GRAPH)
        const d = await graph(token, `/domains/${this.host}`)
        if (d.isVerified) return 'Verified'
        const r = await graph(token, `/domains/${this.host}/verify`, { method: 'POST' }).catch((e) => ({ error: e }))
        if ('isVerified' in r && r.isVerified) return 'Verified'
        throw new Waiting('Waiting for Microsoft to see the DNS record (usually 1–5 minutes)…')
      }
      case 'accepted': {
        const d = await this.exo('Get-AcceptedDomain').then((all) => all.find((a) => String(a.DomainName ?? a.Name).toLowerCase() === this.host))
        if (!d) throw new Waiting('Waiting for Exchange to pick up the new domain (usually a few minutes)…')
        return 'Exchange accepts the relay domain'
      }
      case 'cert': {
        const body = JSON.stringify({ host: this.host })
        const res = await fetch(`${RELAY_ADMIN()}/admin/cert`, {
          method: 'POST', headers: { 'content-type': 'application/json', ...signHeaders(body) }, body, signal: AbortSignal.timeout(200_000),
        }).catch((e) => { throw new Waiting(`Relay not reachable yet (${(e as Error).message}) — retrying`) })
        const out = (await res.json().catch(() => ({}))) as { notAfter?: string; error?: string; detail?: string }
        if (!res.ok) throw new Error(`Certificate: ${out.detail ?? out.error ?? res.status}`)
        return out.notAfter ? `Valid until ${out.notAfter.slice(0, 10)}` : 'Issued'
      }
      case 'inbound': {
        const params = {
          ConnectorType: 'OnPremises', SenderDomains: ['*'], RequireTls: true, RestrictDomainsToCertificate: true,
          TlsSenderCertificateName: this.host, CloudServicesMailEnabled: true, Enabled: true,
          Comment: 'Inkwell server-side signatures: accepts signed mail back from the Inkwell relay. Created by Inkwell.',
        }
        const have = await find(await this.token(EXO), this.tenant, this.upn, 'Get-InboundConnector', NAMES.inbound)
        if (have) await this.exo('Set-InboundConnector', { Identity: NAMES.inbound, ...params })
        else await this.exo('New-InboundConnector', { Name: NAMES.inbound, ...params })
        return NAMES.inbound
      }
      case 'outbound': {
        const params = {
          ConnectorType: 'OnPremises', IsTransportRuleScoped: true, UseMXRecord: false, SmartHosts: [this.host],
          TlsSettings: 'DomainValidation', TlsDomain: this.host, CloudServicesMailEnabled: true, Enabled: true,
          Comment: 'Inkwell server-side signatures: only used by the Inkwell transport rule. Created by Inkwell.',
        }
        const all = await this.exo('Get-OutboundConnector')
        const others = all.filter((c) => c.Name !== NAMES.outbound && c.Enabled !== false && !c.IsTransportRuleScoped)
        if (others.length) this.warn(`Existing outbound connector(s) ${others.map((c) => `“${c.Name}”`).join(', ')} also route mail. If one sends to a gateway such as Mimecast, check with your IT provider that signed mail still flows through it.`)
        if (all.some((c) => c.Name === NAMES.outbound)) await this.exo('Set-OutboundConnector', { Identity: NAMES.outbound, ...params })
        else await this.exo('New-OutboundConnector', { Name: NAMES.outbound, ...params })
        return NAMES.outbound
      }
      case 'rule': {
        const params = {
          FromScope: 'InOrganization', RouteMessageOutboundConnector: NAMES.outbound,
          ExceptIfHeaderContainsMessageHeader: SIGNED_HEADER, ExceptIfHeaderContainsWords: ['1'],
          StopRuleProcessing: true, Mode: 'Enforce',
          Comments: 'Sends outgoing mail through Inkwell to add email signatures on every device. Created by Inkwell — pause or remove it from Inkwell.',
        }
        const have = await find(await this.token(EXO), this.tenant, this.upn, 'Get-TransportRule', NAMES.rule)
        if (have) await this.exo('Set-TransportRule', { Identity: NAMES.rule, ...params })
        else await this.exo('New-TransportRule', { Name: NAMES.rule, Priority: 0, ...params })
        return NAMES.rule
      }
    }
  }

  private async remove(id: string): Promise<string | void> {
    const gone = (e: unknown) => e instanceof ExchangeError && /couldn't be found|not found|doesn't exist/i.test(e.message)
    const del = (cmdlet: string, name: string) => this.exo(cmdlet, { Identity: name, Confirm: false }).then(() => `Removed ${name}`, (e) => (gone(e) ? 'Already gone' : Promise.reject(e)))
    switch (id) {
      // Rule first, so no mail is routed to a connector that's about to disappear.
      case 'rule': return del('Remove-TransportRule', NAMES.rule)
      case 'outbound': return del('Remove-OutboundConnector', NAMES.outbound)
      case 'inbound': return del('Remove-InboundConnector', NAMES.inbound)
      case 'domain': {
        if (!this.relay.host) return 'Nothing to remove'
        const token = await this.token(GRAPH)
        return graph(token, `/domains/${this.relay.host}`, { method: 'DELETE' }).then(() => `Removed ${this.relay.host}`, (e) => (e.status === 404 ? 'Already gone' : Promise.reject(e)))
      }
      case 'dns': {
        if (this.relay.host && process.env.VERCEL_TOKEN) await deleteRecords(relName(this.relay.host), 'TXT')
        return 'Cleaned up'
      }
    }
  }

  private warn(w: string) {
    this.relay.warnings = [...new Set([...(this.relay.warnings ?? []), w])]
  }

  private async exo(cmdlet: string, params: Record<string, unknown> = {}) {
    return invoke(await this.token(EXO), this.tenant, this.upn, cmdlet, params as never)
  }

  private async token(scope: string) {
    const hit = this.tokens.get(scope)
    if (hit) return hit
    const t = await tokenRequest(this.tenant, { grant_type: 'refresh_token', refresh_token: this.refresh, scope: `${scope} offline_access` })
    if (t.refresh_token && t.refresh_token !== this.refresh) {
      this.refresh = t.refresh_token
      await this.db.from('relay_setup').update({ refresh_token: encrypt(t.refresh_token) }).eq('org_id', this.orgId)
    }
    this.tokens.set(scope, t.access_token)
    return t.access_token
  }

  /** Test mode starts with the person who set it up (and the Microsoft admin) as the only signed senders. */
  private async seedTestUsers() {
    const { data } = await this.db.from('organizations').select('relay_scope').eq('id', this.orgId).single()
    const scope = (data?.relay_scope ?? {}) as { testEmails?: string[] }
    if (scope.testEmails?.length) return
    const emails = [...new Set([this.inkwellEmail, this.upn].map((e) => e.toLowerCase()).filter((e) => e.includes('@')))]
    await this.db.from('organizations').update({ relay_scope: { mode: 'test', departments: [], paused: false, ...scope, testEmails: emails } }).eq('id', this.orgId)
  }
}

async function saveRelay(db: SupabaseClient, orgId: string, relay: RelayInfo) {
  const { error } = await db.from('organizations').update({ relay }).eq('id', orgId)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------- Microsoft identity + Graph

async function tokenRequest(tenant: string, params: Record<string, string>) {
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('AZURE_CLIENT_ID'), client_secret: env('AZURE_CLIENT_SECRET'), ...params }),
  })
  const body = (await res.json()) as { access_token: string; refresh_token?: string; id_token?: string; error_description?: string }
  if (!res.ok) {
    const msg = body.error_description?.split(/\r?\n/)[0] ?? 'Microsoft sign-in failed'
    if (/AADSTS(50105|65001|90094)/.test(msg)) throw new Error('This needs a Global Administrator (or Exchange Administrator) to sign in and approve. ' + msg)
    throw new Error(msg)
  }
  return body
}

async function graph(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${GRAPH_API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  if (res.status === 204) return {}
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } }
  if (!res.ok) throw Object.assign(new Error(`Microsoft Graph: ${body.error?.message ?? res.status}`), { status: res.status })
  return body as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

const decodeJwt = (t?: string): Record<string, unknown> => {
  try { return JSON.parse(Buffer.from((t ?? '').split('.')[1], 'base64url').toString()) } catch { return {} }
}

// ---------------------------------------------------------------- state + at-rest encryption

const key = (purpose: string) => createHash('sha256').update(`inkwell:${purpose}:${env('RELAY_SECRET')}`).digest()

function signState(s: { o: string; u: string; p: Purpose; exp: number }) {
  const b = Buffer.from(JSON.stringify(s)).toString('base64url')
  return `${b}.${createHmac('sha256', key('state')).update(b).digest('base64url')}`
}

function readState(raw?: string): { o: string; u: string; p: Purpose; exp: number } | null {
  const [b, mac] = (raw ?? '').split('.')
  if (!b || !mac) return null
  const want = createHmac('sha256', key('state')).update(b).digest()
  const got = Buffer.from(mac, 'base64url')
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  const s = JSON.parse(Buffer.from(b, 'base64url').toString())
  return s.exp > Date.now() ? s : null
}

function encrypt(plain: string) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key('grant'), iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), enc].map((x) => x.toString('base64url')).join('.')
}

function decrypt(blob: string) {
  const [iv, tag, enc] = blob.split('.').map((x) => Buffer.from(x, 'base64url'))
  const d = createDecipheriv('aes-256-gcm', key('grant'), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
}
