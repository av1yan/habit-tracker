// Offline habit repo — mirrors src/data/habits.ts, backed by SQLite.

import type { LocalDB } from './db'
import { newId, nowISO } from './util'
import type { Habit } from '../../supabase/types/database.types'
import type { CreateHabitInput, UpdateHabitPatch } from '../data/habits'

export async function listHabits(local: LocalDB): Promise<Habit[]> {
  return local.list<Habit>(
    'habits',
    'deleted_at IS NULL AND archived_at IS NULL',
    [],
    'sort_order ASC',
  )
}

export async function listAllHabits(local: LocalDB): Promise<Habit[]> {
  return local.list<Habit>('habits', 'deleted_at IS NULL', [], 'sort_order ASC')
}

export async function getHabit(local: LocalDB, id: string): Promise<Habit | null> {
  return local.getOne<Habit>('habits', 'id = ? AND deleted_at IS NULL', [id])
}

export async function createHabit(local: LocalDB, input: CreateHabitInput): Promise<Habit> {
  const user_id = await local.getUserId()
  const now = nowISO()
  const row: Habit = {
    id: newId(),
    user_id,
    name: input.name,
    icon: input.icon ?? '🎯',
    color: input.color ?? '#c67139',
    category: input.category ?? 'Personal',
    type: input.type ?? 'binary',
    target: input.target ?? null,
    unit: input.unit ?? null,
    freq_type: input.freq_type ?? 'daily',
    freq_target: input.freq_target ?? null,
    freq_days: input.freq_days ?? null,
    is_bad: input.is_bad ?? false,
    sort_order: input.sort_order ?? 0,
    archived_at: input.archived_at ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  await local.writeLocal('habits', row)
  return row
}

export async function updateHabit(
  local: LocalDB,
  id: string,
  patch: UpdateHabitPatch,
): Promise<Habit> {
  await local.writeLocal('habits', { id, ...patch })
  const updated = await getHabit(local, id)
  if (!updated) throw new Error(`habit ${id} not found`)
  return updated
}

export async function archiveHabit(local: LocalDB, id: string): Promise<void> {
  await local.writeLocal('habits', { id, archived_at: nowISO() })
}

export async function unarchiveHabit(local: LocalDB, id: string): Promise<void> {
  await local.writeLocal('habits', { id, archived_at: null })
}

export async function deleteHabit(local: LocalDB, id: string): Promise<void> {
  await local.softDelete('habits', id)
}

export async function reorderHabits(local: LocalDB, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await local.writeLocal('habits', { id: orderedIds[i], sort_order: i })
  }
}
