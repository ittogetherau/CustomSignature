-- Track automatic Microsoft 365 directory sync per workspace.
alter table public.organizations add column if not exists ms_synced_at timestamptz;
alter table public.organizations add column if not exists ms_sync_status text;

-- Only the server (service role) may link a tenant: a browser-set ms_tenant_id would let a
-- workspace pull another company's directory. Clients may update name and brand only.
revoke update on public.organizations from authenticated, anon;
grant update (name, brand) on public.organizations to authenticated;
