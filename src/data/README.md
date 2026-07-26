# Data-access layer

Typed functions over Supabase, one module per concern. Framework-agnostic:
every function takes the `DB` client as its first argument, so the same code
runs in Expo/React Native, Node, or an edge function.

## Dependency

```bash
npm install @supabase/supabase-js
```

(That's the only dependency. The layer imports generated types from
`../../supabase/types/database.types` — adjust the relative path if you move
this folder into your app.)

## Setup

```ts
import { createDbClient } from './src/data'

// In React Native, pass AsyncStorage + the RN auth options here.
export const db = createDbClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

## Modules

| Module | Functions |
|---|---|
| `habits` | `listHabits`, `listAllHabits`, `getHabit`, `createHabit`, `updateHabit`, `archiveHabit`, `unarchiveHabit`, `deleteHabit`, `reorderHabits` |
| `logs` | `getToday`, `getWeek`, `getLog`, `completeHabit`, `uncompleteHabit`, `toggleHabit`, `setValue`, `setNote` |
| `freezes` | `useStreakFreeze` |
| `stats` | `getAllStats`, `getHabitStats`, `getCurrentStreak`, `getLongestStreak`, `getCompletionRate`, `getHeatmap`, `getRecentHeatmap`, `getMonthHeatmap`, `getOverallCompletion` |
| `reminders` | `listReminders`, `createReminder`, `updateReminder`, `setReminderEnabled`, `deleteReminder` |
| `profile` | `getProfile`, `updateProfile` |
| `helpers` | `toLocalISODate`, `addDays`, `dowOf`, `startOfWeek`, `monthBounds`, `currentUserId` |

## Screen → function map (from the prototype)

- **Today** → `getToday(db)` for the list + ring; `toggleHabit(db, id)` on tap.
- **Habit detail** → `getHabitStats(db, id)`, `getWeek(db, id)`, `setNote(db, id, text)`, `useStreakFreeze(db, id)`.
- **Create** → `createHabit(db, input)`.
- **Stats** → `getAllStats(db)`, `getOverallCompletion(db)`.
- **Calendar** → `getRecentHeatmap(db, 15)`, `getMonthHeatmap(db, y, m)`.
- **Profile** → `getProfile(db)`, `updateProfile(db, patch)`, reminders CRUD.

## Conventions & guarantees

- **Dates are local `YYYY-MM-DD` strings** built from local time (never
  `toISOString()`, which is UTC and would shift the day). Every write defaults
  to `toLocalISODate()` (today). Pass an explicit date to backfill.
- **Snake_case throughout** to stay 1:1 with the generated DB types — no
  mapping layer that can drift. Create/update inputs reuse `TablesInsert`/
  `TablesUpdate`, minus server-managed fields.
- **Reads exclude tombstones** (`deleted_at is null`); **deletes are soft** so
  they sync to other devices.
- **`updated_at` is set by a DB trigger**, not the client — so last-write-wins
  sync stays honest even if a client clock is wrong.
- **`toggleHabit` revives the existing row** rather than inserting a duplicate,
  keeping the one-active-log-per-day invariant and avoiding tombstone buildup.

## Offline note

This layer talks directly to Supabase (cloud-first calls). For the chosen
**offline-first** model, the intended next step is a local SQLite mirror + a
sync engine that these same function signatures can sit on top of — the DAL API
is designed to be backend-swappable so screens won't change when sync lands.
