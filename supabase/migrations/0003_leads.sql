-- Demo requests from the marketing site. Anyone may submit; nobody can read via the API
-- (view them in the Supabase dashboard or with the service role).
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  company text not null default '' check (char_length(company) <= 200),
  users text not null default '',
  platform text not null default '',
  message text not null default '' check (char_length(message) <= 4000),
  source text not null default 'contact',
  created_at timestamptz not null default now()
);
alter table public.leads enable row level security;
create policy "anyone can submit a lead" on public.leads for insert to anon, authenticated with check (true);
