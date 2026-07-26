// Bootstrap for the offline-first stack: local SQLite mirror + sync engine.
//
//   import { createExpoAdapter } from './src/local'
//   import { bootstrapOffline } from './src/offline'
//   import { createDbClient } from './src/data'
//
//   const supa = createDbClient(URL, ANON_KEY)
//   const { local, engine } = await bootstrapOffline(supa, await createExpoAdapter(), {
//     isOnline: () => netInfo.isConnected === true,
//   })
//
//   // after the user signs in:
//   await onSignIn(local, engine, session.user.id)
//   // screens now read/write `local` (offline-first); `engine` syncs in the bg.
//
//   // on sign-out:
//   await onSignOut(local, engine)

import type { DB } from './data/client'
import { LocalDB } from './local/db'
import type { SqliteAdapter } from './local/adapter'
import { SyncEngine, type SyncOptions } from './sync/engine'

export interface OfflineStack {
  local: LocalDB
  engine: SyncEngine
}

export async function bootstrapOffline(
  supa: DB,
  adapter: SqliteAdapter,
  syncOptions: SyncOptions = {},
): Promise<OfflineStack> {
  const local = new LocalDB(adapter)
  await local.init()
  const engine = new SyncEngine(local, supa, syncOptions)
  return { local, engine }
}

/**
 * Call after a successful sign-in. Records the user id, does an initial full
 * sync (so the mirror is populated before the UI reads it), then starts the
 * background loop.
 */
export async function onSignIn(
  local: LocalDB,
  engine: SyncEngine,
  userId: string,
  intervalMs = 30_000,
): Promise<void> {
  await local.setUserId(userId)
  await engine.syncOnce() // wait for the first pull before showing data
  engine.start(intervalMs)
}

/**
 * Call on sign-out. Stops syncing and wipes local data so the next user starts
 * clean. (Do a final `engine.syncOnce()` beforehand if you want to flush
 * pending changes first.)
 */
export async function onSignOut(local: LocalDB, engine: SyncEngine): Promise<void> {
  engine.stop()
  await local.clearAll()
}
