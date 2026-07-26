// Offline logs repo — mirrors src/data/logs.ts, backed by SQLite.
// Same invariant: at most one active log per (habit, day); completing revives
// the existing row rather than inserting a duplicate.

import type { LocalDB } from './db'
import { newId, nowISO } from './util'
import {
  addDays,
  dowOf,
  startOfWeek,
  toLocalISODate,
  WEEKDAY_LETTERS,
} from '../data/helpers'
import type { Habit, HabitLog, LogStatus, Weekday } from '../../supabase/types/database.types'
import type { CompleteOptions, TodayHabit, TodayView, WeekDay } from '../data/logs'

export async function getLog(
  local: LocalDB,
  habitId: string,
  date: string = toLocalISODate(),
): Promise<HabitLog | null> {
  return local.getOne<HabitLog>(
    'habit_logs',
    'habit_id = ? AND log_date = ? AND deleted_at IS NULL',
    [habitId, date],
  )
}

export async function completeHabit(
  local: LocalDB,
  habitId: string,
  date: string = toLocalISODate(),
  opts: CompleteOptions = {},
): Promise<HabitLog> {
  const existing = await getLog(local, habitId, date)
  const patch = {
    status: 'completed' as LogStatus,
    ...(opts.value !== undefined ? { value: opts.value } : {}),
    ...(opts.note !== undefined ? { note: opts.note } : {}),
  }

  if (existing) {
    await local.writeLocal('habit_logs', { id: existing.id, ...patch })
  } else {
    const now = nowISO()
    await local.writeLocal('habit_logs', {
      id: newId(),
      user_id: await local.getUserId(),
      habit_id: habitId,
      log_date: date,
      status: patch.status,
      value: patch.value ?? null,
      note: patch.note ?? null,
      completed_at: now,
      created_at: now,
      deleted_at: null,
    })
  }
  const row = await getLog(local, habitId, date)
  if (!row) throw new Error('log write failed')
  return row
}

export async function uncompleteHabit(
  local: LocalDB,
  habitId: string,
  date: string = toLocalISODate(),
): Promise<void> {
  const existing = await getLog(local, habitId, date)
  if (existing) await local.softDelete('habit_logs', existing.id)
}

export async function toggleHabit(
  local: LocalDB,
  habitId: string,
  date: string = toLocalISODate(),
): Promise<boolean> {
  const existing = await getLog(local, habitId, date)
  if (existing && existing.status === 'completed') {
    await uncompleteHabit(local, habitId, date)
    return false
  }
  await completeHabit(local, habitId, date)
  return true
}

export async function setValue(
  local: LocalDB,
  habitId: string,
  value: number,
  date: string = toLocalISODate(),
): Promise<HabitLog> {
  return completeHabit(local, habitId, date, { value })
}

export async function setNote(
  local: LocalDB,
  habitId: string,
  note: string | null,
  date: string = toLocalISODate(),
): Promise<HabitLog> {
  const existing = await getLog(local, habitId, date)
  if (existing) {
    await local.writeLocal('habit_logs', { id: existing.id, note })
    const row = await getLog(local, habitId, date)
    return row as HabitLog
  }
  return completeHabit(local, habitId, date, { note })
}

// -- Today ------------------------------------------------------------------

export async function getToday(
  local: LocalDB,
  date: string = toLocalISODate(),
): Promise<TodayView> {
  const habits = await local.list<Habit>(
    'habits',
    'deleted_at IS NULL AND archived_at IS NULL',
    [],
    'sort_order ASC',
  )
  const logs = await local.list<HabitLog>(
    'habit_logs',
    'log_date = ? AND deleted_at IS NULL',
    [date],
  )
  const byHabit = new Map(logs.map((l) => [l.habit_id, l]))

  const items: TodayHabit[] = habits.map((habit) => {
    const log = byHabit.get(habit.id)
    return {
      habit,
      status: (log?.status as LogStatus) ?? null,
      value: log?.value ?? null,
      note: log?.note ?? null,
      done: log?.status === 'completed',
    }
  })
  const completedCount = items.filter((i) => i.done).length
  const totalCount = items.length
  return {
    date,
    habits: items,
    completedCount,
    totalCount,
    pct: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
  }
}

/**
 * Completed (habit_id, log_date) pairs across all habits in a date range — for
 * the per-habit heatmap grid. Frozen days count as kept.
 */
export async function completionsByHabit(
  local: LocalDB,
  from: string,
  to: string,
): Promise<{ habit_id: string; log_date: string }[]> {
  return local.raw<{ habit_id: string; log_date: string }>(
    `SELECT habit_id, log_date FROM habit_logs
     WHERE deleted_at IS NULL AND status IN ('completed', 'frozen')
       AND log_date >= ? AND log_date <= ?`,
    [from, to],
  )
}

// -- Week strip -------------------------------------------------------------

export async function getWeek(
  local: LocalDB,
  habitId: string,
  opts: { weekStart?: Weekday; ref?: string } = {},
): Promise<WeekDay[]> {
  const ref = opts.ref ?? toLocalISODate()
  const start = startOfWeek(ref, opts.weekStart ?? 0)
  const end = addDays(start, 6)
  const today = toLocalISODate()

  const logs = await local.list<HabitLog>(
    'habit_logs',
    'habit_id = ? AND deleted_at IS NULL AND log_date >= ? AND log_date <= ?',
    [habitId, start, end],
  )
  const byDate = new Map(logs.map((l) => [l.log_date, l.status as LogStatus]))

  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i)
    const status = byDate.get(d) ?? null
    return {
      date: d,
      label: WEEKDAY_LETTERS[dowOf(d)],
      status,
      done: status === 'completed',
      isToday: d === today,
      isFuture: d > today,
    }
  })
}
