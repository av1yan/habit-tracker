// SQLite adapter interface.
//
// The local layer depends only on this small surface, so you can back it with
// expo-sqlite (adapter provided), op-sqlite, better-sqlite3 (tests), etc.
// All methods are async to fit React Native SQLite drivers.

export type SqlParam = string | number | null

export interface SqliteAdapter {
  /** Run one or more statements with no params (used for DDL). */
  exec(sql: string): Promise<void>
  /** Run a single write statement. */
  run(sql: string, params?: SqlParam[]): Promise<void>
  /** Query multiple rows. */
  all<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>
  /** Query a single row (or null). */
  get<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T | null>
  /** Run `fn` inside a transaction; roll back if it throws. */
  tx(fn: () => Promise<void>): Promise<void>
}
