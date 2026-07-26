// Row (de)serialization between the domain shape (what Supabase returns / the
// app uses) and SQLite storage.
//   bool → 0/1 · int[] (json) → JSON text · everything else stored as-is.

import { TABLE_BY_NAME, type TableName } from './tables'

type Row = Record<string, unknown>

/** Domain row → SQLite row (only the columns present on `row`). */
export function encodeRow(table: TableName, row: Row): Row {
  const def = TABLE_BY_NAME[table]
  const out: Row = {}
  for (const [col, type] of Object.entries(def.columns)) {
    if (!(col in row)) continue
    const v = row[col]
    if (v === null || v === undefined) {
      out[col] = null
    } else if (type === 'bool') {
      out[col] = v ? 1 : 0
    } else if (type === 'json') {
      out[col] = JSON.stringify(v)
    } else {
      out[col] = v as string | number
    }
  }
  return out
}

/** SQLite row → domain row. */
export function decodeRow<T = Row>(table: TableName, row: Row | null): T | null {
  if (!row) return null
  const def = TABLE_BY_NAME[table]
  const out: Row = {}
  for (const [col, type] of Object.entries(def.columns)) {
    const v = row[col]
    if (v === null || v === undefined) {
      out[col] = null
    } else if (type === 'bool') {
      out[col] = !!v
    } else if (type === 'json') {
      out[col] = typeof v === 'string' ? JSON.parse(v) : v
    } else {
      out[col] = v
    }
  }
  return out as T
}

export function decodeRows<T = Row>(table: TableName, rows: Row[]): T[] {
  return rows.map((r) => decodeRow<T>(table, r) as T)
}

/** Push payload: strip server-managed columns and the local `_dirty` flag. */
export function toRemotePayload(table: TableName, domainRow: Row): Row {
  const def = TABLE_BY_NAME[table]
  const out: Row = {}
  for (const col of Object.keys(def.columns)) {
    if (def.serverManaged.includes(col)) continue
    out[col] = domainRow[col] ?? null
  }
  return out
}
