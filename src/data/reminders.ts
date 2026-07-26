// Reminder schedules. These rows drive on-device local notifications; the
// server only stores the schedule so it syncs across devices.

import type { DB } from './client'
import { check, currentUserId, one, unwrap } from './helpers'
import type {
  Reminder,
  TablesInsert,
  TablesUpdate,
} from '../../supabase/types/database.types'

export type CreateReminderInput = Omit<TablesInsert<'reminders'>, 'id' | 'user_id'>
export type UpdateReminderPatch = Omit<
  TablesUpdate<'reminders'>,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'
>

/** All active reminders, optionally scoped to one habit. */
export async function listReminders(db: DB, habitId?: string): Promise<Reminder[]> {
  let q = db.from('reminders').select('*').is('deleted_at', null)
  if (habitId) q = q.eq('habit_id', habitId)
  return unwrap(await q.order('time_of_day', { ascending: true }))
}

export async function createReminder(
  db: DB,
  input: CreateReminderInput,
): Promise<Reminder> {
  const user_id = await currentUserId(db)
  return one(
    await db.from('reminders').insert({ ...input, user_id }).select('*').single(),
  )
}

export async function updateReminder(
  db: DB,
  id: string,
  patch: UpdateReminderPatch,
): Promise<Reminder> {
  return one(
    await db.from('reminders').update(patch).eq('id', id).select('*').single(),
  )
}

export async function setReminderEnabled(
  db: DB,
  id: string,
  enabled: boolean,
): Promise<Reminder> {
  return updateReminder(db, id, { enabled })
}

/** Soft delete so the removal syncs. */
export async function deleteReminder(db: DB, id: string): Promise<void> {
  check(
    await db
      .from('reminders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id),
  )
}
