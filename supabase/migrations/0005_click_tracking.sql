-- Link-click analytics. Signature links are rewritten to /r/<code>; the redirect
-- function (service role) looks the code up, records the click, and forwards.
-- No IP addresses are stored — only coarse location from the edge network.

create table if not exists public.links (
  code text primary key check (char_length(code) between 6 and 32),
  org_id uuid not null references public.organizations(id) on delete cascade,
  person_type text not null check (person_type in ('sig', 'emp')),
  person_id uuid not null,
  kind text not null default 'link',
  url text not null check (url ~* '^https?://'),
  created_at timestamptz not null default now()
);
create index if not exists links_org_idx on public.links(org_id);

create table if not exists public.clicks (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  link_code text not null references public.links(code) on delete cascade,
  person_type text not null,
  person_id uuid not null,
  kind text not null,
  url text not null,
  country text,
  region text,
  city text,
  device text,
  client text,
  is_bot boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists clicks_org_time_idx on public.clicks(org_id, created_at desc);
create index if not exists clicks_person_idx on public.clicks(person_id, created_at desc);

alter table public.links enable row level security;
alter table public.clicks enable row level security;

-- Members register links for their workspace when a signature is copied, sent or exported.
create policy "members read links" on public.links for select using (public.is_member(org_id));
create policy "members add links" on public.links for insert with check (public.is_member(org_id));

-- Admins see every click in the workspace; members see clicks on signatures they own.
create policy "admins read clicks" on public.clicks for select using (public.is_admin(org_id));
create policy "owners read own signature clicks" on public.clicks for select using (
  person_type = 'sig' and exists (select 1 from public.signatures s where s.id = person_id and s.owner_id = auth.uid())
);
-- No insert/update/delete policies: only the server (service role) writes clicks.
