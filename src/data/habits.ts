// Habit CRUD. Reads exclude soft-deleted rows; deletes are soft (tombstones)
// so they propagate through sync.

import type { DB } from './client'
import { check, currentUserId, maybeOne, one, unwrap } from './helpers'
import type {
  Habit,
  TablesInsert,
  TablesUpdate,
} from '../../supabase/types/database.types'

/** Fields the caller supplies when creating a habit (server manages the rest). */
export type CreateHabitInput = Omit<TablesInsert<'habits'>, 'id' | 'user_id'>

/** Editable fields on an existing habit. */
export type UpdateHabitPatch = Omit<
  TablesUpdate<'habits'>,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'
>

/** Active, non-archived habits in display order. */
export async function listHabits(db: DB): Promise<Habit[]> {
  return unwrap(
    await db
      .from('habits')
      .select('*')
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('sort_order', { ascending: true }),
  )
}

/** Includes archived habits (for a "manage habits" screen). */
export async function listAllHabits(db: DB): Promise<Habit[]> {
  return unwrap(
    await db
      .from('habits')
      .select('*')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
  )
}

export async function getHabit(db: DB, id: string): Promise<Habit | null> {
  return maybeOne(
    await db.from('habits').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
  )
}

export async function createHabit(db: DB, input: CreateHabitInput): Promise<Habit> {
  const user_id = await currentUserId(db)
  return one(
    await db
      .from('habits')
      .insert({ ...input, user_id })
      .select('*')
      .single(),
  )
}

export async function updateHabit(
  db: DB,
  id: string,
  patch: UpdateHabitPatch,
): Promise<Habit> {
  // updated_at is bumped by the DB trigger.
  return one(
    await db.from('habits').update(patch).eq('id', id).select('*').single(),
  )
}

export async function archiveHabit(db: DB, id: string): Promise<Habit> {
  return updateHabit(db, id, { archived_at: new Date().toISOString() })
}

export async function unarchiveHabit(db: DB, id: string): Promise<Habit> {
  return updateHabit(db, id, { archived_at: null })
}

/** Soft delete — sets deleted_at so the removal syncs to other devices. */
export async function deleteHabit(db: DB, id: string): Promise<void> {
  check(
    await db.from('habits').update({ deleted_at: new Date().toISOString() }).eq('id', id),
  )
}

/** Persist a new ordering. `orderedIds` is the desired top-to-bottom order. */
export async function reorderHabits(db: DB, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) => db.from('habits').update({ sort_order: i }).eq('id', id)),
  )
}
