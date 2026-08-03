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
