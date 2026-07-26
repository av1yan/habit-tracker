-- ============================================================================
-- Habit Tracker — 0001 Core schema
-- Tables, indexes, and updated_at triggers. RLS is enabled in migration 0002.
-- Design: offline-first. Client-generated UUID keys, soft deletes (deleted_at),
-- updated_at for last-write-wins sync.
-- ============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Helper: bump updated_at on every UPDATE (drives last-write-wins sync)
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- profiles  (extends auth.users; identity/passwords stay in Supabase Auth)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  display_name           text        not null default '',
  avatar_emoji           text        not null default '🙂',
  theme                  text        not null default 'system'
                           check (theme in ('system','light','dark')),
  week_start             smallint    not null default 0
                           check (week_start in (0,1)),          -- 0=Sun, 1=Mon
  timezone               text        not null default 'UTC',      -- IANA tz
  streak_freeze_balance  int         not null default 2
                           check (streak_freeze_balance >= 0),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- habits
-- ----------------------------------------------------------------------------
create table public.habits (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  name         text        not null,
  icon         text        not null default '🎯',
  color        text        not null default '#c67139',
  category     text        not null default 'Personal',
  type         text        not null default 'binary'
                 check (type in ('binary','quantity','duration')),
  target       numeric,                     -- null for binary; e.g. 8, 20
  unit         text,                        -- null for binary; 'glasses', 'min'
  -- frequency (see BACKEND_SCHEMA.md): expresses Daily / Weekdays / N×week / every-N-days
  freq_type    text        not null default 'daily'
                 check (freq_type in ('daily','weekly_count','specific_days','interval')),
  freq_target  int,                         -- weekly_count → times/week; interval → every N days
  freq_days    int[],                       -- specific_days → weekday numbers 0..6
  is_bad       boolean     not null default false,   -- true = "Quit", false = "Build"
  sort_order   int         not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  -- quantity/duration habits must define a target; binary must not
  constraint habits_target_matches_type check (
    (type = 'binary'  and target is null) or
    (type <> 'binary' and target is not null)
  ),
  -- freq_days only valid weekday numbers (0..6). `<@` = "contained by";
  -- a plain CHECK can't use a subquery, so use the array containment operator.
  constraint habits_freq_days_valid check (
    freq_days is null or freq_days <@ array[0,1,2,3,4,5,6]::int[]
  )
);

create index habits_user_updated_idx on public.habits (user_id, updated_at);
create index habits_user_active_idx  on public.habits (user_id)
  where deleted_at is null and archived_at is null;

create trigger habits_set_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- habit_logs  (source of truth for completions; streaks/rates derive from this)
-- ----------------------------------------------------------------------------
create table public.habit_logs (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  habit_id      uuid        not null references public.habits (id) on delete cascade,
  log_date      date        not null,        -- user's LOCAL calendar day (decided on device)
  status        text        not null default 'completed'
                  check (status in ('completed','skipped','frozen')),
  value         numeric,                      -- quantity/duration progress; null for binary
  note          text,                         -- "How did it go?"
  completed_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- at most one ACTIVE log per habit per day (tombstones excluded)
create unique index habit_logs_habit_day_uniq
  on public.habit_logs (habit_id, log_date)
  where deleted_at is null;

create index habit_logs_user_updated_idx on public.habit_logs (user_id, updated_at);
create index habit_logs_habit_date_idx   on public.habit_logs (habit_id, log_date)
  where deleted_at is null;

create trigger habit_logs_set_updated_at
  before update on public.habit_logs
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- reminders  (schedule only; notifications fire locally on-device)
-- ----------------------------------------------------------------------------
create table public.reminders (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  habit_id      uuid        not null references public.habits (id) on delete cascade,
  time_of_day   time        not null,
  days_of_week  int[]       not null default '{0,1,2,3,4,5,6}',
  enabled       boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index reminders_user_updated_idx on public.reminders (user_id, updated_at);
create index reminders_habit_idx        on public.reminders (habit_id)
  where deleted_at is null;

create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- achievements  (optional: only needed to "celebrate once" & store the date)
-- ----------------------------------------------------------------------------
create table public.achievements (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  habit_id     uuid        references public.habits (id) on delete cascade,  -- null = account-wide
  kind         text        not null,   -- 'streak_7' | 'streak_30' | 'streak_100' | ...
  achieved_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- one achievement of a given kind per habit (account-wide when habit_id is null)
create unique index achievements_uniq
  on public.achievements (user_id, coalesce(habit_id, '00000000-0000-0000-0000-000000000000'::uuid), kind)
  where deleted_at is null;

create index achievements_user_updated_idx on public.achievements (user_id, updated_at);

create trigger achievements_set_updated_at
  before update on public.achievements
  for each row execute function public.set_updated_at();
