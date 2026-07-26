// SqliteAdapter backed by Node's built-in node:sqlite (synchronous, in-memory).
// Used by the sync tests so the real SQL in LocalDB runs against a real engine
// with no native build step.

import { DatabaseSync } from 'node:sqlite'
import type { SqliteAdapter, SqlParam } from '../../local/adapter'

export function createNodeSqliteAdapter(path = ':memory:'): {
  adapter: SqliteAdapter
  close: () => void
} {
  const db = new DatabaseSync(path)
  const adapter: SqliteAdapter = {
    async exec(sql) {
      db.exec(sql)
    },
    async run(sql, params: SqlParam[] = []) {
      db.prepare(sql).run(...(params as never[]))
    },
    async all(sql, params: SqlParam[] = []) {
      return db.prepare(sql).all(...(params as never[])) as never
    },
    async get(sql, params: SqlParam[] = []) {
      return (db.prepare(sql).get(...(params as never[])) ?? null) as never
    },
    async tx(fn) {
      db.exec('BEGIN')
      try {
        await fn()
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
  }
  return { adapter, close: () => db.close() }
}
