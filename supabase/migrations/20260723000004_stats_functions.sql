-- ============================================================================
-- Habit Tracker — 0004 Derived stats (streaks, completion rate, heatmap)
-- Nothing here is stored; all computed from habit_logs so sync can't corrupt it.
-- Functions are SECURITY INVOKER, so RLS on the underlying tables still applies:
-- a caller can only ever compute stats for their own habits.
--
-- Streak rules:
--   * 'completed' extends & counts toward the streak.
--   * 'frozen'    preserves the streak (does not break it) but does not add.
--   * an expected day that is missing/'skipped' ends the streak (except TODAY,
--     which is allowed to be unfinished).
--   * "expected day" respects the habit's frequency:
--       - daily / weekly_count / interval  → every day treated as expected (see note)
--       - specific_days                     → only weekdays in freq_days
--   NOTE: weekly_count ("3× / week") and interval streaks are approximated as
--   daily here. If you want true week-based streaks for count habits, that's a
--   follow-up refinement — flagged in BACKEND_SCHEMA.md.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Is a given date an "expected" day for a habit?
-- ----------------------------------------------------------------------------
create or replace function public.habit_is_expected(
  p_freq_type text,
  p_freq_days int[],
  p_day       date
)
returns boolean
language sql
immutable
as $$
  select case
    when p_freq_type = 'specific_days'
      then extract(dow from p_day)::int = any (coalesce(p_freq_days, '{}'::int[]))
    else true
  end;
$$;

-- ----------------------------------------------------------------------------
-- current_streak(habit, [today])
-- ----------------------------------------------------------------------------
create or replace function public.current_streak(
  p_habit_id uuid,
  p_today    date default current_date
)
returns int
language plpgsql
stable
as $$
declare
  v_freq_type text;
  v_freq_days int[];
  v_streak    int  := 0;
  v_day       date := p_today;
  v_status    text;
begin
  select freq_type, freq_days
    into v_freq_type, v_freq_days
  from public.habits
  where id = p_habit_id and deleted_at is null;

  if not found then
    return 0;
  end if;

  loop
    if public.habit_is_expected(v_freq_type, v_freq_days, v_day) then
      select status into v_status
      from public.habit_logs
      where habit_id = p_habit_id and log_date = v_day and deleted_at is null
      limit 1;

      if v_status = 'completed' then
        v_streak := v_streak + 1;
      elsif v_status = 'frozen' then
        null;                       -- preserve streak, do not count
      elsif v_day = p_today then
        null;                       -- today may be unfinished; don't break
      else
        exit;                       -- expected day missed → streak ends
      end if;
    end if;

    v_day := v_day - 1;
    exit when v_day < p_today - 3650;   -- 10-year safety bound
  end loop;

  return v_streak;
end;
$$;

-- ----------------------------------------------------------------------------
-- longest_streak(habit)  — walks from first log to today
-- ----------------------------------------------------------------------------
create or replace function public.longest_streak(
  p_habit_id uuid,
  p_today    date default current_date
)
returns int
language plpgsql
stable
as $$
declare
  v_freq_type text;
  v_freq_days int[];
  v_first     date;
  v_day       date;
  v_status    text;
  v_run       int := 0;
  v_best      int := 0;
begin
  select freq_type, freq_days
    into v_freq_type, v_freq_days
  from public.habits
  where id = p_habit_id and deleted_at is null;

  if not found then
    return 0;
  end if;

  select min(log_date) into v_first
  from public.habit_logs
  where habit_id = p_habit_id and deleted_at is null;

  if v_first is null then
    return 0;
  end if;

  v_day := v_first;
  while v_day <= p_today loop
    if public.habit_is_expected(v_freq_type, v_freq_days, v_day) then
      select status into v_status
      from public.habit_logs
      where habit_id = p_habit_id and log_date = v_day and deleted_at is null
      limit 1;

      if v_status = 'completed' then
        v_run := v_run + 1;
        v_best := greatest(v_best, v_run);
      elsif v_status = 'frozen' then
        null;                       -- preserve run
      else
        v_run := 0;                 -- broke (missing/skipped)
      end if;
    end if;
    v_day := v_day + 1;
  end loop;

  return v_best;
end;
$$;

-- ----------------------------------------------------------------------------
-- completion_rate(habit, from, to)  → 0..100
-- completed occurrences ÷ expected occurrences in the window.
-- ----------------------------------------------------------------------------
create or replace function public.completion_rate(
  p_habit_id uuid,
  p_from     date,
  p_to       date
)
returns int
language plpgsql
stable
as $$
declare
  v_freq_type   text;
  v_freq_days   int[];
  v_freq_target int;
  v_expected    numeric := 0;
  v_completed   int;
  v_weeks       numeric;
begin
  select freq_type, freq_days, freq_target
    into v_freq_type, v_freq_days, v_freq_target
  from public.habits
  where id = p_habit_id and deleted_at is null;

  if not found or p_to < p_from then
    return 0;
  end if;

  if v_freq_type in ('daily','specific_days') then
    select count(*) into v_expected
    from generate_series(p_from, p_to, interval '1 day') g(d)
    where public.habit_is_expected(v_freq_type, v_freq_days, g.d::date);
  elsif v_freq_type = 'weekly_count' then
    v_weeks := ceil((p_to - p_from + 1) / 7.0);
    v_expected := v_weeks * coalesce(v_freq_target, 1);
  elsif v_freq_type = 'interval' then
    v_expected := floor((p_to - p_from + 1)::numeric / greatest(coalesce(v_freq_target, 1), 1));
  end if;

  if v_expected <= 0 then
    return 0;
  end if;

  select count(*) into v_completed
  from public.habit_logs
  where habit_id = p_habit_id
    and status = 'completed'
    and deleted_at is null
    and log_date between p_from and p_to;

  return least(100, round(v_completed / v_expected * 100))::int;
end;
$$;

-- ----------------------------------------------------------------------------
-- heatmap(from, to)  → daily completion counts across all of the caller's habits
-- Powers the calendar heatmap. RLS restricts rows to the caller automatically.
-- ----------------------------------------------------------------------------
create or replace function public.heatmap(
  p_from date,
  p_to   date
)
returns table (log_date date, completions int)
language sql
stable
as $$
  select l.log_date, count(*)::int as completions
  from public.habit_logs l
  where l.status = 'completed'
    and l.deleted_at is null
    and l.log_date between p_from and p_to
  group by l.log_date
  order by l.log_date;
$$;

-- ----------------------------------------------------------------------------
-- habit_stats  — convenience view: per-habit rollups for the "Stats" screen
-- security_invoker so the caller only sees their own habits (via RLS).
-- ----------------------------------------------------------------------------
create or replace view public.habit_stats
with (security_invoker = on)
as
select
  h.id       as habit_id,
  h.user_id,
  h.name,
  h.icon,
  h.color,
  public.current_streak(h.id)                              as current_streak,
  public.longest_streak(h.id)                              as longest_streak,
  public.completion_rate(h.id, current_date - 89, current_date) as rate_90d,
  (select count(*)
     from public.habit_logs l
    where l.habit_id = h.id
      and l.status = 'completed'
      and l.deleted_at is null)                            as total_completions
from public.habits h
where h.deleted_at is null
  and h.archived_at is null;
