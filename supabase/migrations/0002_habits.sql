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
