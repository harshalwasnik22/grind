-- ===========================================================================
-- 0001_init.sql — profiles, groups, membership, core helper functions & RLS
-- ===========================================================================
-- Note: `auth.users` and `auth.uid()` are provided by Supabase. Locally, the
-- PGlite verify harness stubs them (see scripts/verify-schema.mjs).

-- Keep updated_at fresh on row updates.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 6-char uppercase, unambiguous invite code (no I/L/O/0/1).
create or replace function public.gen_invite_code()
returns text language sql volatile as $$
  select string_agg(
           substr(chars, (floor(random() * char_length(chars))::int + 1), 1),
           ''
         )
  from (select 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'::text as chars) c,
       generate_series(1, 6);
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  username       text unique,
  display_name   text,
  avatar_url     text,
  timezone       text not null default 'UTC',
  total_xp       int  not null default 0,
  current_level  int  not null default 1,
  prestige_level int  not null default 0,
  streak_freezes int  not null default 0,
  equipped_title text,
  current_streak int  not null default 0,
  longest_streak int  not null default 0,
  last_active_date date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- groups + membership
-- ---------------------------------------------------------------------------
create table public.groups (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  invite_code      text unique not null,
  owner_id         uuid references public.profiles(id) on delete set null,
  active_season_id uuid,
  created_at       timestamptz not null default now()
);

create table public.group_members (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index group_members_user_idx on public.group_members(user_id);
create index group_members_group_idx on public.group_members(group_id);

-- ---------------------------------------------------------------------------
-- Membership helper functions. SECURITY DEFINER so RLS policies can call them
-- without recursively triggering group_members RLS.
-- ---------------------------------------------------------------------------
create or replace function public.is_group_member(gid uuid, uid uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = uid
  );
$$;

create or replace function public.shares_group_with(target uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select target = auth.uid()
      or exists (
           select 1
           from public.group_members gm_self
           join public.group_members gm_other
             on gm_self.group_id = gm_other.group_id
           where gm_self.user_id = auth.uid()
             and gm_other.user_id = target
         );
$$;

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- profiles: readable by group-mates (and self); writable only by self.
create policy profiles_select on public.profiles
  for select using (public.shares_group_with(id));
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- groups: readable by members; only the owner may update/delete.
create policy groups_select on public.groups
  for select using (public.is_group_member(id, auth.uid()));
create policy groups_update_owner on public.groups
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy groups_delete_owner on public.groups
  for delete using (owner_id = auth.uid());

-- group_members: members can see the roster; a user may leave (delete self).
-- Inserts go through create_group / join_group_by_code (SECURITY DEFINER).
create policy group_members_select on public.group_members
  for select using (public.is_group_member(group_id, auth.uid()));
create policy group_members_delete_self on public.group_members
  for delete using (user_id = auth.uid());
