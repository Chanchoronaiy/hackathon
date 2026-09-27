-- Award completed walks on the server so clients cannot choose their own score.
-- A walk earns 10 points per completed route minute, up to the app's 180-minute limit.
create or replace function public.complete_wander_walk(
  p_event_key text,
  p_minutes integer
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
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

  v_points := p_minutes * 10;

  insert into public.profiles (id, username)
  values (v_user, 'Wanderer-' || left(v_user::text, 6))
  on conflict (id) do nothing;

  insert into public.points_ledger (user_id, event_key, points, reason)
  values (
    v_user,
    p_event_key,
    v_points,
    'Completed ' || p_minutes || '-minute wander'
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
