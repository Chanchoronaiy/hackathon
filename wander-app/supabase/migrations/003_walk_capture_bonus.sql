-- Completed walks: 10 points per route minute, plus 1 point if the walk has its
-- memory. Requires 002_walk_memories.sql. The bonus is decided here from
-- walk_memories, whose unique (user_id, walk_id) constraint allows one memory
-- per walk — so a walk can never earn more than one capture point.
-- Event keys are 'walk:<walk id>' and the walk id matches walk_memories.walk_id.
create or replace function public.complete_wander_walk(
  p_event_key text,
  p_minutes integer
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_walk_id text;
  v_capture_bonus integer := 0;
  v_points integer;
  v_added integer := 0;
  v_total integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_event_key is null or p_event_key !~ '^walk:[A-Za-z0-9-]+$' then
    raise exception 'Invalid walk event key';
  end if;
  if p_minutes < 1 or p_minutes > 180 then
    raise exception 'Walk minutes outside allowed range';
  end if;

  v_walk_id := substr(p_event_key, 6);
  if exists (
    select 1 from public.walk_memories
    where user_id = v_user and walk_id = v_walk_id
  ) then
    v_capture_bonus := 1;
  end if;

  v_points := p_minutes * 10 + v_capture_bonus;

  insert into public.profiles (id, username)
  values (v_user, 'Wanderer-' || left(v_user::text, 6))
  on conflict (id) do nothing;

  insert into public.points_ledger (user_id, event_key, points, reason)
  values (
    v_user,
    p_event_key,
    v_points,
    'Completed ' || p_minutes || '-minute wander'
      || case when v_capture_bonus > 0 then ' + memory' else '' end
  )
  on conflict (user_id, event_key) do nothing;

  get diagnostics v_added = row_count;
  if v_added = 1 then
    update public.profiles
    set total_points = total_points + v_points
    where id = v_user;
  end if;

  select total_points into v_total from public.profiles where id = v_user;
  return coalesce(v_total, 0);
end;
$$;

revoke all on function public.complete_wander_walk(text, integer) from public;
grant execute on function public.complete_wander_walk(text, integer) to authenticated;
