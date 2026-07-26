-- ============================================================================
-- Habit Tracker — 0002 Row-Level Security
-- Every table: a user can only read/write their own rows.
-- ============================================================================

-- profiles ------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles: select own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles: insert own" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
-- no delete policy: profiles are removed via auth.users cascade only.

-- habits --------------------------------------------------------------------
alter table public.habits enable row level security;

create policy "habits: select own" on public.habits
  for select using (user_id = auth.uid());
create policy "habits: insert own" on public.habits
  for insert with check (user_id = auth.uid());
create policy "habits: update own" on public.habits
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "habits: delete own" on public.habits
  for delete using (user_id = auth.uid());

-- habit_logs ----------------------------------------------------------------
alter table public.habit_logs enable row level security;

create policy "habit_logs: select own" on public.habit_logs
  for select using (user_id = auth.uid());
create policy "habit_logs: insert own" on public.habit_logs
  for insert with check (user_id = auth.uid());
create policy "habit_logs: update own" on public.habit_logs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "habit_logs: delete own" on public.habit_logs
  for delete using (user_id = auth.uid());

-- reminders -----------------------------------------------------------------
alter table public.reminders enable row level security;

create policy "reminders: select own" on public.reminders
  for select using (user_id = auth.uid());
create policy "reminders: insert own" on public.reminders
  for insert with check (user_id = auth.uid());
create policy "reminders: update own" on public.reminders
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reminders: delete own" on public.reminders
  for delete using (user_id = auth.uid());

-- achievements --------------------------------------------------------------
alter table public.achievements enable row level security;

create policy "achievements: select own" on public.achievements
  for select using (user_id = auth.uid());
create policy "achievements: insert own" on public.achievements
  for insert with check (user_id = auth.uid());
create policy "achievements: update own" on public.achievements
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "achievements: delete own" on public.achievements
  for delete using (user_id = auth.uid());
