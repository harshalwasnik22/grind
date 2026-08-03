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
