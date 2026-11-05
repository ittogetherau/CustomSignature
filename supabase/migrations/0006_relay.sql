-- Server-side signatures for Microsoft 365 (Exclaimer-style). Exchange routes outgoing
-- mail through the Inkwell SMTP relay, which asks /api/relay/signature for each sender.

-- Relay connection details (e.g. { "host": "<tenant>.mail.protection.outlook.com", ... }).
-- Written only by the server (service role). Members can read it, so never store secrets here.
alter table public.organizations add column if not exists relay jsonb;

-- Who gets server-side signatures. Admins edit this from the app.
--   mode: 'test' (only testEmails) | 'departments' (only listed departments) | 'all'
alter table public.organizations add column if not exists relay_scope jsonb not null
  default '{"mode":"test","departments":[],"paused":false,"testEmails":[]}'::jsonb;

-- Same pattern as 0002: clients may update only these columns (RLS still limits updates to admins).
-- relay stays server-only, like ms_tenant_id.
revoke update on public.organizations from authenticated, anon;
grant update (name, brand, relay_scope) on public.organizations to authenticated;

-- The signature lookup finds the workspace by relay host on every outgoing message.
create index if not exists organizations_relay_host_idx on public.organizations ((relay->>'host'));

-- What the relay did with each message (signature applied, skipped, failed). Kept 30 days
-- (pruned by the daily cron in api/cron/sync-microsoft.ts).
create table if not exists public.relay_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  sender text not null,
  client text,
  status text not null,
  ms integer,
  created_at timestamptz not null default now()
);
create index if not exists relay_events_org_time_idx on public.relay_events(org_id, created_at desc);

alter table public.relay_events enable row level security;

create policy "admins read relay events" on public.relay_events for select using (public.is_admin(org_id));
-- No insert/update/delete policies: only the server (service role) writes relay events.
