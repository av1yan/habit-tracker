// Offline achievements repo — a small persistence store for earned milestones,
// backed by SQLite and synced like every other table. The *catalog* (which
// milestones exist and their thresholds) lives in the app layer
// (lib/achievements.ts); this repo just records that a given kind was earned,
// once, with a date — so it can be celebrated a single time.

import type { LocalDB } from './db'
import { newId, nowISO } from './util'
import type { Achievement } from '../../supabase/types/database.types'

export async function listEarned(local: LocalDB): Promise<Achievement[]> {
  return local.list<Achievement>('achievements', 'deleted_at IS NULL', [], 'achieved_at ASC')
}

/** The set of account-wide milestone kinds already recorded as earned. */
export async function earnedKinds(local: LocalDB): Promise<Set<string>> {
  const rows = await local.list<Achievement>(
    'achievements',
    'deleted_at IS NULL AND habit_id IS NULL',
    [],
  )
  return new Set(rows.map((r) => r.kind))
}

/**
 * Idempotently record an account-wide milestone as earned. Returns the new row,
 * or null if it was already present (so the caller knows whether to celebrate).
 */
export async function award(local: LocalDB, kind: string): Promise<Achievement | null> {
  const existing = await local.getOne<Achievement>(
    'achievements',
    'kind = ? AND habit_id IS NULL AND deleted_at IS NULL',
    [kind],
  )
  if (existing) return null

  const now = nowISO()
  const row: Achievement = {
    id: newId(),
    user_id: await local.getUserId(),
    habit_id: null,
    kind,
    achieved_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  await local.writeLocal('achievements', row)
  return row
}
