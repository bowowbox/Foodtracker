-- KinDee admin dashboard schema (optional, run AFTER schema.sql).
-- Run this once in your project's SQL editor (Dashboard → SQL → New query).
--
-- Adds a small allowlist table plus a handful of "security definer" functions
-- that return aggregate usage stats (and, for a specific person, their raw
-- log) — but ONLY to accounts whose email is on the allowlist. Everyone else
-- calling these functions gets an error. This keeps the browser-side anon key
-- unprivileged as always; the gate lives in the database, not the client.

-- ---------------------------------------------------------------------------
-- 1. Admin allowlist
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  email      text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
-- Deliberately no policies: the anon/authenticated roles get zero direct
-- access to this table. Only a security-definer function (below) may read
-- it, and only the SQL editor (running as table owner) may write to it.

-- Add yourself as an admin (repeat for each admin, then run):
-- insert into public.admin_users (email) values ('you@example.com')
--   on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Admin check, used by every function below
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.admin_users
    where email = auth.jwt() ->> 'email'
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Top-line counts: signed-up users, users with any log, active today/
--    this week/this month (an "active" day = a day they logged food for).
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns table (
  signed_up_users   bigint,
  users_with_log    bigint,
  active_today      bigint,
  active_this_week  bigint,
  active_this_month bigint
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    (select count(*) from auth.users) as signed_up_users,
    (select count(distinct ud.user_id)
       from public.user_data ud
       where coalesce(ud.data -> 'log', '{}'::jsonb) <> '{}'::jsonb) as users_with_log,
    (select count(distinct ud.user_id)
       from public.user_data ud
       cross join lateral jsonb_object_keys(coalesce(ud.data -> 'log', '{}'::jsonb)) as d
       where d::date = current_date) as active_today,
    (select count(distinct ud.user_id)
       from public.user_data ud
       cross join lateral jsonb_object_keys(coalesce(ud.data -> 'log', '{}'::jsonb)) as d
       where d::date >= current_date - interval '6 days') as active_this_week,
    (select count(distinct ud.user_id)
       from public.user_data ud
       cross join lateral jsonb_object_keys(coalesce(ud.data -> 'log', '{}'::jsonb)) as d
       where d::date >= current_date - interval '29 days') as active_this_month;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Daily active users for the last N days (default 30) — chart data.
-- ---------------------------------------------------------------------------
create or replace function public.admin_daily_activity(days int default 30)
returns table (log_date date, active_users bigint)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select gs.d::date as log_date, count(distinct ud.user_id) as active_users
  from generate_series(
         current_date - (greatest(days, 1) - 1) * interval '1 day',
         current_date,
         interval '1 day'
       ) as gs(d)
  left join public.user_data ud
    on coalesce(ud.data -> 'log', '{}'::jsonb) ? to_char(gs.d, 'YYYY-MM-DD')
  group by gs.d
  order by gs.d;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Per-user summary: join date, days logged, total entries, first/last
--    log date, last sync time — this is your "how frequently are they
--    logging" table.
-- ---------------------------------------------------------------------------
create or replace function public.admin_user_list()
returns table (
  user_id        uuid,
  email          text,
  joined_at      timestamptz,
  days_logged    bigint,
  total_entries  bigint,
  first_log_date date,
  last_log_date  date,
  last_synced_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    u.id as user_id,
    u.email,
    u.created_at as joined_at,
    coalesce(agg.days_logged, 0) as days_logged,
    coalesce(agg.total_entries, 0) as total_entries,
    agg.first_log_date,
    agg.last_log_date,
    ud.updated_at as last_synced_at
  from auth.users u
  left join public.user_data ud on ud.user_id = u.id
  left join lateral (
    select
      count(distinct t.log_date) as days_logged,
      sum(
        coalesce(jsonb_array_length(t.meal_day -> 'breakfast'), 0) +
        coalesce(jsonb_array_length(t.meal_day -> 'lunch'), 0) +
        coalesce(jsonb_array_length(t.meal_day -> 'dinner'), 0) +
        coalesce(jsonb_array_length(t.meal_day -> 'snack'), 0)
      ) as total_entries,
      min(t.log_date::date) as first_log_date,
      max(t.log_date::date) as last_log_date
    from jsonb_each(coalesce(ud.data -> 'log', '{}'::jsonb)) as t(log_date, meal_day)
  ) agg on true
  order by u.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Drill-down: one user's full log document, by user_id.
-- ---------------------------------------------------------------------------
create or replace function public.admin_user_log(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select data into result from public.user_data where user_id = target_user_id;
  return coalesce(result, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Let signed-in users call these (the functions themselves reject
--    anyone not on the admin_users allowlist).
-- ---------------------------------------------------------------------------
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_daily_activity(int) to authenticated;
grant execute on function public.admin_user_list() to authenticated;
grant execute on function public.admin_user_log(uuid) to authenticated;
