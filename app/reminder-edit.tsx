import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { habits as habitsRepo, reminders as remindersRepo } from '@backend/local'
import type { Habit } from '@backend/local'
import { useApp } from '@/lib/app-context'
import { useTheme } from '@/lib/theme-context'
import { ensureNotificationPermission, rescheduleReminders } from '@/lib/notifications'
import { colors, fonts, rgba } from '@/lib/theme'

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const pad = (n: number) => String(n).padStart(2, '0')

function timeLabel(h: number, m: number): string {
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(m)} ${ampm}`
}

export default function ReminderEdit() {
  useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const isEdit = !!id
  const { local, refresh } = useApp()

  const [habits, setHabits] = useState<Habit[]>([])
  const [habitId, setHabitId] = useState('')
  const [hour, setHour] = useState(8)
  const [minute, setMinute] = useState(0)
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])

  useEffect(() => {
    if (!local) return
    ;(async () => {
      const hs = await habitsRepo.listHabits(local)
      setHabits(hs)
      if (isEdit) {
        const all = await remindersRepo.listReminders(local)
        const r = all.find((x) => x.id === id)
        if (r) {
          setHabitId(r.habit_id)
          const [h, m] = r.time_of_day.split(':').map(Number)
          setHour(h)
          setMinute(m)
          setDays(r.days_of_week)
        }
      } else if (hs.length) {
        setHabitId(hs[0].id)
      }
    })()
  }, [local, id])

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))

  const canSave = !!habitId && days.length > 0

  const save = async () => {
    if (!local || !canSave) return
    const time_of_day = `${pad(hour)}:${pad(minute)}:00`
    try {
      if (isEdit && id) {
        await remindersRepo.updateReminder(local, id, { habit_id: habitId, time_of_day, days_of_week: days })
      } else {
        await remindersRepo.createReminder(local, { habit_id: habitId, time_of_day, days_of_week: days, enabled: true })
      }
    } catch (e) {
      Alert.alert('Could not save', String((e as Error).message ?? e))
      return
    }
    refresh()
    router.back()
    // Fire-and-forget: scheduling never throws and must not block navigation.
    void ensureNotificationPermission().then(() => rescheduleReminders(local))
  }

  const confirmDelete = () => {
    Alert.alert('Delete reminder?', 'This removes the reminder and its notifications.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!local || !id) return
          await remindersRepo.deleteReminder(local, id)
          refresh()
          router.back()
          void rescheduleReminders(local)
        },
      },
    ])
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 8, gap: 18, paddingBottom: 40 }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.accent, fontFamily: fonts.bold }}>Cancel</Text>
        </Pressable>
        <Text style={{ fontSize: 17, fontFamily: fonts.display, color: colors.ink }}>
          {isEdit ? 'Edit Reminder' : 'New Reminder'}
        </Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Time */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 18, alignItems: 'center', gap: 14 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 44, color: colors.ink }}>
          {timeLabel(hour, minute)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 24 }}>
          <Stepper
            label="Hour"
            onUp={() => setHour((h) => (h + 1) % 24)}
            onDown={() => setHour((h) => (h + 23) % 24)}
          />
          <Stepper
            label="Min"
            onUp={() => setMinute((m) => (m + 5) % 60)}
            onDown={() => setMinute((m) => (m + 55) % 60)}
          />
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, color: colors.muted }}>
              AM/PM
            </Text>
            <Pressable
              onPress={() => setHour((h) => (h + 12) % 24)}
              style={{ backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>
                {hour < 12 ? 'AM' : 'PM'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Habit */}
      <Section title="HABIT">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {habits.map((h) => {
            const active = h.id === habitId
            return (
              <Pressable
                key={h.id}
                onPress={() => setHabitId(h.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: active ? rgba(h.color, 0.2) : colors.card,
                  borderWidth: 1.5,
                  borderColor: active ? h.color : 'transparent',
                }}
              >
                <Text style={{ fontSize: 18 }}>{h.icon}</Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: active ? h.color : colors.sub }}>
                  {h.name}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </Section>

      {/* Days */}
      <Section title="REPEAT">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {DAY_LETTERS.map((label, d) => {
            const active = days.includes(d)
            return (
              <Pressable
                key={d}
                onPress={() => toggleDay(d)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.accent : colors.card,
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: active ? '#fff' : colors.sub }}>
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Preset label="Every day" onPress={() => setDays([0, 1, 2, 3, 4, 5, 6])} />
          <Preset label="Weekdays" onPress={() => setDays([1, 2, 3, 4, 5])} />
          <Preset label="Weekends" onPress={() => setDays([0, 6])} />
        </View>
      </Section>

      <Pressable
        onPress={save}
        disabled={!canSave}
        style={{
          backgroundColor: colors.accent,
          borderRadius: 999,
          padding: 16,
          alignItems: 'center',
          opacity: canSave ? 1 : 0.5,
          marginTop: 4,
        }}
      >
        <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 15 }}>
          {isEdit ? 'Save Reminder' : 'Add Reminder'}
        </Text>
      </Pressable>

      {isEdit && (
        <Pressable onPress={confirmDelete} style={{ alignItems: 'center', padding: 12 }}>
          <Text style={{ color: colors.danger, fontFamily: fonts.semibold, fontSize: 14 }}>Delete reminder</Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

function Stepper({ label, onUp, onDown }: { label: string; onUp: () => void; onDown: () => void }) {
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, color: colors.muted }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <StepBtn label="–" onPress={onDown} />
        <StepBtn label="+" onPress={onUp} />
      </View>
    </View>
  )
}

function StepBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.ink, marginTop: -2 }}>{label}</Text>
    </Pressable>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, color: colors.muted }}>{title}</Text>
      {children}
    </View>
  )
}

function Preset({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.sub }}>{label}</Text>
    </Pressable>
  )
}
