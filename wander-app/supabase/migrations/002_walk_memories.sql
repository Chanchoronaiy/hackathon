-- One memory (photo) per walk. Safe to paste into the Supabase SQL editor more than once.
create table if not exists public.walk_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  walk_id text not null,
  route_title text not null,
  stop_id text,
  stop_name text,
  photo_path text not null,
  created_at timestamptz not null default now()
);

-- Existing data: if any walk already has more than one memory, this lists them
-- (the earliest is the one to keep). Nothing is deleted automatically — review
-- the rows and remove the extras by hand before the constraint below can be added.
--   select walk_id, user_id, count(*) as memories, min(created_at) as keep_created_at
--   from public.walk_memories group by walk_id, user_id having count(*) > 1;

-- The database itself rejects a second memory for the same walk (error 23505).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'walk_memories_one_per_walk'
  ) then
    alter table public.walk_memories
      add constraint walk_memories_one_per_walk unique (user_id, walk_id);
  end if;
end;
$$;

alter table public.walk_memories enable row level security;

drop policy if exists "users create own walk memories" on public.walk_memories;
drop policy if exists "users read own walk memories" on public.walk_memories;
create policy "users create own walk memories" on public.walk_memories
  for insert with check (auth.uid() = user_id);
create policy "users read own walk memories" on public.walk_memories
  for select using (auth.uid() = user_id);
