import { useEffect, useRef, useState } from 'react'
import { PanResponder, Pressable, ScrollView, Text, View } from 'react-native'
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

  // Swipe left/right to change month. A ref holds the latest bound + callbacks
  // so the responder (created once) never acts on stale values.
  const latest = useRef({ atCurrentMonth, onPrev, onNext })
  latest.current = { atCurrentMonth, onPrev, onNext }
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_e, g) => {
        const l = latest.current
        if (g.dx > 45) l.onPrev()
        else if (g.dx < -45 && !l.atCurrentMonth) l.onNext()
      },
    }),
  ).current

  return (
    <View {...pan.panHandlers} style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12 }}>
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

const CELL = 13
const CELL_PITCH = CELL + 3 // cell + row/col gap
const WDAY_COL = 26 // left gutter for weekday labels
const WDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''] // Sun..Sat, GitHub-style

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

  // Month labels above the column where each new month begins.
  const monthLabels: { x: number; label: string }[] = []
  let prevMonth = ''
  for (let w = 0; w < WEEKS; w++) {
    const d = addDays(start, w * 7)
    const m = monthOf(d)
    if (m !== prevMonth) {
      prevMonth = m
      const [y, mm] = d.split('-').map(Number)
      monthLabels.push({ x: w * CELL_PITCH, label: new Date(y, mm - 1, 1).toLocaleDateString(undefined, { month: 'short' }) })
    }
  }

  const values = [...counts.values()]
  const activeDays = values.filter((v) => v > 0).length
  const checkins = values.reduce((a, b) => a + b, 0)

  return (
    <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.muted }}>LAST {WEEKS} WEEKS</Text>
        <Text style={{ fontSize: 12, fontFamily: fonts.semibold, color: colors.sub }}>
          {activeDays} active {activeDays === 1 ? 'day' : 'days'} · {checkins} check-in{checkins === 1 ? '' : 's'}
        </Text>
      </View>

      {/* Month labels */}
      <View style={{ height: 14, marginLeft: WDAY_COL }}>
        {monthLabels.map((m) => (
          <Text
            key={m.label + m.x}
            style={{ position: 'absolute', left: m.x, fontSize: 10, color: colors.muted }}
          >
            {m.label}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row' }}>
        {/* Weekday labels */}
        <View style={{ width: WDAY_COL, gap: 3 }}>
          {WDAY_LABELS.map((w, i) => (
            <View key={i} style={{ height: CELL, justifyContent: 'center' }}>
              <Text style={{ fontSize: 9, color: colors.muted }}>{w}</Text>
            </View>
          ))}
        </View>

        {/* Grid */}
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
                      width: CELL,
                      height: CELL,
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
