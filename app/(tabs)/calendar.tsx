import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { logs as logsRepo, stats as statsRepo } from '@backend/local'
import type { TodayView } from '@backend/data'
import { addDays, startOfWeek, toLocalISODate } from '@backend/data'
import { useApp } from '@/lib/app-context'
import { useLocalData } from '@/lib/useLocalData'
import { useTheme } from '@/lib/theme-context'
import { Loading } from '@/components/ScreenState'
import { colors, fonts, heat, rgba } from '@/lib/theme'

const WEEKS = 15

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export default function Calendar() {
  useTheme()
  const insets = useSafeAreaInsets()
  const { local, version } = useApp()
  const { data, loading } = useLocalData((l) => statsRepo.recentHeatmap(l, WEEKS))

  const counts = new Map((data ?? []).map((c) => [c.log_date, c.completions]))
  const today = toLocalISODate()
  const start = addDays(startOfWeek(today, 0), -((WEEKS - 1) * 7))

  const [selected, setSelected] = useState(today)
  const [day, setDay] = useState<TodayView | null>(null)

  // Load the selected day's habits + completion whenever it (or the data) changes.
  useEffect(() => {
    if (!local) return
    let alive = true
    setDay(null)
    logsRepo.getToday(local, selected).then((d) => {
      if (alive) setDay(d)
    })
    return () => {
      alive = false
    }
  }, [local, selected, version])

  const level = (n: number) => (n <= 0 ? 0 : n >= 4 ? 4 : n)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24, gap: 12 }}
    >
      <Text style={{ fontSize: 26, fontFamily: fonts.display, color: colors.ink, marginHorizontal: 20 }}>
        Calendar
      </Text>

      <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.muted, marginBottom: 12 }}>
          LAST {WEEKS} WEEKS
        </Text>
        {loading ? (
          <Loading />
        ) : (
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {Array.from({ length: WEEKS }, (_, w) => (
              <View key={w} style={{ gap: 3 }}>
                {Array.from({ length: 7 }, (_, d) => {
                  const date = addDays(start, w * 7 + d)
                  const future = date > today
                  const n = counts.get(date) ?? 0
                  const isSelected = date === selected
                  return (
                    <Pressable
                      key={d}
                      disabled={future}
                      onPress={() => setSelected(date)}
                      hitSlop={2}
                      accessibilityRole="button"
                      accessibilityLabel={`${formatDay(date)}, ${n} completed`}
                      accessibilityState={{ selected: isSelected }}
                      style={{
                        width: 13,
                        height: 13,
                        borderRadius: 3,
                        backgroundColor: future ? 'transparent' : heat[level(n)],
                        borderWidth: isSelected ? 2 : 0,
                        borderColor: colors.ink,
                      }}
                    />
                  )
                })}
              </View>
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 12, justifyContent: 'flex-end' }}>
          <Text style={{ fontSize: 10, color: colors.muted }}>Less</Text>
          {heat.map((c) => (
            <View key={c} style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: c }} />
          ))}
          <Text style={{ fontSize: 10, color: colors.muted }}>More</Text>
        </View>
      </View>

      {/* Selected-day detail */}
      <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 16, fontFamily: fonts.display, color: colors.ink, flex: 1 }}>
            {selected === today ? 'Today' : formatDay(selected)}
          </Text>
          {day && day.totalCount > 0 && (
            <View style={{ backgroundColor: rgba(colors.accent, 0.14), borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ fontSize: 12, fontFamily: fonts.semibold, color: colors.accent }}>
                {day.completedCount}/{day.totalCount} · {day.pct}%
              </Text>
            </View>
          )}
        </View>

        {!day ? (
          <Loading />
        ) : day.habits.length === 0 ? (
          <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.muted, paddingVertical: 8 }}>
            No habits to show for this day.
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {day.habits.map(({ habit, done }) => (
              <View
                key={habit.id}
                accessibilityLabel={`${habit.name}, ${done ? 'completed' : 'not completed'}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: rgba(habit.color, 0.15),
                  }}
                >
                  <Text style={{ fontSize: 19 }}>{habit.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: fonts.semibold, color: colors.ink }}>{habit.name}</Text>
                  <Text style={{ fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginTop: 1 }}>
                    {habit.category}
                  </Text>
                </View>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: done ? habit.color : 'transparent',
                    borderWidth: done ? 0 : 2,
                    borderColor: colors.track,
                  }}
                >
                  {done && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>✓</Text>}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
