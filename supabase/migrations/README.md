# Supabase migrations

Applies the Habit Tracker backend (see `../../BACKEND_SCHEMA.md` for the design rationale).

| File | What it does |
|---|---|
| `20260723000001_core_schema.sql` | Tables, indexes, `updated_at` triggers |
| `20260723000002_rls.sql` | Row-Level Security (own-rows-only) on every table |
| `20260723000003_auth_profile_trigger.sql` | Auto-creates a `profiles` row on signup |
| `20260723000004_stats_functions.sql` | Streaks, completion rate, heatmap, `habit_stats` view |

Run them **in order** (the timestamps guarantee this).

Demo data lives in `../seed.sql` and is applied automatically by `supabase db reset` (see "Verify" below).

## Apply locally (recommended first)

```bash
supabase start
supabase db reset          # applies all migrations to the local stack
```

## Apply to a remote project

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## Quick sanity checks (run in SQL editor once a test user exists)

```sql
-- current streak for a habit
select public.current_streak('<habit-uuid>');

-- 90-day rate
select public.completion_rate('<habit-uuid>', current_date - 89, current_date);

-- heatmap for the last 90 days (runs as the logged-in user)
select * from public.heatmap(current_date - 89, current_date);

-- everything for the Stats screen
select * from public.habit_stats;
```

## Defaults chosen (flip these if you disagree)

- **`streak_freeze_balance` starts at 2** — matches the "2 available" in the design (`profiles` default).
- **Achievements table included** — only needed for "celebrate a milestone once"; safe to ignore otherwise.
- **Reminders are schedule-only** — notifications fire locally on device; no server push wired up.
- **Streak semantics** — `frozen` preserves but doesn't add; today is allowed to be unfinished; `skipped`/missing on an expected past day breaks the streak.
- **Count/interval streaks are approximated as daily** — see the note in `20260723000004_stats_functions.sql` if you want true week-based streaks for "3×/week" habits.
