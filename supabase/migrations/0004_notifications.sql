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
