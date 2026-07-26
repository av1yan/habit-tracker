// Shared helpers: error unwrapping, auth, and LOCAL-date math.
//
// Dates are the app's trickiest correctness issue. A completion belongs to the
// user's *local* calendar day, so all date strings here are `YYYY-MM-DD` built
// from local time — never `toISOString()` (which is UTC and shifts the day).

import type { PostgrestError } from '@supabase/supabase-js'
import type { DB } from './client'
import type { Weekday } from '../../supabase/types/database.types'

/** List query: throw on error, return the rows (never null). */
export function unwrap<T>(res: { data: T[] | null; error: PostgrestError | null }): T[] {
  if (res.error) throw res.error
  return res.data ?? []
}

/** single(): throw on error, assert a row was returned. */
export function one<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw res.error
  if (res.data == null) throw new Error('Expected a row but got none')
  return res.data
}

/** maybeSingle(): throw on error, allow a null result. */
export function maybeOne<T>(res: { data: T | null; error: PostgrestError | null }): T | null {
  if (res.error) throw res.error
  return res.data
}

/** Write with no returned row: throw on error. */
export function check(res: { error: PostgrestError | null }): void {
  if (res.error) throw res.error
}

/** Current authenticated user id, or throw. */
export async function currentUserId(db: DB): Promise<string> {
  const { data, error } = await db.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Not authenticated')
  return data.user.id
}

/** Local calendar date as `YYYY-MM-DD` (defaults to today). */
export function toLocalISODate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Add `n` days to a `YYYY-MM-DD` string, staying in local time. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return toLocalISODate(new Date(y, m - 1, d + n))
}

/** Day-of-week for a `YYYY-MM-DD` string: 0 = Sunday … 6 = Saturday. */
export function dowOf(iso: string): Weekday {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() as Weekday
}

/** Start-of-week (`YYYY-MM-DD`) for the week containing `iso`. */
export function startOfWeek(iso: string, weekStart: Weekday = 0): string {
  const diff = (dowOf(iso) - weekStart + 7) % 7
  return addDays(iso, -diff)
}

/** First and last day of a month as `YYYY-MM-DD`. `month` is 1–12. */
export function monthBounds(year: number, month: number): { from: string; to: string } {
  const from = toLocalISODate(new Date(year, month - 1, 1))
  const to = toLocalISODate(new Date(year, month, 0)) // day 0 of next month = last day
  return { from, to }
}

export const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const
