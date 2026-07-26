import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { habits as habitsRepo, logs as logsRepo, stats as statsRepo, freezes as freezeRepo } from '@backend/local'
import { useApp } from '@/lib/app-context'
import { useLocalData } from '@/lib/useLocalData'
import { useTheme } from '@/lib/theme-context'
import { colors, fonts, rgba } from '@/lib/theme'

export default function HabitDetail() {
  useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { local, refresh } = useApp()

  const { data } = useLocalData(async (l) => {
    const habit = await habitsRepo.getHabit(l, id)
    const all = await statsRepo.getAllStats(l)
    const week = await logsRepo.getWeek(l, id)
    const todayLog = await logsRepo.getLog(l, id)
    return { habit, stat: all.find((s) => s.habit_id === id), week, note: todayLog?.note ?? '' }
  })

  const [note, setNote] = useState('')
  useEffect(() => {
    if (data?.note !== undefined) setNote(data.note)
  }, [data?.note])

  if (!data?.habit) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />
  }
  const { habit, stat, week } = data
  const color = habit.color

  const saveNote = async () => {
    if (!local) return
    await logsRepo.setNote(local, id, note)
    refresh()
  }

  const useFreeze = async () => {
    if (!local) return
    try {
      await freezeRepo.useStreakFreeze(local, id)
      refresh()
    } catch (e) {
      Alert.alert('Streak freeze', (e as Error).message)
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={{ color: colors.accent, fontFamily: fonts.bold, fontSize: 15 }}>‹ Back</Text>
        </Pressable>
        <Text style={{ fontSize: 18, fontFamily: fonts.display, color: colors.ink }}>{habit.name}</Text>
      </View>

      <View
        style={{
          margin: 16,
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 22,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: rgba(color, 0.15),
          }}
        >
          <Text style={{ fontSize: 30 }}>{habit.icon}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 48, fontFamily: fonts.display, color, lineHeight: 52 }}>
            {stat?.current_streak ?? 0}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.sub, marginTop: 4 }}>day streak 🔥</Text>
          <Text style={{ fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginTop: 3 }}>
            Best ever: {stat?.longest_streak ?? 0} days
          </Text>
        </View>
      </View>

      <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.muted, marginBottom: 14 }}>
          THIS WEEK
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {week.map((d, i) => (
            <View key={i} style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>{d.label}</Text>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: d.isToday ? color : d.done ? rgba(color, 0.25) : 'transparent',
                  borderWidth: !d.isToday && !d.done ? 2 : 0,
                  borderColor: colors.line,
                }}
              >
                {(d.isToday || d.done) && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, margin: 16 }}>
        <Stat label="completions" value={stat?.total_completions ?? 0} color={colors.accent} />
        <Stat label="completion rate" value={`${stat?.rate_90d ?? 0}%`} color={colors.green} />
      </View>

      <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.muted, marginBottom: 10 }}>
          TODAY'S NOTE
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          onBlur={saveNote}
          placeholder="How did it go? Add a note…"
          placeholderTextColor={colors.muted}
          multiline
          style={{ fontSize: 14, color: colors.ink, minHeight: 56 }}
        />
      </View>

      <Pressable
        onPress={useFreeze}
        style={{
          margin: 16,
          backgroundColor: rgba(colors.accent, 0.06),
          borderRadius: 16,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>🧊 Streak Freeze</Text>
          <Text style={{ fontSize: 12, color: colors.sub, marginTop: 2 }}>Protect today's streak</Text>
        </View>
        <View style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Use one</Text>
        </View>
      </Pressable>
    </ScrollView>
  )
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
      <Text style={{ fontSize: 34, fontFamily: fonts.display, color }}>{value}</Text>
      <Text style={{ fontSize: 11, fontFamily: fonts.body, color: colors.muted, marginTop: 5 }}>{label}</Text>
    </View>
  )
}
