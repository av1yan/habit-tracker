import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { logs as logsRepo, stats as statsRepo } from '@backend/local'
import type { TodayView } from '@backend/data'
import { addDays, startOfWeek, toLocalISODate } from '@backend/data'
import { useApp } from '@/lib/app-context'
import { useTheme } from '@/lib/theme-context'
import { Loading } from '@/components/ScreenState'
import { colors, fonts, heat, rgba } from '@/lib/theme'

const WEEKS = 15
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const pad = (n: number) => String(n).padStart(2, '0')
const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`
const monthOf = (iso: string) => iso.slice(0, 7)

function shiftMonth(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function formatMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

const level = (n: number) => (n <= 0 ? 0 : n >= 4 ? 4 : n)

export default function Calendar() {
  useTheme()
  const insets = useSafeAreaInsets()
  const { local, version } = useApp()
  const router = useRouter()

  const today = toLocalISODate()
  const [view, setView] = useState<'month' | 'heatmap'>('month')
  const [monthCursor, setMonthCursor] = useState(firstOfMonth(today))
  const [selected, setSelected] = useState(today)
  const [counts, setCounts] = useState<Map<string, number>>(new Map())
  const [day, setDay] = useState<TodayView | null>(null)

  // Completion counts for whatever range the active view needs.
  useEffect(() => {
    if (!local) return
    let alive = true
    const gridStart =
      view === 'heatmap'
        ? addDays(startOfWeek(today, 0), -((WEEKS - 1) * 7))
        : startOfWeek(firstOfMonth(monthCursor), 0)
    const gridEnd = view === 'heatmap' ? today : addDays(gridStart, 41)
    statsRepo.heatmap(local, gridStart, gridEnd).then((rows) => {
      if (alive) setCounts(new Map(rows.map((c) => [c.log_date, c.completions])))
    })
    return () => {
      alive = false
    }
  }, [local, view, monthCursor, today, version])

  // Selected-day habit breakdown.
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24, gap: 12 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20 }}>
        <Text style={{ fontSize: 26, fontFamily: fonts.display, color: colors.ink, flex: 1 }}>Calendar</Text>
        <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 999, padding: 3 }}>
          {(['month', 'heatmap'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              accessibilityRole="button"
              accessibilityState={{ selected: view === v }}
              accessibilityLabel={`${v === 'month' ? 'Month' : 'Heatmap'} view`}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: view === v ? colors.btn : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: fonts.semibold,
                  color: view === v ? '#fff' : colors.sub,
                }}
              >
                {v === 'month' ? 'Month' : 'Heatmap'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {view === 'month' ? (
        <MonthGrid
          monthCursor={monthCursor}
          today={today}
          selected={selected}
          counts={counts}
          onPrev={() => setMonthCursor((c) => shiftMonth(c, -1))}
          onNext={() => setMonthCursor((c) => shiftMonth(c, 1))}
          onSelect={setSelected}
        />
      ) : (
        <Heatmap today={today} counts={counts} selected={selected} onSelect={setSelected} />
      )}

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
              <Pressable
                key={habit.id}
                onPress={() => router.push(`/habit/${habit.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${habit.name}, ${done ? 'completed' : 'not completed'}`}
                accessibilityHint="Opens habit details"
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
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )
}

function MonthGrid({
  monthCursor,
  today,
  selected,
  counts,
  onPrev,
  onNext,
  onSelect,
}: {
  monthCursor: string
  today: string
  selected: string
  counts: Map<string, number>
  onPrev: () => void
  onNext: () => void
  onSelect: (d: string) => void
}) {
  const gridStart = startOfWeek(firstOfMonth(monthCursor), 0)
  const cursorMonth = monthOf(monthCursor)
  const atCurrentMonth = cursorMonth >= monthOf(today)

  return (
    <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={onPrev} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous month">
          <Text style={{ fontSize: 22, color: colors.accent }}>‹</Text>
        </Pressable>
        <Text style={{ fontSize: 15, fontFamily: fonts.display, color: colors.ink }}>{formatMonth(monthCursor)}</Text>
        <Pressable onPress={atCurrentMonth ? undefined : onNext} hitSlop={10} disabled={atCurrentMonth} accessibilityRole="button" accessibilityLabel="Next month">
          <Text style={{ fontSize: 22, color: atCurrentMonth ? colors.track : colors.accent }}>›</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontFamily: fonts.semibold, color: colors.muted }}>
            {w}
          </Text>
        ))}
      </View>

      <View style={{ gap: 5 }}>
        {Array.from({ length: 6 }, (_, row) => (
          <View key={row} style={{ flexDirection: 'row', gap: 5 }}>
            {Array.from({ length: 7 }, (_, col) => {
              const date = addDays(gridStart, row * 7 + col)
              const inMonth = monthOf(date) === cursorMonth
              const future = date > today
              const n = counts.get(date) ?? 0
              const isToday = date === today
              const isSelected = date === selected
              const tappable = inMonth && !future
              return (
                <Pressable
                  key={col}
                  disabled={!tappable}
                  onPress={() => onSelect(date)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={inMonth ? `${formatDay(date)}, ${n} completed` : undefined}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: !inMonth ? 'transparent' : n > 0 ? heat[level(n)] : colors.card,
                    borderWidth: isSelected ? 2 : isToday ? 2 : 0,
                    borderColor: isSelected ? colors.ink : colors.accent,
                    opacity: !inMonth ? 0.35 : future ? 0.4 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: isToday ? fonts.bold : fonts.body,
                      color: n >= 3 && inMonth ? '#fff' : colors.ink,
                    }}
                  >
                    {Number(date.slice(8, 10))}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>
    </View>
  )
}

function Heatmap({
  today,
  counts,
  selected,
  onSelect,
}: {
  today: string
  counts: Map<string, number>
  selected: string
  onSelect: (d: string) => void
}) {
  const start = addDays(startOfWeek(today, 0), -((WEEKS - 1) * 7))
  return (
    <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.muted, marginBottom: 12 }}>
        LAST {WEEKS} WEEKS
      </Text>
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
                  onPress={() => onSelect(date)}
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
      <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 12, justifyContent: 'flex-end' }}>
        <Text style={{ fontSize: 10, color: colors.muted }}>Less</Text>
        {heat.map((c) => (
          <View key={c} style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: c }} />
        ))}
        <Text style={{ fontSize: 10, color: colors.muted }}>More</Text>
      </View>
    </View>
  )
}
