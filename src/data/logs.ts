// Completion logging — the core write path.
//
// Invariant: at most one ACTIVE log per (habit, day) — enforced by a partial
// unique index in the DB. To avoid piling up tombstones when a user toggles a
// day off and on again, "completing" revives the existing active row rather
// than inserting a duplicate.

import type { DB } from './client'
import {
  addDays,
  check,
  currentUserId,
  dowOf,
  maybeOne,
  one,
  startOfWeek,
  toLocalISODate,
  unwrap,
  WEEKDAY_LETTERS,
} from './helpers'
import type {
  Habit,
  HabitLog,
  LogStatus,
  Weekday,
} from '../../supabase/types/database.types'

/** The single active log for a habit on a given day, or null. */
export async function getLog(
  db: DB,
  habitId: string,
  date: string = toLocalISODate(),
): Promise<HabitLog | null> {
  return maybeOne(
    await db
      .from('habit_logs')
      .select('*')
      .eq('habit_id', habitId)
      .eq('log_date', date)
      .is('deleted_at', null)
      .maybeSingle(),
  )
}

export interface CompleteOptions {
  value?: number | null
  note?: string | null
}

/** Mark a habit complete for a day (idempotent). */
export async function completeHabit(
  db: DB,
  habitId: string,
  date: string = toLocalISODate(),
  opts: CompleteOptions = {},
): Promise<HabitLog> {
  const existing = await getLog(db, habitId, date)
  const patch = {
    status: 'completed' as LogStatus,
    ...(opts.value !== undefined ? { value: opts.value } : {}),
    ...(opts.note !== undefined ? { note: opts.note } : {}),
  }

  if (existing) {
    return one(
      await db.from('habit_logs').update(patch).eq('id', existing.id).select('*').single(),
    )
  }

  const user_id = await currentUserId(db)
  return one(
    await db
      .from('habit_logs')
      .insert({ user_id, habit_id: habitId, log_date: date, ...patch })
      .select('*')
      .single(),
  )
}

/** Un-complete a day (soft delete of the active log). No-op if not logged. */
export async function uncompleteHabit(
  db: DB,
  habitId: string,
  date: string = toLocalISODate(),
): Promise<void> {
  check(
    await db
      .from('habit_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('habit_id', habitId)
      .eq('log_date', date)
      .is('deleted_at', null),
  )
}

/** Flip completion for a day. Returns the resulting done state. */
export async function toggleHabit(
  db: DB,
  habitId: string,
  date: string = toLocalISODate(),
): Promise<boolean> {
  const existing = await getLog(db, habitId, date)
  if (existing && existing.status === 'completed') {
    await uncompleteHabit(db, habitId, date)
    return false
  }
  await completeHabit(db, habitId, date)
  return true
}

/** Set the progress value for quantity/duration habits (also marks completed). */
export async function setValue(
  db: DB,
  habitId: string,
  value: number,
  date: string = toLocalISODate(),
): Promise<HabitLog> {
  return completeHabit(db, habitId, date, { value })
}

/** Attach/replace the note for a day. Creates a completed log if none exists. */
export async function setNote(
  db: DB,
  habitId: string,
  note: string | null,
  date: string = toLocalISODate(),
): Promise<HabitLog> {
  const existing = await getLog(db, habitId, date)
  if (existing) {
    return one(
      await db.from('habit_logs').update({ note }).eq('id', existing.id).select('*').single(),
    )
  }
  return completeHabit(db, habitId, date, { note })
}

// ---------------------------------------------------------------------------
// Today screen
// ---------------------------------------------------------------------------

export interface TodayHabit {
  habit: Habit
  status: LogStatus | null
  value: number | null
  note: string | null
  done: boolean
}

export interface TodayView {
  date: string
  habits: TodayHabit[]
  completedCount: number
  totalCount: number
  pct: number
}

/** Everything the Today screen needs: habits + each one's state for the day. */
export async function getToday(
  db: DB,
  date: string = toLocalISODate(),
): Promise<TodayView> {
  const [habitsRes, logsRes] = await Promise.all([
    db
      .from('habits')
      .select('*')
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('sort_order', { ascending: true }),
    db
      .from('habit_logs')
      .select('habit_id,status,value,note')
      .eq('log_date', date)
      .is('deleted_at', null),
  ])
  const habits = unwrap(habitsRes)
  const logs = unwrap(logsRes)

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

// ---------------------------------------------------------------------------
// Week strip (habit detail screen)
// ---------------------------------------------------------------------------

export interface WeekDay {
  date: string
  label: string
  status: LogStatus | null
  done: boolean
  isToday: boolean
  isFuture: boolean
}

/** The 7-day strip for a habit's detail screen. */
export async function getWeek(
  db: DB,
  habitId: string,
  opts: { weekStart?: Weekday; ref?: string } = {},
): Promise<WeekDay[]> {
  const ref = opts.ref ?? toLocalISODate()
  const start = startOfWeek(ref, opts.weekStart ?? 0)
  const end = addDays(start, 6)
  const today = toLocalISODate()

  const logs = unwrap(
    await db
      .from('habit_logs')
      .select('log_date,status')
      .eq('habit_id', habitId)
      .is('deleted_at', null)
      .gte('log_date', start)
      .lte('log_date', end),
  )
  const byDate = new Map(logs.map((l) => [l.log_date, l.status as LogStatus]))

  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i)
    const status = byDate.get(date) ?? null
    return {
      date,
      label: WEEKDAY_LETTERS[dowOf(date)],
      status,
      done: status === 'completed',
      isToday: date === today,
      isFuture: date > today,
    }
  })
}
