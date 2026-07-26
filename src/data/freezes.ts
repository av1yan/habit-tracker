// Streak freezes. Spending one is atomic on the server (see the
// use_streak_freeze RPC): it writes a 'frozen' log and decrements the balance
// in one transaction, and rejects if the balance is already zero.

import type { DB } from './client'
import { toLocalISODate } from './helpers'

/**
 * Spend one streak freeze for a habit on a day (defaults to today).
 * Returns the remaining balance. Throws 'no streak freezes available' if none.
 */
export async function useStreakFreeze(
  db: DB,
  habitId: string,
  date: string = toLocalISODate(),
): Promise<number> {
  const { data, error } = await db.rpc('use_streak_freeze', {
    p_habit_id: habitId,
    p_date: date,
  })
  if (error) throw error
  return data as number
}
