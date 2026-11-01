-- Inkwell schema: multi-tenant by organization, enforced with row-level security.
-- Run once in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ---------- tables ----------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand jsonb not null default '{}'::jsonb,       -- BrandKit (logo, colours, socials, disclaimer…)
  ms_tenant_id text,                              -- Microsoft Entra tenant linked by the last directory sync
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);

create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  label text not null default 'Untitled signature',
  template_id text not null,
  data jsonb not null,                            -- { fields, socials, design, extras }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index signatures_org_idx on public.signatures(org_id);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  title text not null default '',
  department text not null default '',
  email text not null,
  phone text not null default '',
  photo text not null default '',
  template_id text,
  status text not null default 'active' check (status in ('active', 'invited', 'outdated')),
  source text not null default 'manual' check (source in ('manual', 'csv', 'microsoft')),
  external_id text,                               -- Microsoft Graph user id
  updated_at timestamptz not null default now(),
  unique (org_id, email)
);
create index employees_org_idx on public.employees(org_id);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null,                            -- Campaign minus id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_org_idx on public.campaigns(org_id);

-- ---------- helpers ----------

create or replace function public.is_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where org_id = org and user_id = auth.uid());
$$;

create or replace function public.is_owner(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where org_id = org and user_id = auth.uid() and role = 'owner');
$$;

create or replace function public.is_admin(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where org_id = org and user_id = auth.uid() and role in ('owner', 'admin'));
$$;

-- Creating an org and its owner membership must be atomic, and RLS would
-- otherwise block the first membership insert.
create or replace function public.create_organization(org_name text, org_brand jsonb default '{}'::jsonb)
returns public.organizations language plpgsql security definer set search_path = public as $$
declare
  org organizations;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into organizations (name, brand, created_by) values (org_name, org_brand, auth.uid()) returning * into org;
  insert into memberships (org_id, user_id, role) values (org.id, auth.uid(), 'owner');
  return org;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger signatures_touch before update on public.signatures for each row execute function public.touch_updated_at();
create trigger employees_touch before update on public.employees for each row execute function public.touch_updated_at();
create trigger campaigns_touch before update on public.campaigns for each row execute function public.touch_updated_at();

-- ---------- row-level security ----------

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.signatures enable row level security;
alter table public.employees enable row level security;
alter table public.campaigns enable row level security;

create policy "members read org" on public.organizations for select using (public.is_member(id));
create policy "admins update org" on public.organizations for update using (public.is_admin(id)) with check (public.is_admin(id));
create policy "owners delete org" on public.organizations for delete using (public.is_owner(id));

create policy "members read memberships" on public.memberships for select using (public.is_member(org_id));
-- Admins manage members, but only owners can create, change or remove owners.
-- Anyone may remove their own membership (leave the workspace).
create policy "admins add members" on public.memberships for insert
  with check (public.is_admin(org_id) and (role <> 'owner' or public.is_owner(org_id)));
create policy "admins change members" on public.memberships for update
  using (public.is_admin(org_id) and (role <> 'owner' or public.is_owner(org_id)))
  with check (public.is_admin(org_id) and (role <> 'owner' or public.is_owner(org_id)));
create policy "remove members or leave" on public.memberships for delete
  using (user_id = auth.uid() or (public.is_admin(org_id) and (role <> 'owner' or public.is_owner(org_id))));

create policy "members manage signatures" on public.signatures for all using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy "members manage employees" on public.employees for all using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy "members manage campaigns" on public.campaigns for all using (public.is_member(org_id)) with check (public.is_member(org_id));

-- ---------- storage: public-read images, writable by org members ----------
-- Signature images must be publicly fetchable by mail clients, so the bucket is public-read.
-- Objects live under "<org_id>/...".

insert into storage.buckets (id, name, public) values ('assets', 'assets', true)
on conflict (id) do nothing;

create policy "members upload assets" on storage.objects for insert to authenticated
  with check (bucket_id = 'assets' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "members update assets" on storage.objects for update to authenticated
  using (bucket_id = 'assets' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "members delete assets" on storage.objects for delete to authenticated
  using (bucket_id = 'assets' and public.is_member(((storage.foldername(name))[1])::uuid));

-- ---------- invitations ----------
-- Admins invite colleagues by email; the invitee signs up (password or Microsoft)
-- with that address and accept_invitations() moves them into the workspace.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

alter table public.invitations enable row level security;

create policy "admins manage invitations" on public.invitations for all
  using (public.is_admin(org_id)) with check (public.is_admin(org_id));
create policy "invitee reads own invitations" on public.invitations for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

create or replace function public.accept_invitations()
returns integer language plpgsql security definer set search_path = public as $$
declare
  me text := lower(auth.jwt() ->> 'email');
  n integer;
begin
  if auth.uid() is null or me is null then
    return 0;
  end if;
  insert into memberships (org_id, user_id, role)
    select org_id, auth.uid(), role from invitations where lower(email) = me
  on conflict (org_id, user_id) do nothing;
  get diagnostics n = row_count;
  delete from invitations where lower(email) = me;
  return n;
end;
$$;

-- Member list with emails for the settings page (auth.users isn't readable from the client).
create or replace function public.workspace_members(org uuid)
returns table (user_id uuid, email text, full_name text, role text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), m.role, m.created_at
  from memberships m join auth.users u on u.id = m.user_id
  where m.org_id = org and public.is_member(org)
  order by m.created_at;
$$;
