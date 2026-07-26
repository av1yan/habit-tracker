// Generates the local SQLite DDL from the table metadata.
// Every mirrored table gets a `_dirty` flag (1 = has un-pushed local changes).

import { SQLITE_TYPE, TABLES } from './tables'

export function buildSchemaSql(): string {
  const statements: string[] = []

  for (const t of TABLES) {
    const cols = Object.entries(t.columns).map(([name, type]) => {
      const pk = name === 'id' ? ' PRIMARY KEY' : ''
      return `  ${name} ${SQLITE_TYPE[type]}${pk}`
    })
    cols.push('  _dirty INTEGER NOT NULL DEFAULT 0')
    statements.push(`CREATE TABLE IF NOT EXISTS ${t.name} (\n${cols.join(',\n')}\n);`)

    // A dirty index per table makes push scans cheap.
    statements.push(
      `CREATE INDEX IF NOT EXISTS ${t.name}_dirty_idx ON ${t.name} (_dirty) WHERE _dirty = 1;`,
    )
    if ('updated_at' in t.columns) {
      statements.push(
        `CREATE INDEX IF NOT EXISTS ${t.name}_updated_idx ON ${t.name} (updated_at);`,
      )
    }
  }

  // habit_logs read paths (today / week / heatmap)
  statements.push(
    `CREATE INDEX IF NOT EXISTS habit_logs_habit_date_idx ON habit_logs (habit_id, log_date);`,
    `CREATE INDEX IF NOT EXISTS habit_logs_date_idx ON habit_logs (log_date);`,
  )

  // Sync bookkeeping.
  statements.push(
    `CREATE TABLE IF NOT EXISTS _sync_meta (
  table_name TEXT PRIMARY KEY,
  last_pulled_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);`,
    `CREATE TABLE IF NOT EXISTS _kv (
  key TEXT PRIMARY KEY,
  value TEXT
);`,
  )

  return statements.join('\n\n')
}
