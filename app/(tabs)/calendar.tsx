import { useEffect, useRef, useState } from 'react'
import { PanResponder, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { habits as habitsRepo, logs as logsRepo, stats as statsRepo } from '@backend/local'
import type { Habit } from '@backend/local'
import type { TodayView } from '@backend/data'
import { addDays, startOfWeek, toLocalISODate } from '@backend/data'
import { useApp } from '@/lib/app-context'
import { useTheme } from '@/lib/theme-context'
import { Loading } from '@/components/ScreenState'
import { colors, fonts, heat, rgba } from '@/lib/theme'

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

// Shade relative to the busiest day in view, so dense data still shows gradients
// instead of a solid block of the darkest color.
const levelFor = (n: number, max: number) =>
  n <= 0 ? 0 : Math.min(4, Math.max(1, Math.round((n / Math.max(1, max)) * 4)))

export default function Calendar() {
  const { scheme } = useTheme()
  const insets = useSafeAreaInsets()
  const { local, version } = useApp()
  const router = useRouter()

  const today = toLocalISODate()
  const [view, setView] = useState<'month' | 'heatmap'>('month')
  const [monthCursor, setMonthCursor] = useState(firstOfMonth(today))
  const [selected, setSelected] = useState(today)
  const [counts, setCounts] = useState<Map<string, number>>(new Map())
  const [perHabit, setPerHabit] = useState<PerHabitData | null>(null)
  const [day, setDay] = useState<TodayView | null>(null)

  // Month view: per-day completion counts for the visible month grid.
  useEffect(() => {
    if (!local || view !== 'month') return
    let alive = true
    const gridStart = startOfWeek(firstOfMonth(monthCursor), 0)
    const gridEnd = addDays(gridStart, 41)
    statsRepo.heatmap(local, gridStart, gridEnd).then((rows) => {
      if (alive) setCounts(new Map(rows.map((c) => [c.log_date, c.completions])))
    })
    return () => {
      alive = false
    }
  }, [local, view, monthCursor, version])

  // Heatmap view: per-habit completion across the last HEATMAP_DAYS days.
  useEffect(() => {
    if (!local || view !== 'heatmap') return
    let alive = true
    setPerHabit(null)
    const from = addDays(today, -(HEATMAP_DAYS - 1))
    Promise.all([habitsRepo.listHabits(local), logsRepo.completionsByHabit(local, from, today)]).then(
      ([hs, rows]) => {
        const done = new Map<string, Set<string>>()
        for (const r of rows) {
          let s = done.get(r.habit_id)
          if (!s) done.set(r.habit_id, (s = new Set()))
          s.add(r.log_date)
        }
        const days = Array.from({ length: HEATMAP_DAYS }, (_, i) => addDays(from, i))
        if (alive) setPerHabit({ days, habits: hs, done })
      },
    )
    return () => {
      alive = false
    }
  }, [local, view, today, version])

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
          scheme={scheme}
          onPrev={() => setMonthCursor((c) => shiftMonth(c, -1))}
          onNext={() => setMonthCursor((c) => shiftMonth(c, 1))}
          onSelect={setSelected}
        />
      ) : (
        <PerHabitGrid
          data={perHabit}
          today={today}
          selected={selected}
          onSelect={setSelected}
          onOpenHabit={(id) => router.push(`/habit/${id}`)}
        />
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
  scheme,
  onPrev,
  onNext,
  onSelect,
}: {
  monthCursor: string
  today: string
  selected: string
  counts: Map<string, number>
  scheme: 'light' | 'dark'
  onPrev: () => void
  onNext: () => void
  onSelect: (d: string) => void
}) {
  const gridStart = startOfWeek(firstOfMonth(monthCursor), 0)
  const cursorMonth = monthOf(monthCursor)
  const atCurrentMonth = cursorMonth >= monthOf(today)
  const maxN = Math.max(1, ...counts.values())

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
              const lvl = levelFor(n, maxN)
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
                    backgroundColor: !inMonth ? 'transparent' : n > 0 ? heat[lvl] : colors.card,
                    borderWidth: isSelected ? 2 : isToday ? 2 : 0,
                    borderColor: isSelected ? colors.ink : colors.accent,
                    opacity: !inMonth ? 0.35 : future ? 0.4 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: isToday ? fonts.bold : fonts.body,
                      // High-level cells are the ramp's loud end: dark in light
                      // mode (needs white text), bright in dark mode (needs dark).
                      color: inMonth && lvl >= 3 ? (scheme === 'dark' ? '#201e1d' : '#fff') : colors.ink,
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

const HEATMAP_DAYS = 14
const WEEKDAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface PerHabitData {
  days: string[]
  habits: Habit[]
  done: Map<string, Set<string>>
}

function dowOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

// Per-habit grid: one row per habit, last HEATMAP_DAYS days, each cell in the
// habit's own color when completed — so you can see *which* habits you're
// keeping up, not just how many.
function PerHabitGrid({
  data,
  today,
  selected,
  onSelect,
  onOpenHabit,
}: {
  data: PerHabitData | null
  today: string
  selected: string
  onSelect: (d: string) => void
  onOpenHabit: (id: string) => void
}) {
  const { width } = useWindowDimensions()
  const LABEL_W = 104
  const GAP = 3
  const contentW = width - 32 - 32 - LABEL_W
  const cell = Math.max(12, Math.floor((contentW - (HEATMAP_DAYS - 1) * GAP) / HEATMAP_DAYS))

  return (
    <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.muted }}>PER HABIT</Text>
        <Text style={{ fontSize: 12, fontFamily: fonts.semibold, color: colors.sub }}>last {HEATMAP_DAYS} days</Text>
      </View>

      {!data ? (
        <Loading />
      ) : data.habits.length === 0 ? (
        <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.muted, paddingVertical: 8 }}>
          Add a habit to start filling this in.
        </Text>
      ) : (
        <>
          {/* Weekday axis */}
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            <View style={{ width: LABEL_W }} />
            <View style={{ flexDirection: 'row', gap: GAP, flex: 1 }}>
              {data.days.map((d) => {
                const isToday = d === today
                const isSel = d === selected
                return (
                  <Pressable
                    key={d}
                    onPress={() => onSelect(d)}
                    accessibilityRole="button"
                    accessibilityLabel={formatDay(d)}
                    style={{ width: cell, alignItems: 'center' }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontFamily: isToday || isSel ? fonts.bold : fonts.body,
                        color: isToday ? colors.accent : isSel ? colors.ink : colors.muted,
                      }}
                    >
                      {WEEKDAY_INITIAL[dowOf(d)]}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* Habit rows */}
          <View style={{ gap: 6 }}>
            {data.habits.map((h) => {
              const set = data.done.get(h.id)
              return (
                <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Pressable
                    onPress={() => onOpenHabit(h.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${h.name}, open details`}
                    style={{ width: LABEL_W, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 }}
                  >
                    <Text style={{ fontSize: 15 }}>{h.icon}</Text>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontFamily: fonts.semibold, color: colors.ink }}>
                      {h.name}
                    </Text>
                  </Pressable>
                  <View style={{ flexDirection: 'row', gap: GAP, flex: 1 }}>
                    {data.days.map((d) => {
                      const done = set?.has(d)
                      const isSel = d === selected
                      return (
                        <Pressable
                          key={d}
                          onPress={() => onSelect(d)}
                          hitSlop={1}
                          accessibilityRole="button"
                          accessibilityLabel={`${h.name}, ${formatDay(d)}, ${done ? 'done' : 'not done'}`}
                          accessibilityState={{ selected: isSel }}
                          style={{
                            width: cell,
                            height: cell,
                            borderRadius: 4,
                            backgroundColor: done ? h.color : rgba(h.color, 0.16),
                            borderWidth: isSel ? 1.5 : 0,
                            borderColor: colors.ink,
                          }}
                        />
                      )
                    })}
                  </View>
                </View>
              )
            })}
          </View>

          <Text style={{ fontSize: 11, fontFamily: fonts.body, color: colors.muted, marginTop: 14, lineHeight: 16 }}>
            Filled = done that day. Tap a day for details, or a habit to open it.
          </Text>
        </>
      )}
    </View>
  )
}
