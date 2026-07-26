# Habit Tracker — Backend Schema (Design)

**Stack:** Supabase (Postgres + Auth + Row-Level Security).
**Sync model:** Offline-first. Device holds a local SQLite mirror; changes sync to Postgres.
**Status:** Design only — nothing has been created.

---

## Design principles (offline-first)

1. **Client-generated UUID primary keys.** Devices create rows offline; no server round-trip to get an ID.
2. **`updated_at` on every table.** Conflict resolution = last-write-wins by `updated_at`.
3. **Soft deletes via `deleted_at` (tombstones).** Deletes must sync to other devices, so rows are marked deleted, not removed. A background job hard-deletes old tombstones later.
4. **`log_date` is a `DATE`.** A completion belongs to the user's *local calendar day*, decided on-device. Never a timestamp.
5. **Streaks, completion %, heatmap are DERIVED** from `habit_logs`. Cached numbers on the client are fine, but the log table is the single source of truth.
6. **Every table has `user_id` + RLS** so a user can only ever read/write their own rows.

---

## Tables

### `profiles`
Extends `auth.users` (Supabase Auth owns identity/passwords).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | = `auth.users.id` |
| `display_name` | `text` | |
| `avatar_emoji` | `text` | the 🙂 on the profile screen |
| `theme` | `text` | `'system' \| 'light' \| 'dark'` |
| `week_start` | `smallint` | 0 = Sunday, 1 = Monday |
| `timezone` | `text` | IANA tz, e.g. `America/New_York` |
| `streak_freeze_balance` | `int` | freezes available (design shows "2 available") |
| `created_at` | `timestamptz` | "Member since" |
| `updated_at` | `timestamptz` | |

### `habits`
One row per habit the user tracks.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | client-generated |
| `user_id` | `uuid` FK → auth.users | |
| `name` | `text` | "Morning Run" |
| `icon` | `text` | emoji |
| `color` | `text` | hex, e.g. `#c67139` |
| `category` | `text` | Health / Fitness / Wellness / Growth / Work / Personal |
| `type` | `text` | `'binary' \| 'quantity' \| 'duration'` |
| `target` | `numeric` | null for binary; e.g. 8 (glasses), 20 (min) |
| `unit` | `text` | null for binary; "glasses", "min" |
| `freq_type` | `text` | `'daily' \| 'weekly_count' \| 'specific_days' \| 'interval'` |
| `freq_target` | `int` | weekly_count → times/week (3× / week); interval → every N days |
| `freq_days` | `int[]` | specific_days → weekday numbers 0–6 (e.g. Weekdays = {1,2,3,4,5}) |
| `is_bad` | `boolean` | true = "Quit" habit, false = "Build" |
| `sort_order` | `int` | drag-to-reorder |
| `archived_at` | `timestamptz` | archive without delete |
| `created_at` / `updated_at` / `deleted_at` | `timestamptz` | sync metadata |

> **Frequency model note:** the four columns above express all of your design's options —
> Daily = `freq_type:'daily'`; Weekdays = `specific_days` + `{1,2,3,4,5}`; 3× / week = `weekly_count` + `freq_target:3`; Weekly = `weekly_count` + `freq_target:1`. Extensible to "every 3 days" later without a migration.

### `habit_logs`
The heart of the app. One row per habit per day it was acted on.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | client-generated |
| `user_id` | `uuid` FK | |
| `habit_id` | `uuid` FK → habits | |
| `log_date` | `date` | user's local calendar day |
| `status` | `text` | `'completed' \| 'skipped' \| 'frozen'` |
| `value` | `numeric` | for quantity/duration (e.g. 6 of 8 glasses); null for binary |
| `note` | `text` | "How did it go?" note |
| `completed_at` | `timestamptz` | exact moment toggled (for "best time of day" insights later) |
| `created_at` / `updated_at` / `deleted_at` | `timestamptz` | sync metadata |

**Constraint:** `UNIQUE (habit_id, log_date)` — at most one active log per habit per day. (Enforced as a partial unique index `WHERE deleted_at IS NULL`.)

### `reminders`
Per-habit notification schedule. Notifications fire **locally on-device**; this table just stores the schedule so it syncs across devices.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK | |
| `habit_id` | `uuid` FK → habits | |
| `time_of_day` | `time` | local time |
| `days_of_week` | `int[]` | which days it fires (0–6) |
| `enabled` | `boolean` | |
| `created_at` / `updated_at` / `deleted_at` | `timestamptz` | |

### `achievements` (optional for MVP)
Only needed if you want to celebrate a milestone **exactly once** and store the date. Otherwise compute 7/30/100-day badges on the fly from streaks.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK | |
| `habit_id` | `uuid` FK → habits | null = account-wide achievement |
| `kind` | `text` | `'streak_7' \| 'streak_30' \| 'streak_100'` … |
| `achieved_at` | `timestamptz` | |

---

## Streak freezes

The 🧊 freeze is modeled without a dedicated table:
- **Balance** lives in `profiles.streak_freeze_balance`.
- **Using a freeze** = insert a `habit_logs` row with `status = 'frozen'` for that day, and decrement the balance.
- Streak computation treats `'frozen'` days as *not breaking* the streak but *not counting* as a completion.

---

## Derived stats (views / RPC — not stored)

Computed from `habit_logs`, exposed to the client so the phone doesn't recompute everything:

- **`current_streak(habit)`** — consecutive expected days ending today that are `completed` or `frozen`.
- **`longest_streak(habit)`** — max run historically.
- **`completion_rate(habit, window)`** — completed ÷ expected occurrences over a window (respects `freq_*`, so a 3×/week habit isn't penalized for the other 4 days).
- **`heatmap(user, from, to)`** — count of completions per day for the calendar heatmap.

> Streak logic is easiest as a Postgres **RPC function** (`plpgsql`) rather than a plain view, because "expected days" depends on each habit's frequency. Client can also compute these locally from its SQLite mirror for offline display, using the same rules.

---

## Row-Level Security (every table)

```sql
alter table <t> enable row level security;

create policy "own rows - select" on <t>
  for select using (user_id = auth.uid());
create policy "own rows - modify" on <t>
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

`profiles` uses `id = auth.uid()` instead of `user_id`.

---

## Sync protocol (last-write-wins)

**Pull:** client keeps a `last_pulled_at` cursor. On sync it requests, per table,
`WHERE user_id = auth.uid() AND updated_at > last_pulled_at` — **including** rows with a
non-null `deleted_at` (tombstones), so deletes propagate. Apply to local SQLite.

**Push:** client upserts changed rows by `id`. Server keeps the row with the newer
`updated_at`. Because IDs are client-generated UUIDs, offline inserts never collide.

**Delete:** never a hard `DELETE` from the client — set `deleted_at = now()`, bump `updated_at`,
let it sync. A scheduled server job purges tombstones older than ~90 days.

**Conflict edge case:** two devices toggle the same habit on the same day → the
`UNIQUE (habit_id, log_date)` index means both try to write the same logical row; last-write-wins
by `updated_at` resolves it cleanly.

---

## Auth notes

- Supabase Auth: **email/password + Sign in with Apple + Google**.
- App Store rule: if you offer Google sign-in, you **must** also offer Sign in with Apple.
- A DB trigger on `auth.users` insert should create the matching `profiles` row.

---

## Open questions before build

1. **Achievements** — compute-on-the-fly (simpler) or store in a table (needed only for "celebrate once")?
2. **Reminders** — confirm local-only notifications for MVP (no server push). Server push only becomes necessary if you add social/accountability.
3. **Quantity/duration partial progress** — should `value` accumulate through the day (6→7→8 glasses) or just record the final number? Affects whether the client writes on every increment.
