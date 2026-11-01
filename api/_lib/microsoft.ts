import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

// Server-only. Runs as Vercel functions with secrets that never reach the browser:
//   SUPABASE_SERVICE_ROLE_KEY, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, CRON_SECRET
// The directory is read with app-only (client credentials) Graph access, which a
// customer's Microsoft 365 admin grants once via the admin-consent link.

const GRAPH = 'https://graph.microsoft.com/v1.0'
const CONSUMER_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad'

export function env(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Server is missing ${name}`)
  return v
}

export function admin(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL ?? env('VITE_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const appUrl = (req?: Request) => process.env.APP_URL ?? (req ? new URL(req.url).origin : 'https://custom-signature-phi.vercel.app')

export function consentUrl(tenant: string, req: Request, state: string) {
  const p = new URLSearchParams({
    client_id: env('AZURE_CLIENT_ID'),
    scope: 'https://graph.microsoft.com/.default',
    redirect_uri: `${appUrl(req)}/microsoft/callback`,
    state,
  })
  return `https://login.microsoftonline.com/${tenant}/v2.0/adminconsent?${p}`
}

export class ConsentRequired extends Error {}

export async function appToken(tenant: string) {
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('AZURE_CLIENT_ID'),
      client_secret: env('AZURE_CLIENT_SECRET'),
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  })
  const body = (await res.json()) as { access_token?: string; error_description?: string }
  if (res.ok && body.access_token) return body.access_token
  // AADSTS700016 / 65001: the app has never been approved in this tenant.
  if (/AADSTS(700016|65001|500011)/.test(body.error_description ?? '')) throw new ConsentRequired()
  throw new Error(body.error_description?.split('\r\n')[0] ?? 'Microsoft token request failed')
}

/** The Microsoft tenant of the caller's linked work account, or null. */
export function tenantOf(user: User): string | null {
  for (const id of user.identities ?? []) {
    if (id.provider !== 'azure') continue
    const d = (id.identity_data ?? {}) as Record<string, unknown>
    const claims = (d.custom_claims ?? {}) as Record<string, unknown>
    const fromIss = typeof d.iss === 'string' ? d.iss.match(/microsoftonline\.com\/([0-9a-f-]{36})/i)?.[1] : undefined
    const tid = (claims.tid as string | undefined) ?? (d.tid as string | undefined) ?? fromIss
    if (tid && tid !== CONSUMER_TENANT) return tid
  }
  return null
}

/** Resolve the bearer token to a user and their role in the org. */
export async function authorize(req: Request, orgId: string) {
  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!jwt) return { error: 'Not signed in', status: 401 } as const
  const db = admin()
  const { data, error } = await db.auth.getUser(jwt)
  if (error || !data.user) return { error: 'Session expired — sign in again', status: 401 } as const
  const { data: m } = await db.from('memberships').select('role').eq('org_id', orgId).eq('user_id', data.user.id).maybeSingle()
  if (!m) return { error: 'You are not a member of this workspace', status: 403 } as const
  return { db, user: data.user, role: m.role as 'owner' | 'admin' | 'member' } as const
}

interface GraphUser {
  id: string
  displayName: string
  jobTitle: string | null
  department: string | null
  mail: string | null
  userPrincipalName: string
  businessPhones: string[]
  mobilePhone: string | null
  accountEnabled?: boolean
  userType?: string | null
  assignedLicenses?: unknown[]
}

class GraphDenied extends Error {}

async function graph<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url.startsWith('http') ? url : `${GRAPH}${url}`, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401 || res.status === 403) throw new GraphDenied()
  if (!res.ok) throw new Error(`Microsoft Graph ${res.status}`)
  return res.json() as Promise<T>
}

async function directory(token: string) {
  const select = 'id,displayName,jobTitle,department,mail,userPrincipalName,businessPhones,mobilePhone,accountEnabled,userType,assignedLicenses'
  let next: string | undefined = `/users?$select=${select}&$top=999`
  const out: GraphUser[] = []
  while (next) {
    const page: { value: GraphUser[]; '@odata.nextLink'?: string } = await graph(token, next)
    out.push(...page.value)
    next = page['@odata.nextLink']
  }
  // Real, licensed mailboxes only: no disabled accounts, guests, external identities or shared/room mailboxes.
  return out.filter(
    (u) => u.accountEnabled !== false && u.userType !== 'Guest' && !u.userPrincipalName.includes('#EXT#') && (u.mail || u.userPrincipalName) && (u.assignedLicenses?.length ?? 1) > 0,
  )
}

export interface SyncResult { total: number; added: number; updated: number; left: number; photos: number }

/**
 * Mirror the tenant directory into employees for one org. Matches on email, keeps
 * each person's assigned template, flags people who left as "outdated".
 */
export async function syncOrg(db: SupabaseClient, orgId: string, tenant: string, deadline = Date.now() + 45_000): Promise<SyncResult> {
  const token = await appToken(tenant)

  let users: GraphUser[]
  try {
    users = await directory(token)
  } catch (e) {
    if (e instanceof GraphDenied) throw new ConsentRequired()
    throw e
  }

  const [{ data: org }, { data: existing }] = await Promise.all([
    db.from('organizations').select('brand').eq('id', orgId).single(),
    db.from('employees').select('id,email,photo,template_id,source,status').eq('org_id', orgId),
  ])
  const defaultTemplate = (org?.brand as { defaultTemplateId?: string } | null)?.defaultTemplateId ?? 'aurora'
  const byEmail = new Map((existing ?? []).map((e) => [String(e.email).toLowerCase(), e]))

  const rows = users.map((u) => {
    const email = (u.mail || u.userPrincipalName).toLowerCase()
    const prev = byEmail.get(email)
    return {
      org_id: orgId,
      email,
      full_name: u.displayName,
      title: u.jobTitle ?? '',
      department: u.department ?? '',
      phone: u.businessPhones?.[0] || u.mobilePhone || '',
      photo: prev?.photo ?? '',
      template_id: prev?.template_id ?? defaultTemplate,
      status: 'active',
      source: 'microsoft',
      external_id: u.id,
    }
  })

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('employees').upsert(rows.slice(i, i + 500), { onConflict: 'org_id,email' })
    if (error) throw new Error(error.message)
  }

  const current = new Set(rows.map((r) => r.email))
  const leavers = (existing ?? []).filter((e) => e.source === 'microsoft' && e.status !== 'outdated' && !current.has(String(e.email).toLowerCase())).map((e) => e.id)
  if (leavers.length) await db.from('employees').update({ status: 'outdated' }).in('id', leavers)

  // Photos are the slow part, so they fill in over successive syncs within the time budget.
  let photos = 0
  const needPhoto = rows.filter((r) => !r.photo)
  for (const r of needPhoto) {
    if (Date.now() > deadline) break
    const res = await fetch(`${GRAPH}/users/${r.external_id}/photos/240x240/$value`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) continue
    const blob = await res.blob()
    const path = `${orgId}/ms-${r.external_id}.jpg`
    const up = await db.storage.from('assets').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true, cacheControl: '86400' })
    if (up.error) continue
    const url = db.storage.from('assets').getPublicUrl(path).data.publicUrl
    await db.from('employees').update({ photo: url }).eq('org_id', orgId).eq('email', r.email)
    photos++
  }

  const result = {
    total: rows.length,
    added: rows.filter((r) => !byEmail.has(r.email)).length,
    updated: rows.filter((r) => byEmail.has(r.email)).length,
    left: leavers.length,
    photos,
  }
  await db.from('organizations').update({ ms_tenant_id: tenant, ms_synced_at: new Date().toISOString(), ms_sync_status: 'ok' }).eq('id', orgId)
  return result
}

export const json = (body: unknown, status = 200) => Response.json(body, { status })
