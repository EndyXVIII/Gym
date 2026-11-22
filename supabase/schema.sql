-- Scheda: database schema for Supabase (Postgres).
-- Run once: Supabase dashboard > SQL Editor > New query > paste this file > Run.
-- Safe to run again.
--
-- Every table holds one kind of record. The app is offline-first: IndexedDB on
-- the phone is the source of truth and this is the background copy.
--   id                 UUID made on the device (seed records: UUID v5 of their key)
--   data               the whole record as JSON
--   updated_at         when the device changed it (last write wins on this)
--   deleted_at         soft delete
--   server_updated_at  set by the server; the app pulls changes after this cursor
-- Row-level security: each row belongs to auth.uid() and nobody else can see it.

create or replace function public.scheda_last_write_wins()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- Last write wins: an older version never overwrites a newer one.
    if new.updated_at < old.updated_at then
      return null;
    end if;
    new.user_id := old.user_id;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- settings --------------------------------------------------------------------
create table if not exists public.settings (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);
create index if not exists settings_user_cursor on public.settings (user_id, server_updated_at);
alter table public.settings enable row level security;
drop policy if exists "settings: only my rows" on public.settings;
create policy "settings: only my rows" on public.settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.settings from anon;
grant select, insert, update, delete on public.settings to authenticated;
drop trigger if exists settings_last_write_wins on public.settings;
create trigger settings_last_write_wins
  before insert or update on public.settings
  for each row execute function public.scheda_last_write_wins();

-- exercises --------------------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);
create index if not exists exercises_user_cursor on public.exercises (user_id, server_updated_at);
alter table public.exercises enable row level security;
drop policy if exists "exercises: only my rows" on public.exercises;
create policy "exercises: only my rows" on public.exercises
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.exercises from anon;
grant select, insert, update, delete on public.exercises to authenticated;
drop trigger if exists exercises_last_write_wins on public.exercises;
create trigger exercises_last_write_wins
  before insert or update on public.exercises
  for each row execute function public.scheda_last_write_wins();

-- days --------------------------------------------------------------------
create table if not exists public.days (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);
create index if not exists days_user_cursor on public.days (user_id, server_updated_at);
alter table public.days enable row level security;
drop policy if exists "days: only my rows" on public.days;
create policy "days: only my rows" on public.days
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.days from anon;
grant select, insert, update, delete on public.days to authenticated;
drop trigger if exists days_last_write_wins on public.days;
create trigger days_last_write_wins
  before insert or update on public.days
  for each row execute function public.scheda_last_write_wins();

-- slots --------------------------------------------------------------------
create table if not exists public.slots (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);
create index if not exists slots_user_cursor on public.slots (user_id, server_updated_at);
alter table public.slots enable row level security;
drop policy if exists "slots: only my rows" on public.slots;
create policy "slots: only my rows" on public.slots
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.slots from anon;
grant select, insert, update, delete on public.slots to authenticated;
drop trigger if exists slots_last_write_wins on public.slots;
create trigger slots_last_write_wins
  before insert or update on public.slots
  for each row execute function public.scheda_last_write_wins();

-- sessions --------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);
create index if not exists sessions_user_cursor on public.sessions (user_id, server_updated_at);
alter table public.sessions enable row level security;
drop policy if exists "sessions: only my rows" on public.sessions;
create policy "sessions: only my rows" on public.sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.sessions from anon;
grant select, insert, update, delete on public.sessions to authenticated;
drop trigger if exists sessions_last_write_wins on public.sessions;
create trigger sessions_last_write_wins
  before insert or update on public.sessions
  for each row execute function public.scheda_last_write_wins();

-- set_logs --------------------------------------------------------------------
create table if not exists public.set_logs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);
create index if not exists set_logs_user_cursor on public.set_logs (user_id, server_updated_at);
alter table public.set_logs enable row level security;
drop policy if exists "set_logs: only my rows" on public.set_logs;
create policy "set_logs: only my rows" on public.set_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.set_logs from anon;
grant select, insert, update, delete on public.set_logs to authenticated;
drop trigger if exists set_logs_last_write_wins on public.set_logs;
create trigger set_logs_last_write_wins
  before insert or update on public.set_logs
  for each row execute function public.scheda_last_write_wins();

-- media --------------------------------------------------------------------
create table if not exists public.media (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);
create index if not exists media_user_cursor on public.media (user_id, server_updated_at);
alter table public.media enable row level security;
drop policy if exists "media: only my rows" on public.media;
create policy "media: only my rows" on public.media
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.media from anon;
grant select, insert, update, delete on public.media to authenticated;
drop trigger if exists media_last_write_wins on public.media;
create trigger media_last_write_wins
  before insert or update on public.media
  for each row execute function public.scheda_last_write_wins();

-- Photos and videos of exercises: private bucket, one folder per user ------
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 62914560)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "media: read my files" on storage.objects;
create policy "media: read my files" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "media: add my files" on storage.objects;
create policy "media: add my files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "media: replace my files" on storage.objects;
create policy "media: replace my files" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "media: delete my files" on storage.objects;
create policy "media: delete my files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
