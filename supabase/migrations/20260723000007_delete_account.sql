-- ============================================================================
-- Habit Tracker — 0007 Account deletion (GDPR / App Store requirement)
-- Deletes the authenticated caller's auth user. Every app table's user_id FK is
-- ON DELETE CASCADE, so this removes all of the user's data in one step.
-- security definer so it can delete from auth.users; it only ever touches the
-- caller's own row (auth.uid()), and is not callable by anon.
-- ============================================================================

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = v_user;
end;
$$;

revoke execute on function public.delete_account() from anon, public;
grant execute on function public.delete_account() to authenticated;
