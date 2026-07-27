// Local notifications driven by the `reminders` table. Reads reminders from the
// local SQLite mirror and (re)schedules one weekly notification per reminder
// per weekday. Called after sign-in/sync and whenever a reminder is toggled.
//
// Local notifications work in Expo Go; remote push does not (that needs a dev
// build). These are all local/scheduled, so Expo Go is fine.

import * as Notifications from 'expo-notifications'
import { habits as habitsRepo, reminders as remindersRepo } from '@backend/local'
import type { Habit, LocalDB } from '@backend/local'
import { toLocalISODate } from '@backend/data'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

/** Ask for notification permission if not already granted. Never throws. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync()
    if (current.granted) return true
    const req = await Notifications.requestPermissionsAsync()
    return req.granted
  } catch {
    return false
  }
}

function bodyFor(habit: Habit): string {
  return habit.is_bad
    ? `Stay strong — protect your ${habit.name} streak.`
    : `Time for ${habit.name}. Keep the streak going!`
}

/**
 * Cancel all scheduled notifications and reschedule from the enabled reminders.
 * Returns the number of notifications scheduled.
 */
export async function rescheduleReminders(local: LocalDB): Promise<number> {
  // Never throw: a notification/permission failure must not break the caller's
  // flow (creating/editing a reminder still succeeds without notifications).
  try {
    const granted = await ensureNotificationPermission()
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {})
    if (!granted) return 0

    const [rems, allHabits] = await Promise.all([
      remindersRepo.listReminders(local),
      habitsRepo.listAllHabits(local),
    ])
    const habitById = new Map(allHabits.map((h) => [h.id, h]))

    let scheduled = 0
    for (const r of rems) {
      if (!r.enabled) continue
      const habit = habitById.get(r.habit_id)
      if (!habit) continue
      const [hour, minute] = r.time_of_day.split(':').map(Number)

      for (const dow of r.days_of_week) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: { title: `${habit.icon} ${habit.name}`, body: bodyFor(habit) },
            // Weekly trigger: weekday 1=Sun..7=Sat (our days_of_week is
            // 0=Sun..6=Sat), repeats every week.
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: dow + 1,
              hour,
              minute,
            },
          })
          scheduled++
        } catch {
          // skip this occurrence; keep scheduling the rest
        }
      }
    }
    // Record the context these notifications were scheduled in, so a later
    // timezone change or new day can be detected (see rescheduleOnForeground).
    lastScheduledTzOffset = new Date().getTimezoneOffset()
    lastScheduledDay = toLocalISODate()
    return scheduled
  } catch {
    return 0
  }
}

// Context of the last successful schedule, for change detection.
let lastScheduledTzOffset: number | null = null
let lastScheduledDay: string | null = null

/**
 * Reschedule only if the device timezone or calendar day has changed since the
 * last schedule — cheap no-op otherwise. Call when the app returns to the
 * foreground so reminders follow the user across timezones (their local
 * hour:minute stays correct) and survive reboots/DST shifts. Returns true if a
 * reschedule actually happened.
 */
export async function rescheduleOnForeground(local: LocalDB): Promise<boolean> {
  const tzOffset = new Date().getTimezoneOffset()
  const day = toLocalISODate()
  if (tzOffset === lastScheduledTzOffset && day === lastScheduledDay) return false
  await rescheduleReminders(local)
  return true
}

/** Count of currently-scheduled notifications (for the reminders screen). */
export async function scheduledCount(): Promise<number> {
  return (await Notifications.getAllScheduledNotificationsAsync()).length
}
