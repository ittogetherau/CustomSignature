import { ConsentRequired, authorize, consentUrl, json, syncOrg, tenantOf } from '../_lib/microsoft.js'

export const maxDuration = 60

/**
 * POST { orgId } — connect (or re-sync) the caller's Microsoft 365 directory.
 *  - synced:            directory imported, returns counts
 *  - consent_required:  the tenant hasn't approved Inkwell yet; returns the admin-consent link
 *  - link_required:     the caller has no Microsoft work account linked to their login
 */
export async function POST(req: Request) {
  let orgId: string | undefined
  try {
    orgId = ((await req.json()) as { orgId?: string }).orgId
  } catch { /* handled below */ }
  if (!orgId) return json({ error: 'orgId is required' }, 400)

  const auth = await authorize(req, orgId)
  if ('error' in auth) return json({ error: auth.error }, auth.status)
  const { db, user, role } = auth

  const { data: org } = await db.from('organizations').select('ms_tenant_id').eq('id', orgId).single()
  // Linking a tenant to a workspace is an admin action; once linked, any member may re-sync it.
  const tenant = org?.ms_tenant_id ?? tenantOf(user)
  if (!tenant) return json({ status: 'link_required' })
  if (!org?.ms_tenant_id && role === 'member') return json({ error: 'Ask a workspace admin to connect Microsoft 365' }, 403)
  // A workspace can only be linked to the tenant the caller actually signed in from.
  if (!org?.ms_tenant_id && tenantOf(user) !== tenant) return json({ status: 'link_required' })

  try {
    const result = await syncOrg(db, orgId, tenant)
    return json({ status: 'synced', tenant, ...result })
  } catch (e) {
    if (e instanceof ConsentRequired) return json({ status: 'consent_required', consentUrl: consentUrl(tenant, req, orgId) })
    await db.from('organizations').update({ ms_sync_status: (e as Error).message.slice(0, 200) }).eq('id', orgId)
    return json({ error: (e as Error).message }, 502)
  }
}
