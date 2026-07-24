-- KinDee backend schema for Supabase (Postgres).
-- Run this once in your project's SQL editor (Dashboard → SQL → New query).
--
-- Model: one JSON document per user holds their whole personal log
-- (daily goal, per-day meal entries, and custom foods). Weekly/monthly
-- summaries are computed in the browser, so a single document is enough
-- and keeps the server simple. Row-level security ensures each person can
-- only ever read or write their own row.

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- Each authenticated user may see and change only their own document.
drop policy if exists "user_data_select_own" on public.user_data;
create policy "user_data_select_own"
  on public.user_data for select
  using (auth.uid() = user_id);

drop policy if exists "user_data_insert_own" on public.user_data;
create policy "user_data_insert_own"
  on public.user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_data_update_own" on public.user_data;
create policy "user_data_update_own"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_data_delete_own" on public.user_data;
create policy "user_data_delete_own"
  on public.user_data for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- OPTIONAL: normalized schema, if you later want to run server-side queries
-- (e.g. SQL summaries or sharing with a dietitian). Not used by the app today.
-- ---------------------------------------------------------------------------
-- create table if not exists public.food_entries (
--   id         uuid primary key default gen_random_uuid(),
--   user_id    uuid not null references auth.users (id) on delete cascade,
--   eaten_on   date not null,
--   meal       text not null check (meal in ('breakfast','lunch','dinner','snack')),
--   name       text not null,
--   thai       text,
--   serving    text,
--   kcal       numeric not null default 0,
--   p          numeric not null default 0,
--   c          numeric not null default 0,
--   f          numeric not null default 0,
--   qty        numeric not null default 1,
--   created_at timestamptz not null default now()
-- );
-- create index if not exists food_entries_user_date on public.food_entries (user_id, eaten_on);
-- alter table public.food_entries enable row level security;
-- create policy "food_entries_own" on public.food_entries
--   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
