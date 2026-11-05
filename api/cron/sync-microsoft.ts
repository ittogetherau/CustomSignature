import { ConsentRequired, admin, env, json, syncOrg } from '../_lib/microsoft.js'

export const maxDuration = 60

/** Daily job (vercel.json → crons): re-sync every workspace linked to a Microsoft tenant, prune old relay events. */
export async function GET(req: Request) {
  try {
    return await handle(req)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
}

async function handle(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${env('CRON_SECRET')}`) return json({ error: 'Unauthorized' }, 401)

  const db = admin()

  // Relay activity is kept for 30 days. A failure here must not stop the directory sync.
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const pruned = await db.from('relay_events').delete().lt('created_at', cutoff)
  const relayEventsPruned = pruned.error ? `error: ${pruned.error.message}` : 'ok'

  // Least recently synced first, so a run that hits the time limit picks up where the last one stopped.
  const { data: orgs, error } = await db
    .from('organizations')
    .select('id, ms_tenant_id')
    .not('ms_tenant_id', 'is', null)
    .order('ms_synced_at', { ascending: true, nullsFirst: true })
  if (error) return json({ error: error.message }, 500)

  const started = Date.now()
  const results: Record<string, unknown> = {}
  for (const org of orgs ?? []) {
    if (Date.now() - started > 50_000) break
    try {
      results[org.id] = await syncOrg(db, org.id, org.ms_tenant_id as string, Math.min(started + 55_000, Date.now() + 20_000))
    } catch (e) {
      const status = e instanceof ConsentRequired ? 'consent_revoked' : (e as Error).message.slice(0, 200)
      await db.from('organizations').update({ ms_sync_status: status }).eq('id', org.id)
      results[org.id] = { error: status }
    }
  }
  return json({ synced: Object.keys(results).length, results, relayEventsPruned })
}
