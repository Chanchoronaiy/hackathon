-- Wander production database foundation (Supabase/Postgres).
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  total_points integer not null default 0 check (total_points >= 0),
  created_at timestamptz not null default now()
);

create table public.places (
  id text primary key,
  name text not null,
  category text not null,
  latitude double precision not null,
  longitude double precision not null,
  description text,
  active boolean not null default true
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  route_data jsonb not null,
  created_at timestamptz not null default now()
);

create table public.daily_quests (
  id uuid primary key default gen_random_uuid(),
  quest_date date not null,
  place_id text not null references public.places(id),
  points integer not null default 250 check (points > 0),
  unique (quest_date, place_id)
);

create table public.photo_submissions (
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

create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null,
  points integer not null check (points > 0),
  reason text not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);

create table public.friendships (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create view public.global_leaderboard as
select id, username, avatar_url, total_points,
       dense_rank() over (order by total_points desc) as rank
from public.profiles;

alter table public.profiles enable row level security;
alter table public.routes enable row level security;
alter table public.photo_submissions enable row level security;
alter table public.points_ledger enable row level security;
alter table public.friendships enable row level security;

create policy "profiles are readable" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users manage own routes" on public.routes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users create own submissions" on public.photo_submissions for insert with check (auth.uid() = user_id);
create policy "users read own submissions" on public.photo_submissions for select using (auth.uid() = user_id);
create policy "users read own points" on public.points_ledger for select using (auth.uid() = user_id);
create policy "friend participants can read" on public.friendships for select using (auth.uid() in (requester_id, addressee_id));
create policy "users send friend requests" on public.friendships for insert with check (auth.uid() = requester_id);

-- Award points from a trusted Edge Function/service-role transaction, never directly from the browser.
