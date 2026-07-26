// Offline stats — TS ports of the Postgres functions in migration 0004, so
// numbers shown offline match the server once synced. Same rules:
//   completed → +1 · frozen → preserve (no count) · today may be unfinished ·
//   a missed EXPECTED past day breaks the streak · "expected" respects freq.

import type { LocalDB } from './db'
import { addDays, dowOf, toLocalISODate } from '../data/helpers'
import type { Habit, HabitLog } from '../../supabase/types/database.types'
import type { HeatmapCell } from '../data/stats'

function isExpected(freqType: string, freqDays: number[] | null, dateISO: string): boolean {
  if (freqType === 'specific_days') return (freqDays ?? []).includes(dowOf(dateISO))
  return true
}

async function loadStatus(local: LocalDB, habitId: string): Promise<Map<string, string>> {
  const logs = await local.list<HabitLog>(
    'habit_logs',
    'habit_id = ? AND deleted_at IS NULL',
    [habitId],
  )
  return new Map(logs.map((l) => [l.log_date, l.status]))
}

export async function currentStreak(
  local: LocalDB,
  habitId: string,
  today: string = toLocalISODate(),
): Promise<number> {
  const habit = await local.getById<Habit>('habits', habitId)
  if (!habit) return 0
  const status = await loadStatus(local, habitId)

  let streak = 0
  let day = today
  for (let guard = 0; guard < 3650; guard++) {
    if (isExpected(habit.freq_type, habit.freq_days, day)) {
      const s = status.get(day)
      if (s === 'completed') streak += 1
      else if (s === 'frozen') {
        /* preserve */
      } else if (day === today) {
        /* today may be unfinished */
      } else break
    }
    day = addDays(day, -1)
  }
  return streak
}

export async function longestStreak(
  local: LocalDB,
  habitId: string,
  today: string = toLocalISODate(),
): Promise<number> {
  const habit = await local.getById<Habit>('habits', habitId)
  if (!habit) return 0
  const status = await loadStatus(local, habitId)
  if (status.size === 0) return 0

  const first = [...status.keys()].sort()[0]
  let run = 0
  let best = 0
  let day = first
  while (day <= today) {
    if (isExpected(habit.freq_type, habit.freq_days, day)) {
      const s = status.get(day)
      if (s === 'completed') {
        run += 1
        best = Math.max(best, run)
      } else if (s === 'frozen') {
        /* preserve */
      } else run = 0
    }
    day = addDays(day, 1)
  }
  return best
}

export async function completionRate(
  local: LocalDB,
  habitId: string,
  from: string,
  to: string,
): Promise<number> {
  const habit = await local.getById<Habit>('habits', habitId)
  if (!habit || to < from) return 0

  let expected = 0
  if (habit.freq_type === 'daily' || habit.freq_type === 'specific_days') {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (isExpected(habit.freq_type, habit.freq_days, d)) expected++
    }
  } else {
    const days = daysBetween(from, to) + 1
    if (habit.freq_type === 'weekly_count') {
      expected = Math.ceil(days / 7) * (habit.freq_target ?? 1)
    } else if (habit.freq_type === 'interval') {
      expected = Math.floor(days / Math.max(habit.freq_target ?? 1, 1))
    }
  }
  if (expected <= 0) return 0

  const rows = await local.raw<{ n: number }>(
    `SELECT COUNT(*) AS n FROM habit_logs
     WHERE habit_id = ? AND status = 'completed' AND deleted_at IS NULL
       AND log_date >= ? AND log_date <= ?`,
    [habitId, from, to],
  )
  const completed = rows[0]?.n ?? 0
  return Math.min(100, Math.round((completed / expected) * 100))
}

export async function heatmap(
  local: LocalDB,
  from: string,
  to: string,
): Promise<HeatmapCell[]> {
  return local.raw<HeatmapCell>(
    `SELECT log_date, COUNT(*) AS completions FROM habit_logs
     WHERE status = 'completed' AND deleted_at IS NULL
       AND log_date >= ? AND log_date <= ?
     GROUP BY log_date ORDER BY log_date`,
    [from, to],
  )
}

export async function recentHeatmap(local: LocalDB, weeks = 15): Promise<HeatmapCell[]> {
  const to = toLocalISODate()
  return heatmap(local, addDays(to, -(weeks * 7 - 1)), to)
}

export interface LocalHabitStats {
  habit_id: string
  name: string
  icon: string
  color: string
  current_streak: number
  longest_streak: number
  rate_90d: number
  total_completions: number
}

export async function getAllStats(local: LocalDB): Promise<LocalHabitStats[]> {
  const habits = await local.list<Habit>(
    'habits',
    'deleted_at IS NULL AND archived_at IS NULL',
    [],
    'sort_order ASC',
  )
  const today = toLocalISODate()
  const from90 = addDays(today, -89)

  return Promise.all(
    habits.map(async (h) => {
      const [cur, longest, rate, totalRows] = await Promise.all([
        currentStreak(local, h.id, today),
        longestStreak(local, h.id, today),
        completionRate(local, h.id, from90, today),
        local.raw<{ n: number }>(
          `SELECT COUNT(*) AS n FROM habit_logs
           WHERE habit_id = ? AND status = 'completed' AND deleted_at IS NULL`,
          [h.id],
        ),
      ])
      return {
        habit_id: h.id,
        name: h.name,
        icon: h.icon,
        color: h.color,
        current_streak: cur,
        longest_streak: longest,
        rate_90d: rate,
        total_completions: totalRows[0]?.n ?? 0,
      }
    }),
  )
}

export async function getOverallCompletion(local: LocalDB): Promise<number> {
  const stats = await getAllStats(local)
  if (stats.length === 0) return 0
  return Math.round(stats.reduce((a, s) => a + s.rate_90d, 0) / stats.length)
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const a = Date.UTC(fy, fm - 1, fd)
  const b = Date.UTC(ty, tm - 1, td)
  return Math.round((b - a) / 86400000)
}
