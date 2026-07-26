// Single source of truth for the syncable tables: column names + types.
// Drives the SQLite DDL, row (de)serialization, and the sync engine, so the
// three never drift apart. Mirrors supabase/migrations/20260723000001.

export type TableName = 'profiles' | 'habits' | 'habit_logs' | 'reminders' | 'achievements'

/** Logical column type → how it's stored in SQLite / marshaled to Postgres. */
export type ColType = 'text' | 'int' | 'real' | 'bool' | 'json'

export interface TableDef {
  name: TableName
  columns: Record<string, ColType>
  /** Columns the server owns; omitted from push payloads so the DB assigns them. */
  serverManaged: string[]
  hasDeletedAt: boolean
}

export const TABLES: TableDef[] = [
  {
    name: 'profiles',
    columns: {
      id: 'text',
      display_name: 'text',
      avatar_emoji: 'text',
      theme: 'text',
      week_start: 'int',
      timezone: 'text',
      streak_freeze_balance: 'int',
      created_at: 'text',
      updated_at: 'text',
    },
    serverManaged: ['created_at', 'updated_at'],
    hasDeletedAt: false,
  },
  {
    name: 'habits',
    columns: {
      id: 'text',
      user_id: 'text',
      name: 'text',
      icon: 'text',
      color: 'text',
      category: 'text',
      type: 'text',
      target: 'real',
      unit: 'text',
      freq_type: 'text',
      freq_target: 'int',
      freq_days: 'json',
      is_bad: 'bool',
      sort_order: 'int',
      archived_at: 'text',
      created_at: 'text',
      updated_at: 'text',
      deleted_at: 'text',
    },
    serverManaged: ['created_at', 'updated_at'],
    hasDeletedAt: true,
  },
  {
    name: 'habit_logs',
    columns: {
      id: 'text',
      user_id: 'text',
      habit_id: 'text',
      log_date: 'text',
      status: 'text',
      value: 'real',
      note: 'text',
      completed_at: 'text',
      created_at: 'text',
      updated_at: 'text',
      deleted_at: 'text',
    },
    serverManaged: ['created_at', 'updated_at'],
    hasDeletedAt: true,
  },
  {
    name: 'reminders',
    columns: {
      id: 'text',
      user_id: 'text',
      habit_id: 'text',
      time_of_day: 'text',
      days_of_week: 'json',
      enabled: 'bool',
      created_at: 'text',
      updated_at: 'text',
      deleted_at: 'text',
    },
    serverManaged: ['created_at', 'updated_at'],
    hasDeletedAt: true,
  },
  {
    name: 'achievements',
    columns: {
      id: 'text',
      user_id: 'text',
      habit_id: 'text',
      kind: 'text',
      achieved_at: 'text',
      created_at: 'text',
      updated_at: 'text',
      deleted_at: 'text',
    },
    serverManaged: ['created_at', 'updated_at'],
    hasDeletedAt: true,
  },
]

export const TABLE_BY_NAME = Object.fromEntries(
  TABLES.map((t) => [t.name, t]),
) as Record<TableName, TableDef>

/** Push order: parents before children (FK-safe on the server). */
export const PUSH_ORDER: TableName[] = [
  'profiles',
  'habits',
  'habit_logs',
  'reminders',
  'achievements',
]

export const SQLITE_TYPE: Record<ColType, string> = {
  text: 'TEXT',
  int: 'INTEGER',
  real: 'REAL',
  bool: 'INTEGER',
  json: 'TEXT',
}
