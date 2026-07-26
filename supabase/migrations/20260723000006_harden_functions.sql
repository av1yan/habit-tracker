-- ============================================================================
-- Habit Tracker — 0006 Function hardening (addresses security advisors)
--   * Pin search_path on all functions (they reference schema-qualified objects
--     only, so an empty search_path is safe and blocks search_path shadowing).
--   * handle_new_user is a trigger only — revoke RPC EXECUTE from API roles.
-- ============================================================================

alter function public.set_updated_at() set search_path = '';
alter function public.habit_is_expected(text, int[], date) set search_path = '';
alter function public.current_streak(uuid, date) set search_path = '';
alter function public.longest_streak(uuid, date) set search_path = '';
alter function public.completion_rate(uuid, date, date) set search_path = '';
alter function public.heatmap(date, date) set search_path = '';
alter function public.use_streak_freeze(uuid, date) set search_path = '';

-- handle_new_user already sets search_path = public; it fires from a trigger and
-- is never meant to be called directly, so remove it from the public API.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
