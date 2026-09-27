-- Requests are changed through recipient-checked RPCs, never arbitrary row updates.
drop policy if exists "users send friend requests" on public.friendships;
drop policy if exists "friend participants can update" on public.friendships;
revoke insert, update, delete on public.friendships from anon, authenticated;

create or replace function public.respond_wander_friend(p_requester uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_accept is null then raise exception 'A decision is required'; end if;
  if p_accept then
    update public.friendships set status = 'accepted'
    where requester_id = p_requester and addressee_id = auth.uid() and status = 'pending';
    if not found and not exists (
      select 1 from public.friendships where requester_id = p_requester
      and addressee_id = auth.uid() and status = 'accepted'
    ) then raise exception 'Request is no longer pending'; end if;
  else
    delete from public.friendships where requester_id = p_requester
      and addressee_id = auth.uid() and status = 'pending';
  end if;
end;
$$;

create or replace function public.send_wander_friend(p_username text)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_other uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select id into v_other from public.profiles where username = trim(p_username);
  if v_other is null then raise exception 'No user has that username'; end if;
  if v_other = v_user then raise exception 'You cannot add yourself'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(v_user,v_other)::text || greatest(v_user,v_other)::text, 0));
  if exists(select 1 from public.friendships where
    (requester_id = v_user and addressee_id = v_other) or
    (requester_id = v_other and addressee_id = v_user)) then
    raise exception 'A friendship or request already exists';
  end if;
  insert into public.friendships(requester_id, addressee_id) values(v_user, v_other);
end;
$$;

create or replace function public.get_wander_friends()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select jsonb_build_object(
    'pending', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.username
    ) order by f.created_at) from public.friendships f
      join public.profiles p on p.id = f.requester_id
      where f.addressee_id = v_user and f.status = 'pending'), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
      'id', case when p.id = v_user then 'you' else p.id::text end,
      'name', case when p.id = v_user then 'You' else p.username end,
      'points', p.total_points,
      'completedWalks', (select count(*) from public.points_ledger l
         where l.user_id = p.id and l.event_key like 'walk:%')
    ) order by p.total_points desc, p.username, p.id)
    from public.profiles p where p.id = v_user or exists (
      select 1 from public.friendships f where f.status = 'accepted' and
      ((f.requester_id = v_user and f.addressee_id = p.id) or
       (f.addressee_id = v_user and f.requester_id = p.id))
    )), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.respond_wander_friend(uuid, boolean) from public;
revoke all on function public.send_wander_friend(text) from public;
revoke all on function public.get_wander_friends() from public;
grant execute on function public.respond_wander_friend(uuid, boolean) to authenticated;
grant execute on function public.send_wander_friend(text) to authenticated;
grant execute on function public.get_wander_friends() to authenticated;
