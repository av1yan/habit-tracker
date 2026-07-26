// LocalDB — the SQLite mirror. Generic row storage with sync bookkeeping.
//
//   * writeLocal / softDelete  → user edits: bump updated_at, mark _dirty=1
//   * getDirty / clearDirty    → used by the push half of the sync engine
//   * applyRemote              → used by the pull half (last-write-wins)
//   * getCursor / setCursor    → per-table "pulled up to" watermark

import type { SqliteAdapter, SqlParam } from './adapter'
import { buildSchemaSql } from './schema'
import { decodeRow, decodeRows, encodeRow } from './serialize'
import { TABLE_BY_NAME, type TableName } from './tables'
import { nowISO } from './util'

type Row = Record<string, unknown>

/** Parse an ISO timestamp to epoch ms (handles both `Z` and `+00:00`). */
function epoch(ts: unknown): number {
  const n = new Date(String(ts)).getTime()
  return Number.isNaN(n) ? 0 : n
}

export class LocalDB {
  constructor(private readonly a: SqliteAdapter) {}

  /** Create tables + indexes. Safe to call on every launch. */
  async init(): Promise<void> {
    await this.a.exec(buildSchemaSql())
  }

  // -- session ---------------------------------------------------------------

  async setUserId(id: string): Promise<void> {
    await this.a.run(
      `INSERT INTO _kv (key, value) VALUES ('user_id', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [id],
    )
  }

  async getUserId(): Promise<string> {
    const row = await this.a.get<{ value: string }>(
      `SELECT value FROM _kv WHERE key = 'user_id'`,
    )
    if (!row) throw new Error('No local user id — call setUserId() after login')
    return row.value
  }

  /** Wipe all synced data (e.g. on sign-out). Keeps the schema. */
  async clearAll(): Promise<void> {
    await this.a.tx(async () => {
      for (const t of Object.keys(TABLE_BY_NAME)) await this.a.run(`DELETE FROM ${t}`)
      await this.a.run(`DELETE FROM _sync_meta`)
      await this.a.run(`DELETE FROM _kv`)
    })
  }

  // -- reads (decoded) -------------------------------------------------------

  async getById<T = Row>(table: TableName, id: string): Promise<T | null> {
    const row = await this.a.get(`SELECT * FROM ${table} WHERE id = ?`, [id])
    return decodeRow<T>(table, row)
  }

  async list<T = Row>(
    table: TableName,
    where = '',
    params: SqlParam[] = [],
    orderBy = '',
  ): Promise<T[]> {
    const w = where ? ` WHERE ${where}` : ''
    const o = orderBy ? ` ORDER BY ${orderBy}` : ''
    const rows = await this.a.all(`SELECT * FROM ${table}${w}${o}`, params)
    return decodeRows<T>(table, rows)
  }

  async getOne<T = Row>(
    table: TableName,
    where: string,
    params: SqlParam[] = [],
  ): Promise<T | null> {
    const row = await this.a.get(`SELECT * FROM ${table} WHERE ${where} LIMIT 1`, [...params])
    return decodeRow<T>(table, row)
  }

  /** Escape hatch for aggregates (e.g. heatmap counts). Rows are NOT decoded. */
  async raw<T = Row>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    return this.a.all<T>(sql, params)
  }

  // -- local writes ----------------------------------------------------------

  /**
   * Upsert a domain row from a LOCAL edit. Bumps updated_at and marks the row
   * dirty so the next push sends it. `row` may be partial for updates (must
   * include `id`); creates must include all NOT-NULL columns.
   */
  async writeLocal(table: TableName, row: Row & { id: string }): Promise<void> {
    const withMeta = { ...row, updated_at: nowISO() }
    await this.upsertEncoded(table, encodeRow(table, withMeta), 1)
  }

  /** Soft-delete a row locally (tombstone) so the deletion syncs. */
  async softDelete(table: TableName, id: string): Promise<void> {
    if (!TABLE_BY_NAME[table].hasDeletedAt) {
      throw new Error(`${table} has no deleted_at`)
    }
    await this.writeLocal(table, { id, deleted_at: nowISO() })
  }

  // -- sync: push side -------------------------------------------------------

  async getDirty<T = Row>(table: TableName): Promise<T[]> {
    const rows = await this.a.all(`SELECT * FROM ${table} WHERE _dirty = 1`, [])
    return decodeRows<T>(table, rows)
  }

  /**
   * Clear the dirty flag for rows that were successfully pushed — but only if
   * their updated_at still matches, so an edit made *during* the push isn't
   * silently marked clean.
   */
  async clearDirty(table: TableName, entries: { id: string; updated_at: string }[]): Promise<void> {
    await this.a.tx(async () => {
      for (const e of entries) {
        await this.a.run(
          `UPDATE ${table} SET _dirty = 0 WHERE id = ? AND updated_at = ?`,
          [e.id, e.updated_at],
        )
      }
    })
  }

  // -- sync: pull side -------------------------------------------------------

  /**
   * Apply rows pulled from the server. Last-write-wins:
   *   - never clobber a locally-dirty row (its push will retry)
   *   - otherwise overwrite only if the remote copy is newer (or new to us)
   */
  async applyRemote(table: TableName, remoteRows: Row[]): Promise<void> {
    await this.a.tx(async () => {
      for (const remote of remoteRows) {
        const local = await this.a.get<{ updated_at: string; _dirty: number }>(
          `SELECT updated_at, _dirty FROM ${table} WHERE id = ?`,
          [remote.id as string],
        )
        if (local) {
          if (local._dirty === 1) continue
          // Compare by epoch: server sends "...+00:00", local writes "...Z".
          if (epoch(local.updated_at) >= epoch(remote.updated_at as string)) continue
        }
        await this.upsertEncoded(table, encodeRow(table, remote), 0)
      }
    })
  }

  // -- cursors ---------------------------------------------------------------

  async getCursor(table: TableName): Promise<string> {
    const row = await this.a.get<{ last_pulled_at: string }>(
      `SELECT last_pulled_at FROM _sync_meta WHERE table_name = ?`,
      [table],
    )
    return row?.last_pulled_at ?? '1970-01-01T00:00:00.000Z'
  }

  async setCursor(table: TableName, ts: string): Promise<void> {
    await this.a.run(
      `INSERT INTO _sync_meta (table_name, last_pulled_at) VALUES (?, ?)
       ON CONFLICT(table_name) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`,
      [table, ts],
    )
  }

  // -- internal --------------------------------------------------------------

  private async upsertEncoded(table: TableName, encoded: Row, dirty: 0 | 1): Promise<void> {
    const cols = Object.keys(encoded)
    if (cols.length === 0) return
    const allCols = [...cols, '_dirty']
    const placeholders = allCols.map(() => '?').join(', ')
    const updates = [...cols.map((c) => `${c} = excluded.${c}`), `_dirty = excluded._dirty`].join(
      ', ',
    )
    const params = [...cols.map((c) => encoded[c] as SqlParam), dirty]
    await this.a.run(
      `INSERT INTO ${table} (${allCols.join(', ')}) VALUES (${placeholders})
       ON CONFLICT(id) DO UPDATE SET ${updates}`,
      params,
    )
  }
}
