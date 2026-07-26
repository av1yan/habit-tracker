import { Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { habits as habitsRepo, reminders as remindersRepo } from '@backend/local'
import type { Habit, Reminder } from '@backend/local'
import { useApp } from '@/lib/app-context'
import { useLocalData } from '@/lib/useLocalData'
import { useTheme } from '@/lib/theme-context'
import { rescheduleReminders } from '@/lib/notifications'
import { colors, fonts, rgba } from '@/lib/theme'

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function timeLabel(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function daysLabel(days: number[]): string {
  if (days.length === 7) return 'Every day'
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'Weekdays'
  return days.map((d) => DAY_LETTERS[d]).join(' ')
}

export default function Reminders() {
  useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { local, refresh } = useApp()

  const { data } = useLocalData(async (l) => {
    const [rems, allHabits] = await Promise.all([
      remindersRepo.listReminders(l),
      habitsRepo.listAllHabits(l),
    ])
    const byId = new Map(allHabits.map((h) => [h.id, h]))
    return rems.map((r) => ({ reminder: r, habit: byId.get(r.habit_id) }))
  })

  const toggle = async (reminder: Reminder, value: boolean) => {
    if (!local) return
    await remindersRepo.setReminderEnabled(local, reminder.id, value)
    refresh()
    void rescheduleReminders(local) // handles permission; never throws
  }

  const rows = data ?? []

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={{ color: colors.accent, fontFamily: fonts.bold, fontSize: 15 }}>‹ Back</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.ink, flex: 1 }}>Reminders</Text>
        <Pressable
          onPress={() => router.push('/reminder-edit')}
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20, color: colors.accent, marginTop: -2 }}>+</Text>
        </Pressable>
      </View>

      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, color: colors.muted, marginHorizontal: 20, marginBottom: 10 }}>
        LOCAL NOTIFICATIONS
      </Text>

      <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
        {rows.map(({ reminder, habit }, i) => (
          <View
            key={reminder.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 16,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.bg,
            }}
          >
            <Pressable
              onPress={() => router.push({ pathname: '/reminder-edit', params: { id: reminder.id } })}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: rgba(habit?.color ?? colors.accent, 0.15),
                }}
              >
                <Text style={{ fontSize: 20 }}>{habit?.icon ?? '🔔'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>
                  {habit?.name ?? 'Habit'}
                </Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.sub, marginTop: 2 }}>
                  {timeLabel(reminder.time_of_day)} · {daysLabel(reminder.days_of_week)}
                </Text>
              </View>
            </Pressable>
            <Switch
              value={reminder.enabled}
              onValueChange={(v) => toggle(reminder, v)}
              trackColor={{ true: colors.accent, false: colors.track }}
            />
          </View>
        ))}

        {rows.length === 0 && (
          <Pressable onPress={() => router.push('/reminder-edit')} style={{ padding: 16, alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: fonts.semibold, color: colors.accent, fontSize: 15 }}>+ Add a reminder</Text>
            <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12 }}>
              Get a nudge at the right time each day.
            </Text>
          </Pressable>
        )}
      </View>

      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginHorizontal: 20, marginTop: 14, lineHeight: 18 }}>
        Reminders fire as on-device notifications at the scheduled time each week.
        Toggling one reschedules immediately.
      </Text>
    </ScrollView>
  )
}
