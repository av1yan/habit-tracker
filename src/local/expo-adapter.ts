// expo-sqlite implementation of SqliteAdapter (the common Expo/RN choice).
//
//   import * as SQLite from 'expo-sqlite'
//   const adapter = await createExpoAdapter('habits.db')
//
// If you use a different driver (op-sqlite, better-sqlite3, …), implement the
// SqliteAdapter interface instead — nothing else in the layer changes.

import type { SqliteAdapter, SqlParam } from './adapter'

// Minimal shape of the expo-sqlite async database we rely on.
interface ExpoDatabase {
  execAsync(sql: string): Promise<void>
  runAsync(sql: string, params?: SqlParam[]): Promise<unknown>
  getAllAsync<T>(sql: string, params?: SqlParam[]): Promise<T[]>
  getFirstAsync<T>(sql: string, params?: SqlParam[]): Promise<T | null>
  withTransactionAsync(fn: () => Promise<void>): Promise<void>
}

export function wrapExpoDatabase(db: ExpoDatabase): SqliteAdapter {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params = []) => {
      await db.runAsync(sql, params)
    },
    all: (sql, params = []) => db.getAllAsync(sql, params),
    get: (sql, params = []) => db.getFirstAsync(sql, params),
    tx: (fn) => db.withTransactionAsync(fn),
  }
}

/**
 * Convenience opener. Requires `expo-sqlite` to be installed.
 * Uses a dynamic import so the rest of the layer stays driver-agnostic.
 */
export async function createExpoAdapter(dbName = 'habit-tracker.db'): Promise<SqliteAdapter> {
  const SQLite = (await import('expo-sqlite')) as {
    openDatabaseAsync: (name: string) => Promise<ExpoDatabase>
  }
  const db = await SQLite.openDatabaseAsync(dbName)
  // WAL improves concurrent read/write on device.
  await db.execAsync('PRAGMA journal_mode = WAL;')
  return wrapExpoDatabase(db)
}
