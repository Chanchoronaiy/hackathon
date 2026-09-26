-- Wander database foundation for Supabase/Postgres.
-- Safe to paste into the Supabase SQL editor more than once.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  total_points integer not null default 0 check (total_points >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.places (
  id text primary key,
  name text not null,
  category text not null,
  latitude double precision not null,
  longitude double precision not null,
  description text,
  active boolean not null default true
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  route_data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_quests (
  id uuid primary key default gen_random_uuid(),
  quest_date date not null,
  place_id text not null references public.places(id),
  points integer not null default 250 check (points > 0),
  unique (quest_date, place_id)
);

create table if not exists public.photo_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  place_id text not null references public.places(id),
  quest_id uuid references public.daily_quests(id),
  photo_path text not null,
  latitude double precision not null,
  longitude double precision not null,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null,
  points integer not null check (points > 0),
  reason text not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);

create table if not exists public.friendships (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create or replace function public.handle_new_wander_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Wanderer-' || left(new.id::text, 6)
  );
  if exists (select 1 from public.profiles p where p.username = v_name) then
    v_name := v_name || '-' || left(new.id::text, 6);
  end if;
  insert into public.profiles (id, username) values (new.id, v_name)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_wander_user();

create or replace function public.award_wander_points(p_event_key text, p_points integer, p_reason text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_added integer := 0;
  v_total integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_points < 1 or p_points > 500 then raise exception 'Points outside allowed range'; end if;
  insert into public.profiles (id, username)
  values (v_user, 'Wanderer-' || left(v_user::text, 6)) on conflict (id) do nothing;
  insert into public.points_ledger (user_id, event_key, points, reason)
  values (v_user, p_event_key, p_points, left(p_reason, 120))
  on conflict (user_id, event_key) do nothing;
  get diagnostics v_added = row_count;
  if v_added = 1 then
    update public.profiles set total_points = total_points + p_points where id = v_user;
  end if;
  select total_points into v_total from public.profiles where id = v_user;
  return coalesce(v_total, 0);
end;
$$;

create or replace function public.complete_wander_checkin(
  p_event_key text, p_place_id text, p_place_name text,
  p_place_latitude double precision, p_place_longitude double precision,
  p_checkin_latitude double precision, p_checkin_longitude double precision,
  p_photo_path text, p_points integer
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_total integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_points < 1 or p_points > 500 then raise exception 'Points outside allowed range'; end if;
  insert into public.places (id, name, category, latitude, longitude)
  values (p_place_id, left(p_place_name, 120), 'quest', p_place_latitude, p_place_longitude)
  on conflict (id) do update set name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude;
  insert into public.photo_submissions (user_id, place_id, photo_path, latitude, longitude, verification_status)
  values (v_user, p_place_id, p_photo_path, p_checkin_latitude, p_checkin_longitude, 'verified');
  select public.award_wander_points(p_event_key, p_points, 'Verified photo check-in') into v_total;
  return v_total;
end;
$$;

drop view if exists public.global_leaderboard;
create view public.global_leaderboard with (security_invoker = true) as
select id, username, avatar_url, total_points,
       dense_rank() over (order by total_points desc) as rank
from public.profiles
order by total_points desc, created_at asc;

alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.routes enable row level security;
alter table public.daily_quests enable row level security;
alter table public.photo_submissions enable row level security;
alter table public.points_ledger enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "profiles are readable" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "places are readable" on public.places;
drop policy if exists "daily quests are readable" on public.daily_quests;
drop policy if exists "users manage own routes" on public.routes;
drop policy if exists "users create own submissions" on public.photo_submissions;
drop policy if exists "users read own submissions" on public.photo_submissions;
drop policy if exists "users read own points" on public.points_ledger;
drop policy if exists "friend participants can read" on public.friendships;
drop policy if exists "users send friend requests" on public.friendships;
drop policy if exists "friend participants can update" on public.friendships;

create policy "profiles are readable" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "places are readable" on public.places for select using (true);
create policy "daily quests are readable" on public.daily_quests for select using (true);
create policy "users manage own routes" on public.routes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users create own submissions" on public.photo_submissions for insert with check (auth.uid() = user_id);
create policy "users read own submissions" on public.photo_submissions for select using (auth.uid() = user_id);
create policy "users read own points" on public.points_ledger for select using (auth.uid() = user_id);
create policy "friend participants can read" on public.friendships for select using (auth.uid() in (requester_id, addressee_id));
create policy "users send friend requests" on public.friendships for insert with check (auth.uid() = requester_id);
create policy "friend participants can update" on public.friendships for update using (auth.uid() in (requester_id, addressee_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checkin-photos', 'checkin-photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

drop policy if exists "users upload own checkin photos" on storage.objects;
drop policy if exists "users read own checkin photos" on storage.objects;
create policy "users upload own checkin photos" on storage.objects for insert to authenticated
with check (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own checkin photos" on storage.objects for select to authenticated
using (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);

grant select on public.global_leaderboard to authenticated;
grant execute on function public.award_wander_points(text, integer, text) to authenticated;
grant execute on function public.complete_wander_checkin(text, text, text, double precision, double precision, double precision, double precision, text, integer) to authenticated;
