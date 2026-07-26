# Offline-first sync engine

The app reads and writes a **local SQLite mirror** (instant, works with no
network). A background **sync engine** reconciles that mirror with Supabase.

```
   UI ──► src/local (SQLite repos)  ◄──►  SyncEngine  ◄──►  Supabase (Postgres)
          instant, offline               push / pull          source of record
```

## Layers

| Path | Role |
|---|---|
| `src/data` | **Cloud DAL** — typed calls straight to Supabase (online-only). |
| `src/local` | **Local mirror** — SQLite schema, `LocalDB`, and repos that mirror the DAL API but read/write SQLite. Screens use these. |
| `src/sync` | **SyncEngine** — moves rows between SQLite and Supabase. |
| `src/offline.ts` | Bootstrap + sign-in/out helpers. |

The local repos (`local/repo-*.ts`) expose the **same function names** as the
DAL (`getToday`, `toggleHabit`, `createHabit`, …) so screen code doesn't change
based on connectivity. They're namespaced in the barrel to avoid clashing with
the DAL: `import { logs, stats } from './src/local'`.

## How a cycle works — push, then pull

**Push** (`profiles → habits → habit_logs → reminders → achievements`, FK-safe):
send every row with `_dirty = 1`. `created_at`/`updated_at` are **omitted** so
the database assigns them — the server clock is authoritative. On success the
dirty flag is cleared, but only for rows whose `updated_at` is unchanged (so an
edit made *during* the push isn't lost).

**Pull** (same order): for each table fetch `updated_at > cursor` (tombstones
included), advancing a per-table watermark stored in `_sync_meta`. Rows are
applied **last-write-wins**:

- never overwrite a locally-`_dirty` row (its push retries next cycle);
- otherwise overwrite only if the remote copy is newer (compared by parsed
  epoch, since server sends `+00:00` and local writes `Z`).

Push-before-pull means that by pull time there are normally no dirty rows, so
the pull safely converges the mirror to the server's authoritative copy.

## Writes & deletes

- Every local write goes through `LocalDB.writeLocal`, which bumps `updated_at`
  and sets `_dirty = 1`.
- Deletes are **soft** (`softDelete` sets `deleted_at`) so the removal
  propagates; reads filter `deleted_at IS NULL`. A server cron purges old
  tombstones (see `BACKEND_SCHEMA.md`).
- `toggleHabit` revives the existing (habit, day) row rather than inserting a
  duplicate — same invariant as the DB's partial unique index.

## Wiring (Expo / React Native)

```ts
import { createDbClient } from './src/data'
import { createExpoAdapter, logs, stats } from './src/local'
import { bootstrapOffline, onSignIn, onSignOut } from './src/offline'
import NetInfo from '@react-native-community/netinfo'

const supa = createDbClient(URL, ANON_KEY)          // pass RN AsyncStorage auth opts here
const adapter = await createExpoAdapter('habits.db')

let online = true
NetInfo.addEventListener((s) => { online = s.isConnected === true })

const { local, engine } = await bootstrapOffline(supa, adapter, {
  isOnline: () => online,
  onSync: (r) => console.log('synced', r),
})

// after auth:
await onSignIn(local, engine, session.user.id)      // seeds mirror, starts loop
engine.subscribeRealtime()                          // optional: pull on server changes

// in a screen:
const today = await logs.getToday(local)
await logs.toggleHabit(local, today.habits[0].habit.id)  // instant, offline-safe

// on logout:
await onSignOut(local, engine)
```

Also trigger `engine.syncOnce()` on app foreground and on network regain for
snappier convergence between the 30s interval ticks.

## Dependencies

- `@supabase/supabase-js` (shared with the DAL)
- `expo-sqlite` — only for `createExpoAdapter`. Using another driver? Implement
  the `SqliteAdapter` interface (`src/local/adapter.ts`); nothing else changes.

## Known limitations (MVP-acceptable, documented)

- **Last-write-wins is field-blind** — two devices editing the same row keep the
  newer whole row; there's no field-level merge. Fine for habits; revisit if you
  add collaborative/shared habits.
- **Timestamp-paginated pull** can skip rows that share the exact
  `updated_at` at a page boundary (needs > `batchSize` identical timestamps —
  very unlikely per user). A keyset `(updated_at, id)` cursor removes this.
- **Offline-created `created_at`** reflects the server insert time, not the
  offline moment (client `created_at` is server-managed on push). `profiles`
  isn't affected (trigger-set on signup).
- First sync must complete once while online to populate the mirror (handled by
  `onSignIn`).
```
