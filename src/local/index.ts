// Local (offline) layer.
//
// Infrastructure is exported flat; the repositories are namespaced because they
// share function names with the cloud DAL (src/data). Use them like:
//
//   import { LocalDB, createExpoAdapter, logs, stats } from './src/local'
//   const local = new LocalDB(await createExpoAdapter())
//   await local.init()
//   await logs.toggleHabit(local, habitId)
//   const view = await stats.getAllStats(local)

export * from './adapter'
export * from './expo-adapter'
export * from './db'
export * from './schema'
export * from './tables'
export * from './util'

// Row/enum types, so app code can import them from the local layer too.
export type {
  Profile,
  Habit,
  HabitLog,
  Reminder,
  Achievement,
  HabitStats,
  HabitType,
  HabitFreqType,
  LogStatus,
  Weekday,
} from '../../supabase/types/database.types'

export * as habits from './repo-habits'
export * as logs from './repo-logs'
export * as stats from './repo-stats'
export * as reminders from './repo-reminders'
export * as profile from './repo-profile'
export * as freezes from './repo-freezes'
export * as achievements from './repo-achievements'
