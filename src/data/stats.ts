// Derived stats — all computed server-side (never stored), read via the
// habit_stats view and the streak/rate/heatmap RPCs.

import type { DB } from './client'
import { addDays, maybeOne, monthBounds, toLocalISODate, unwrap } from './helpers'
import type { HabitStats } from '../../supabase/types/database.types'

/** Per-habit rollup for the Stats screen (streaks, 90-day rate, totals). */
export async function getAllStats(db: DB): Promise<HabitStats[]> {
  return unwrap(await db.from('habit_stats').select('*'))
}

export async function getHabitStats(db: DB, habitId: string): Promise<HabitStats | null> {
  return maybeOne(
    await db.from('habit_stats').select('*').eq('habit_id', habitId).maybeSingle(),
  )
}

export async function getCurrentStreak(db: DB, habitId: string): Promise<number> {
  const { data, error } = await db.rpc('current_streak', { p_habit_id: habitId })
  if (error) throw error
  return data ?? 0
}

export async function getLongestStreak(db: DB, habitId: string): Promise<number> {
  const { data, error } = await db.rpc('longest_streak', { p_habit_id: habitId })
  if (error) throw error
  return data ?? 0
}

/** Completion rate (0–100) over an explicit window. */
export async function getCompletionRate(
  db: DB,
  habitId: string,
  from: string,
  to: string,
): Promise<number> {
  const { data, error } = await db.rpc('completion_rate', {
    p_habit_id: habitId,
    p_from: from,
    p_to: to,
  })
  if (error) throw error
  return data ?? 0
}

export interface HeatmapCell {
  log_date: string
  completions: number
}

/** Daily completion counts across all habits, for the calendar heatmap. */
export async function getHeatmap(db: DB, from: string, to: string): Promise<HeatmapCell[]> {
  const { data, error } = await db.rpc('heatmap', { p_from: from, p_to: to })
  if (error) throw error
  return data ?? []
}

/** Heatmap for the last `weeks` weeks ending today (design shows 15). */
export async function getRecentHeatmap(db: DB, weeks = 15): Promise<HeatmapCell[]> {
  const to = toLocalISODate()
  const from = addDays(to, -(weeks * 7 - 1))
  return getHeatmap(db, from, to)
}

/** Heatmap for a single month. `month` is 1–12. */
export async function getMonthHeatmap(
  db: DB,
  year: number,
  month: number,
): Promise<HeatmapCell[]> {
  const { from, to } = monthBounds(year, month)
  return getHeatmap(db, from, to)
}

/** Overall completion % — mean of each active habit's 90-day rate. */
export async function getOverallCompletion(db: DB): Promise<number> {
  const stats = await getAllStats(db)
  const rates = stats.map((s) => s.rate_90d ?? 0)
  if (rates.length === 0) return 0
  return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
}
