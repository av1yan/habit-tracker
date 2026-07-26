// Offline streak freeze. Unlike the online path (which calls the atomic
// use_streak_freeze RPC), offline we mutate SQLite directly: the frozen log and
// the decremented balance are both marked dirty and pushed on next sync. The
// server-side RPC is only for the online DAL.

import type { LocalDB } from './db'
import { getLog } from './repo-logs'
import { newId, nowISO } from './util'
import { toLocalISODate } from '../data/helpers'
import type { Profile } from '../../supabase/types/database.types'

export async function useStreakFreeze(
  local: LocalDB,
  habitId: string,
  date: string = toLocalISODate(),
): Promise<number> {
  const userId = await local.getUserId()
  const profile = await local.getById<Profile>('profiles', userId)
  if (!profile) throw new Error('profile not found')
  if ((profile.streak_freeze_balance ?? 0) <= 0) throw new Error('no streak freezes available')

  const existing = await getLog(local, habitId, date)
  if (existing) {
    await local.writeLocal('habit_logs', { id: existing.id, status: 'frozen' })
  } else {
    const now = nowISO()
    await local.writeLocal('habit_logs', {
      id: newId(),
      user_id: userId,
      habit_id: habitId,
      log_date: date,
      status: 'frozen',
      value: null,
      note: 'Streak freeze',
      completed_at: now,
      created_at: now,
      deleted_at: null,
    })
  }

  const remaining = profile.streak_freeze_balance - 1
  await local.writeLocal('profiles', { id: userId, streak_freeze_balance: remaining })
  return remaining
}
