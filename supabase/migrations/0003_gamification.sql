-- ===========================================================================
-- 0003_gamification.sql — seasons, wagers, badges, titles + RLS
-- ===========================================================================

create table public.seasons (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  name       text not null,
  starts_on  date not null,
  ends_on    date not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index seasons_group_idx on public.seasons(group_id);

create table public.season_scores (
  id        uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  score     int not null default 0,
  rank      int,
  unique (season_id, user_id)
);

create table public.wagers (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  season_id  uuid references public.seasons(id) on delete set null,
  stake      text not null,
  status     text not null default 'open' check (status in ('open', 'settled')),
  loser_id   uuid references public.profiles(id) on delete set null,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

-- Badge catalog + awards.
create table public.badges (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  description text,
  icon        text,
  criteria    jsonb not null default '{}'::jsonb,
  xp_reward   int not null default 0
);

create table public.user_badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  badge_id   uuid not null references public.badges(id) on delete cascade,
  group_id   uuid references public.groups(id) on delete set null,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

-- Title catalog + unlocks.
create table public.titles (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  description text,
  unlock_rule jsonb not null default '{}'::jsonb
);

create table public.user_titles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title_id    uuid not null references public.titles(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (user_id, title_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.seasons enable row level security;
alter table public.season_scores enable row level security;
alter table public.wagers enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.titles enable row level security;
alter table public.user_titles enable row level security;

create policy seasons_select on public.seasons
  for select using (public.is_group_member(group_id, auth.uid()));

create policy season_scores_select on public.season_scores
  for select using (
    exists (
      select 1 from public.seasons s
      where s.id = season_id
        and public.is_group_member(s.group_id, auth.uid())
    )
  );

create policy wagers_select on public.wagers
  for select using (public.is_group_member(group_id, auth.uid()));
create policy wagers_insert_owner on public.wagers
  for insert with check (
    exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );
create policy wagers_update_owner on public.wagers
  for update using (
    exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  );

-- Public catalogs.
create policy badges_select on public.badges
  for select using (auth.uid() is not null);
create policy titles_select on public.titles
  for select using (auth.uid() is not null);

-- Awards/unlocks visible to group-mates.
create policy user_badges_select on public.user_badges
  for select using (public.shares_group_with(user_id));
create policy user_titles_select on public.user_titles
  for select using (public.shares_group_with(user_id));
