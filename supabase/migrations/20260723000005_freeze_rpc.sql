-- ============================================================================
-- Habit Tracker — 0005 use_streak_freeze() RPC
-- Atomically: verify balance > 0, write a 'frozen' log for the day, decrement
-- the balance. security invoker → RLS + auth.uid() still apply.
-- Returns the new remaining balance.
-- ============================================================================

create or replace function public.use_streak_freeze(
  p_habit_id uuid,
  p_date     date default current_date
)
returns int
language plpgsql
as $$
declare
  v_user    uuid := auth.uid();
  v_balance int;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  -- lock the profile row so concurrent freezes can't both spend the last one
  select streak_freeze_balance into v_balance
  from public.profiles
  where id = v_user
  for update;

  if v_balance is null then
    raise exception 'profile not found';
  end if;
  if v_balance <= 0 then
    raise exception 'no streak freezes available';
  end if;

  if not exists (
    select 1 from public.habits
    where id = p_habit_id and user_id = v_user and deleted_at is null
  ) then
    raise exception 'habit not found';
  end if;

  -- convert an existing active log for the day to frozen, else insert one.
  -- (only the active row is touched, so the (habit_id, log_date) unique index
  --  over non-deleted rows is never violated.)
  update public.habit_logs
     set status = 'frozen'
   where habit_id = p_habit_id
     and log_date = p_date
     and deleted_at is null;

  if not found then
    insert into public.habit_logs (user_id, habit_id, log_date, status, note)
    values (v_user, p_habit_id, p_date, 'frozen', 'Streak freeze');
  end if;

  update public.profiles
     set streak_freeze_balance = streak_freeze_balance - 1
   where id = v_user;

  return v_balance - 1;
end;
$$;
