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
