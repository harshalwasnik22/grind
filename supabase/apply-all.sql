-- ===========================================================================
-- GRIND — combined migrations 0001–0008 (generated 2026-08-02).
-- Paste this whole file into the Supabase SQL Editor and Run once.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0001_init.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0002_habits.sql
-- ---------------------------------------------------------------------------
-- ===========================================================================
-- 0002_habits.sql — habit templates, habits, logs, daily scores, rest days
-- ===========================================================================

-- Catalog of starter habits cloned during onboarding.
create table public.habit_templates (
  id             uuid primary key default gen_random_uuid(),
  category       text not null,
  name           text not null unique,
  unit           text not null,
  default_target numeric not null,
  base_xp        int not null default 100,
  sort_order     int not null default 0
);

-- A user's customizable habit (belongs to them, scored within a group).
create table public.habits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  group_id     uuid references public.groups(id) on delete cascade,
  name         text not null,
  category     text not null default 'custom'
               check (category in ('dsa', 'system_design', 'gym', 'learning', 'custom')),
  unit         text not null default 'reps',
  daily_target numeric not null check (daily_target > 0),
  base_xp      int not null default 100,
  schedule     int[] not null default '{0,1,2,3,4,5,6}', -- 0=Sun .. 6=Sat
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  archived_at  timestamptz
);

create index habits_user_idx on public.habits(user_id);
create index habits_group_idx on public.habits(group_id);

-- One accumulating log row per habit per day.
create table public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  habit_id   uuid not null references public.habits(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  log_date   date not null,
  value      numeric not null default 0,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

create index habit_logs_user_date_idx on public.habit_logs(user_id, log_date);

create trigger habit_logs_set_updated_at
  before update on public.habit_logs
  for each row execute function public.set_updated_at();

-- Materialized per-user, per-day score (recomputed on each log).
create table public.daily_scores (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  group_id     uuid not null references public.groups(id) on delete cascade,
  date         date not null,
  xp_earned    int not null default 0,
  targets_hit  int not null default 0,
  habits_total int not null default 0,
  was_rest_day boolean not null default false,
  freeze_used  boolean not null default false,
  unique (user_id, group_id, date)
);

create index daily_scores_group_date_idx on public.daily_scores(group_id, date);

-- Planned off-days that don't break the streak.
create table public.rest_days (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date    date not null,
  unique (user_id, date)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.habit_templates enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.daily_scores enable row level security;
alter table public.rest_days enable row level security;

-- Public catalog for any signed-in user.
create policy habit_templates_select on public.habit_templates
  for select using (auth.uid() is not null);

-- habits: owner full control; group-mates can read for comparison.
create policy habits_select on public.habits
  for select using (
    user_id = auth.uid() or public.is_group_member(group_id, auth.uid())
  );
create policy habits_insert_own on public.habits
  for insert with check (user_id = auth.uid());
create policy habits_update_own on public.habits
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy habits_delete_own on public.habits
  for delete using (user_id = auth.uid());

-- habit_logs: group-mates can read; only the owner writes.
create policy habit_logs_select on public.habit_logs
  for select using (public.shares_group_with(user_id));
create policy habit_logs_insert_own on public.habit_logs
  for insert with check (user_id = auth.uid());
create policy habit_logs_update_own on public.habit_logs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy habit_logs_delete_own on public.habit_logs
  for delete using (user_id = auth.uid());

-- daily_scores: group-mates can read; only the owner writes.
create policy daily_scores_select on public.daily_scores
  for select using (
    user_id = auth.uid() or public.is_group_member(group_id, auth.uid())
  );
create policy daily_scores_insert_own on public.daily_scores
  for insert with check (user_id = auth.uid());
create policy daily_scores_update_own on public.daily_scores
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- rest_days: private to the owner.
create policy rest_days_all_own on public.rest_days
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 0003_gamification.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0004_notifications.sql
-- ---------------------------------------------------------------------------
-- ===========================================================================
-- 0004_notifications.sql — web push subscriptions + in-app notifications
-- ===========================================================================

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text unique not null,
  keys       jsonb not null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — both private to the owner. (Server inserts use the service role, which
-- bypasses RLS.)
-- ---------------------------------------------------------------------------
alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;

create policy push_subscriptions_all_own on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 0005_functions.sql
-- ---------------------------------------------------------------------------
-- ===========================================================================
-- 0005_functions.sql — group create/join RPCs (depend on groups + seasons)
-- ===========================================================================
-- SECURITY DEFINER so authenticated users can create/join without direct
-- INSERT privileges on groups / group_members / seasons.

create or replace function public.create_group(p_name text)
returns public.groups language plpgsql security definer
set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_code   text;
  v_group  public.groups;
  v_season uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Unique invite code.
  loop
    v_code := public.gen_invite_code();
    exit when not exists (select 1 from public.groups where invite_code = v_code);
  end loop;

  insert into public.groups (name, invite_code, owner_id)
  values (coalesce(nullif(trim(p_name), ''), 'My Squad'), v_code, v_uid)
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_uid, 'owner');

  -- Kick off the first weekly season (Mon-anchored length is 7 days).
  insert into public.seasons (group_id, name, starts_on, ends_on, is_active)
  values (v_group.id, 'Season 1', current_date, current_date + 6, true)
  returning id into v_season;

  update public.groups set active_season_id = v_season
  where id = v_group.id
  returning * into v_group;

  return v_group;
end;
$$;

create or replace function public.join_group_by_code(p_code text)
returns public.groups language plpgsql security definer
set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_group public.groups;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_group
  from public.groups
  where invite_code = upper(trim(p_code));

  if v_group.id is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_uid, 'member')
  on conflict (group_id, user_id) do nothing;

  return v_group;
end;
$$;

-- ---------------------------------------------------------------------------
-- 0006_seed.sql
-- ---------------------------------------------------------------------------
-- ===========================================================================
-- 0006_seed.sql — starter habit templates, badge & title catalogs
-- ===========================================================================

insert into public.habit_templates (category, name, unit, default_target, base_xp, sort_order) values
  ('dsa',           'DSA problems',        'problems', 2,  120, 1),
  ('system_design', 'System design study', 'topics',   1,  120, 2),
  ('gym',           'Gym session',         'sessions', 1,  100, 3),
  ('learning',      'Learn new tech',      'minutes',  30, 80,  4),
  ('learning',      'Technical reading',   'pages',    20, 60,  5)
on conflict (name) do nothing;

insert into public.badges (key, name, description, icon, criteria, xp_reward) values
  ('first-blood',  'First Blood',   'Log your very first quest.',                '🩸', '{"type":"first_log"}',                                 25),
  ('week-streak',  'On Fire',       'Reach a 7-day streak.',                     '🔥', '{"type":"streak_at_least","days":7}',                  150),
  ('month-streak', 'Unstoppable',   'Reach a 30-day streak.',                    '⚡', '{"type":"streak_at_least","days":30}',                 500),
  ('perfect-week', 'Flawless',      'Hit every target for 7 days straight.',     '💎', '{"type":"perfect_week"}',                              300),
  ('century-dsa',  'Century',       'Solve 100 DSA problems.',                   '🧮', '{"type":"category_total_at_least","category":"dsa","count":100}',    400),
  ('gym-rat',      'Gym Rat',       'Complete 20 gym sessions.',                 '🏋️', '{"type":"category_total_at_least","category":"gym","count":20}',     300),
  ('polyglot',     'Polyglot',      'Log learning on 30 different days.',        '📚', '{"type":"category_days_at_least","category":"learning","days":30}',  300),
  ('level-10',     'Veteran',       'Reach level 10.',                           '🎖️', '{"type":"level_at_least","level":10}',                 0),
  ('champion',     'Champion',      'Finish #1 at the end of a season.',         '🏆', '{"type":"season_rank","rank":1}',                      500)
on conflict (key) do nothing;

insert into public.titles (key, name, description, unlock_rule) values
  ('grindling', 'Grindling', 'Every legend starts here.',        '{"type":"level_at_least","level":1}'),
  ('grinder',   'Grinder',   'Reach level 5.',                   '{"type":"level_at_least","level":5}'),
  ('grindlord', 'Grindlord', 'Reach level 10.',                  '{"type":"level_at_least","level":10}'),
  ('ascended',  'Ascended',  'Prestige at least once.',          '{"type":"prestige_at_least","prestige":1}'),
  ('champion',  'Champion',  'Win a season.',                    '{"type":"season_rank","rank":1}')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 0007_group_admin.sql
-- ---------------------------------------------------------------------------
-- ===========================================================================
-- 0007_group_admin.sql — owner-only invite-code rotation
-- ===========================================================================

create or replace function public.rotate_invite_code(p_group uuid)
returns public.groups language plpgsql security definer
set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text;
  v_group public.groups;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.groups where id = p_group and owner_id = v_uid
  ) then
    raise exception 'only the owner can rotate the invite code';
  end if;

  loop
    v_code := public.gen_invite_code();
    exit when not exists (
      select 1 from public.groups where invite_code = v_code
    );
  end loop;

  update public.groups set invite_code = v_code
  where id = p_group
  returning * into v_group;

  return v_group;
end;
$$;

-- ---------------------------------------------------------------------------
-- 0008_seasons.sql
-- ---------------------------------------------------------------------------
-- ===========================================================================
-- 0008_seasons.sql — wager config + weekly season rollover/settlement
-- ===========================================================================

-- Owner sets/updates the single OPEN wager for the group's active season.
create or replace function public.set_wager(p_group uuid, p_stake text)
returns public.wagers language plpgsql security definer
set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_owner  uuid;
  v_season uuid;
  v_wager  public.wagers;
begin
  select owner_id, active_season_id into v_owner, v_season
  from public.groups where id = p_group;
  if v_owner is null then
    raise exception 'group not found';
  end if;
  if v_uid is distinct from v_owner then
    raise exception 'only the owner can set the wager';
  end if;

  select * into v_wager from public.wagers
  where group_id = p_group and season_id = v_season and status = 'open'
  limit 1;

  if v_wager.id is not null then
    update public.wagers set stake = p_stake
    where id = v_wager.id returning * into v_wager;
  else
    insert into public.wagers (group_id, season_id, stake, status)
    values (p_group, v_season, p_stake, 'open')
    returning * into v_wager;
  end if;

  return v_wager;
end;
$$;

-- Close the active season: snapshot + rank scores, settle the wager, award the
-- champion badge, replenish freezes, then open next week's season.
-- SECURITY DEFINER and un-gated so the cron (service role) can invoke it.
create or replace function public.close_and_rollover_season(p_group uuid)
returns public.seasons language plpgsql security definer
set search_path = public as $$
declare
  v_season    public.seasons;
  v_new       public.seasons;
  v_next_name text;
  v_n         int;
  v_champion  uuid;
  v_top_score int;
  v_top_count int;
  v_min       int;
  v_min_count int;
  v_loser     uuid;
begin
  select * into v_season from public.seasons
  where group_id = p_group and is_active
  order by starts_on desc limit 1;
  if v_season.id is null then
    raise exception 'no active season';
  end if;

  -- Snapshot each member's total XP over the season window.
  with member_scores as (
    select gm.user_id,
           coalesce((
             select sum(ds.xp_earned) from public.daily_scores ds
             where ds.group_id = p_group and ds.user_id = gm.user_id
               and ds.date between v_season.starts_on and v_season.ends_on
           ), 0)::int as score
    from public.group_members gm
    where gm.group_id = p_group
  )
  insert into public.season_scores (season_id, user_id, score)
  select v_season.id, user_id, score from member_scores
  on conflict (season_id, user_id) do update set score = excluded.score;

  -- Standard competition ranking (highest score = rank 1).
  update public.season_scores ss
  set rank = 1 + (
    select count(*) from public.season_scores s2
    where s2.season_id = v_season.id and s2.score > ss.score
  )
  where ss.season_id = v_season.id;

  -- Champion badge for a unique top scorer.
  select max(score) into v_top_score
  from public.season_scores where season_id = v_season.id;
  select count(*) into v_top_count
  from public.season_scores where season_id = v_season.id and score = v_top_score;
  if v_top_count = 1 then
    select user_id into v_champion
    from public.season_scores where season_id = v_season.id and score = v_top_score;
    insert into public.user_badges (user_id, badge_id, group_id)
    select v_champion, b.id, p_group from public.badges b where b.key = 'champion'
    on conflict (user_id, badge_id) do nothing;
  end if;

  -- Wager loser = strictly lowest scorer (null if the min is shared).
  select min(score) into v_min
  from public.season_scores where season_id = v_season.id;
  select count(*) into v_min_count
  from public.season_scores where season_id = v_season.id and score = v_min;
  if v_min_count = 1 then
    select user_id into v_loser
    from public.season_scores where season_id = v_season.id and score = v_min;
  else
    v_loser := null;
  end if;

  update public.wagers
  set status = 'settled', settled_at = now(), loser_id = v_loser
  where group_id = p_group and season_id = v_season.id and status = 'open';

  -- Replenish streak freezes (+1, cap 3) for all members.
  update public.profiles p
  set streak_freezes = least(p.streak_freezes + 1, 3)
  from public.group_members gm
  where gm.group_id = p_group and gm.user_id = p.id;

  -- Close the old season and open the next week.
  update public.seasons set is_active = false where id = v_season.id;

  if v_season.name ~ '^Season [0-9]+$' then
    v_n := (regexp_replace(v_season.name, '^Season ', ''))::int;
    v_next_name := 'Season ' || (v_n + 1);
  else
    v_next_name := 'Next Season';
  end if;

  insert into public.seasons (group_id, name, starts_on, ends_on, is_active)
  values (p_group, v_next_name, v_season.ends_on + 1, v_season.ends_on + 7, true)
  returning * into v_new;

  update public.groups set active_season_id = v_new.id where id = p_group;

  return v_new;
end;
$$;

