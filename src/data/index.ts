// Habit Tracker — data-access layer.
// Typed, framework-agnostic functions over Supabase. Every function takes a
// `DB` client as its first argument.
//
//   import { createDbClient, getToday, toggleHabit } from './src/data'
//   const db = createDbClient(url, anonKey)
//   const today = await getToday(db)
//   await toggleHabit(db, today.habits[0].habit.id)

export * from './client'
export * from './helpers'
export * from './habits'
export * from './logs'
export * from './freezes'
export * from './stats'
export * from './reminders'
export * from './profile'

// Re-export the row/enum types so app code has a single import site.
export type {
  Database,
  Profile,
  Habit,
  HabitLog,
  Reminder,
  Achievement,
  HabitStats,
  Theme,
  HabitType,
  HabitFreqType,
  LogStatus,
  Weekday,
} from '../../supabase/types/database.types'
