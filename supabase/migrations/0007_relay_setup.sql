-- Short-lived Microsoft admin grant used while Inkwell configures a tenant's mail routing.
-- The refresh token is AES-GCM encrypted by the server (key derived from RELAY_SECRET) and the
-- row is deleted as soon as setup or removal finishes (expires after 2 hours regardless).
-- Server-only: RLS on with no policies, so only the service role can touch it.
create table if not exists public.relay_setup (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  purpose text not null check (purpose in ('setup', 'remove')),
  tenant text not null,
  upn text not null,
  refresh_token text not null,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.relay_setup enable row level security;
revoke all on public.relay_setup from anon, authenticated;
