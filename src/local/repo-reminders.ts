// Offline reminders repo — mirrors src/data/reminders.ts.

import type { LocalDB } from './db'
import { newId, nowISO } from './util'
import type { Reminder } from '../../supabase/types/database.types'
import type { CreateReminderInput, UpdateReminderPatch } from '../data/reminders'

export async function listReminders(local: LocalDB, habitId?: string): Promise<Reminder[]> {
  const where = habitId ? 'deleted_at IS NULL AND habit_id = ?' : 'deleted_at IS NULL'
  const params = habitId ? [habitId] : []
  return local.list<Reminder>('reminders', where, params, 'time_of_day ASC')
}

export async function createReminder(
  local: LocalDB,
  input: CreateReminderInput,
): Promise<Reminder> {
  const now = nowISO()
  const row: Reminder = {
    id: newId(),
    user_id: await local.getUserId(),
    habit_id: input.habit_id,
    time_of_day: input.time_of_day,
    days_of_week: input.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
    enabled: input.enabled ?? true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  await local.writeLocal('reminders', row)
  return row
}

export async function updateReminder(
  local: LocalDB,
  id: string,
  patch: UpdateReminderPatch,
): Promise<Reminder> {
  await local.writeLocal('reminders', { id, ...patch })
  const row = await local.getById<Reminder>('reminders', id)
  if (!row) throw new Error(`reminder ${id} not found`)
  return row
}

export async function setReminderEnabled(
  local: LocalDB,
  id: string,
  enabled: boolean,
): Promise<Reminder> {
  return updateReminder(local, id, { enabled })
}

export async function deleteReminder(local: LocalDB, id: string): Promise<void> {
  await local.softDelete('reminders', id)
}
