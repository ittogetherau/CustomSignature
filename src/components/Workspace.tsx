import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../auth'
import { supabase } from '../lib/supabase'
import { StoreProvider } from '../store'
import type { BrandKit, Organization, Role } from '../types'
import Home from '../marketing/Home'
import { MarketingLayout } from '../marketing/kit'

type Membership = { role: Role; org: Organization & { brand: BrandKit } }

export function Splash({ label = 'Loading your workspace…' }: { label?: string }) {
  return (
    <div className="grid h-screen place-items-center">
      <div className="flex items-center gap-3 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> {label}</div>
    </div>
  )
}

/** Gate for every in-app route: requires a session and an organization. */
export default function RequireWorkspace() {
  const { user, loading } = useAuth()
  const loc = useLocation()
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)

  useEffect(() => {
    if (!user) return
    let live = true
    // Claim any pending invitations for this email before looking up the workspace.
    supabase.rpc('accept_invitations').then(() =>
    supabase
      .from('memberships')
      .select('role, organizations(id, name, brand, ms_tenant_id, ms_synced_at, ms_sync_status)')
      .eq('user_id', user.id)
      .order('created_at')
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!live) return
        if (error || !data?.organizations) return setMembership(null)
        const o = data.organizations as unknown as { id: string; name: string; brand: BrandKit; ms_tenant_id: string | null; ms_synced_at: string | null; ms_sync_status: string | null }
        setMembership({ role: data.role as Role, org: { id: o.id, name: o.name, brand: o.brand, msTenantId: o.ms_tenant_id, msSyncedAt: o.ms_synced_at ? Date.parse(o.ms_synced_at) : null, msSyncStatus: o.ms_sync_status } })
      }))
    return () => { live = false }
  }, [user])

  if (loading) return <Splash label="Loading…" />
  if (!user) return loc.pathname === '/' ? <MarketingLayout><Home /></MarketingLayout> : <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  if (membership === undefined) return <Splash />
  if (membership === null) return <Navigate to="/onboarding" replace />

  return (
    <StoreProvider key={membership.org.id} org={membership.org} role={membership.role} userId={user.id}>
      <Outlet />
    </StoreProvider>
  )
}
