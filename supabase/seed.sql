-- ============================================================================
-- Habit Tracker — seed data (local development)
-- Runs automatically after migrations on `supabase db reset`.
--
-- Creates:
--   * one demo auth user  (demo@habittracker.app / password123)
--   * the 5 habits from the prototype
--   * ~100 days of backdated logs, tuned so CURRENT streaks match the prototype
--     (Run 12 · Meditate 7 · Water 3 · Read 21 · No Social Media 5)
--   * a streak-freeze example, reminders, and a few achievements
--
-- All dates are relative to current_date, so streaks stay correct whenever you
-- reset. Runs as the postgres role, so RLS is bypassed for the insert.
--
-- NOTE: total-completion counts here are illustrative and won't exactly equal
-- the prototype's totals — the point is functional streaks/rates/heatmap.
-- ============================================================================

-- Fixed UUIDs so the data is stable across resets ---------------------------
--   user : a0000000-0000-4000-a000-000000000001
--   habits: 10.. Run  20.. Meditate  30.. Water  40.. Read  50.. No Social

-- ----------------------------------------------------------------------------
-- 1. Demo auth user  (trigger handle_new_user() creates the profiles row)
-- ----------------------------------------------------------------------------
-- NOTE: the empty-string token columns are required. GoTrue's login flow scans
-- these into non-nullable Go strings; leaving them NULL makes sign-in 500 with
-- "unexpected_failure".
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-4000-a000-000000000001',
  'authenticated', 'authenticated', 'demo@habittracker.app',
  crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Demo User"}',
  now() - interval '400 days', now(),
  '', '', '', '', '', '', '', ''
)
on conflict (id) do nothing;

-- Email identity so the user can actually sign in locally
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values (
  gen_random_uuid(),
  'a0000000-0000-4000-a000-000000000001',
  'a0000000-0000-4000-a000-000000000001',
  jsonb_build_object('sub','a0000000-0000-4000-a000-000000000001','email','demo@habittracker.app'),
  'email', now(), now(), now()
)
on conflict do nothing;

-- Flesh out the auto-created profile
update public.profiles
set display_name          = 'Demo User',
    avatar_emoji          = '🙂',
    theme                 = 'system',
    week_start            = 0,
    timezone              = 'America/New_York',
    streak_freeze_balance = 2,
    created_at            = now() - interval '400 days'
where id = 'a0000000-0000-4000-a000-000000000001';

-- ----------------------------------------------------------------------------
-- 2. Habits
-- ----------------------------------------------------------------------------
insert into public.habits
  (id, user_id, name, icon, color, category, type, target, unit,
   freq_type, freq_target, freq_days, is_bad, sort_order, created_at)
values
  ('10000000-0000-4000-a000-000000000001','a0000000-0000-4000-a000-000000000001',
   'Morning Run','🏃','#c67139','Fitness','binary',   null, null,'daily',null,null,false,0, now() - interval '120 days'),
  ('20000000-0000-4000-a000-000000000001','a0000000-0000-4000-a000-000000000001',
   'Meditate','🧘','#7a8a5e','Wellness','duration',  20,  'min','daily',null,null,false,1, now() - interval '120 days'),
  ('30000000-0000-4000-a000-000000000001','a0000000-0000-4000-a000-000000000001',
   'Drink Water','💧','#4a90d9','Health','quantity',  8,'glasses','daily',null,null,false,2, now() - interval '120 days'),
  ('40000000-0000-4000-a000-000000000001','a0000000-0000-4000-a000-000000000001',
   'Read','📚','#8a6a4a','Growth','duration',        30,  'min','daily',null,null,false,3, now() - interval '120 days'),
  ('50000000-0000-4000-a000-000000000001','a0000000-0000-4000-a000-000000000001',
   'No Social Media','📵','#c0504a','Wellness','binary', null,null,'daily',null,null,true, 4, now() - interval '120 days')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Habit logs  (backdated; g = days ago, 0 = today)
--    Pattern per habit: the most recent `streak` days are completed, the day
--    just before is a miss (caps the current streak), older days follow a
--    deterministic pattern to populate history + the heatmap.
-- ----------------------------------------------------------------------------

-- Morning Run — current streak 12
insert into public.habit_logs (user_id, habit_id, log_date, status, value, completed_at)
select 'a0000000-0000-4000-a000-000000000001','10000000-0000-4000-a000-000000000001',
       current_date - g, 'completed', null,
       (current_date - g)::timestamp + time '07:00'
from generate_series(0,110) g
where g < 12 or (g > 12 and g % 3 <> 0);

-- Meditate — current streak 7
insert into public.habit_logs (user_id, habit_id, log_date, status, value, completed_at)
select 'a0000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000001',
       current_date - g, 'completed', 15 + (g % 3) * 5,
       (current_date - g)::timestamp + time '21:00'
from generate_series(0,110) g
where g < 7 or (g > 7 and g % 4 <> 0);

-- Drink Water — current streak 3, with a STREAK FREEZE at g=3 (demonstrates
-- that 'frozen' preserves the streak); g=4 is a genuine miss that ends it.
insert into public.habit_logs (user_id, habit_id, log_date, status, value, completed_at)
select 'a0000000-0000-4000-a000-000000000001','30000000-0000-4000-a000-000000000001',
       current_date - g, 'completed', 6 + (g % 3),
       (current_date - g)::timestamp + time '12:00'
from generate_series(0,110) g
where g < 3 or (g > 4 and g % 5 <> 0);

insert into public.habit_logs (user_id, habit_id, log_date, status, value, note, completed_at)
values ('a0000000-0000-4000-a000-000000000001','30000000-0000-4000-a000-000000000001',
        current_date - 3, 'frozen', null, 'Used a streak freeze 🧊',
        (current_date - 3)::timestamp + time '12:00');

-- Read — current streak 21
insert into public.habit_logs (user_id, habit_id, log_date, status, value, completed_at)
select 'a0000000-0000-4000-a000-000000000001','40000000-0000-4000-a000-000000000001',
       current_date - g, 'completed', 30,
       (current_date - g)::timestamp + time '22:00'
from generate_series(0,110) g
where g < 21 or (g > 21 and g % 6 <> 0);

-- No Social Media — current streak 5 (a "quit" habit; completed = avoided)
insert into public.habit_logs (user_id, habit_id, log_date, status, value, completed_at)
select 'a0000000-0000-4000-a000-000000000001','50000000-0000-4000-a000-000000000001',
       current_date - g, 'completed', null,
       (current_date - g)::timestamp + time '23:00'
from generate_series(0,110) g
where g < 5 or (g > 5 and g % 4 <> 0);

-- ----------------------------------------------------------------------------
-- 4. Reminders
-- ----------------------------------------------------------------------------
insert into public.reminders (user_id, habit_id, time_of_day, days_of_week, enabled)
values
  ('a0000000-0000-4000-a000-000000000001','10000000-0000-4000-a000-000000000001','07:00','{1,2,3,4,5}', true),  -- Run, weekdays
  ('a0000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000001','21:00','{0,1,2,3,4,5,6}', true), -- Meditate, daily
  ('a0000000-0000-4000-a000-000000000001','40000000-0000-4000-a000-000000000001','22:00','{0,1,2,3,4,5,6}', true); -- Read, daily

-- ----------------------------------------------------------------------------
-- 5. Achievements  (historically earned; matches the Stats screen)
-- ----------------------------------------------------------------------------
insert into public.achievements (user_id, habit_id, kind, achieved_at)
values
  ('a0000000-0000-4000-a000-000000000001','10000000-0000-4000-a000-000000000001','streak_7',  now() - interval '30 days'),
  ('a0000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000001','streak_7',  now() - interval '60 days'),
  ('a0000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000001','streak_30', now() - interval '20 days'),
  ('a0000000-0000-4000-a000-000000000001','40000000-0000-4000-a000-000000000001','streak_7',  now() - interval '80 days'),
  ('a0000000-0000-4000-a000-000000000001','40000000-0000-4000-a000-000000000001','streak_30', now() - interval '15 days')
on conflict do nothing;

-- ============================================================================
-- Verify after reset:
--   select name, public.current_streak(id) from public.habits order by sort_order;
--   -- expect: Run 12 · Meditate 7 · Drink Water 3 · Read 21 · No Social Media 5
--   select * from public.habit_stats;
--   -- sign in locally as demo@habittracker.app / password123
-- ============================================================================
