import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Link, useRouter } from 'expo-router'
import { logs } from '@backend/local'
import { useApp } from '@/lib/app-context'
import { useLocalData } from '@/lib/useLocalData'
import { useTheme } from '@/lib/theme-context'
import { Ring } from '@/components/Ring'
import { EmptyState, ErrorState, Loading } from '@/components/ScreenState'
import { colors, fonts, rgba, streakBadge } from '@/lib/theme'

export default function Today() {
  useTheme() // re-render on theme change
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { local, refresh } = useApp()
  const { data, loading, error, reload } = useLocalData((l) => logs.getToday(l))

  const greeting = (() => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  })()
  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const toggle = async (habitId: string) => {
    if (!local) return
    await logs.toggleHabit(local, habitId)
    refresh()
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20 }}>
        <View>
          <Text style={{ fontSize: 26, fontFamily: fonts.display, color: colors.ink }}>{greeting}</Text>
          <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.muted, marginTop: 3 }}>{dateStr}</Text>
        </View>
        <Link href="/new-habit" asChild>
          <Pressable
            accessibilityLabel="Add habit"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 22, color: colors.accent, marginTop: -2 }}>+</Text>
          </Pressable>
        </Link>
      </View>

      <View
        accessibilityRole="summary"
        accessibilityLabel={`${data?.completedCount ?? 0} of ${data?.totalCount ?? 0} habits completed today, ${data?.pct ?? 0} percent`}
        style={{
          marginHorizontal: 16,
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 18,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <Ring pct={data?.pct ?? 0}>
          <Text style={{ fontSize: 15, fontFamily: fonts.display, color: colors.ink }}>
            {data?.pct ?? 0}%
          </Text>
        </Ring>
        <View>
          <Text style={{ fontSize: 30, fontFamily: fonts.display, color: colors.ink }}>
            {data?.completedCount ?? 0}
            <Text style={{ fontSize: 18, fontFamily: fonts.display, color: colors.muted }}>/{data?.totalCount ?? 0}</Text>
          </Text>
          <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.sub, marginTop: 4 }}>habits today</Text>
        </View>
      </View>

      <Text
        style={{
          fontSize: 11,
          fontFamily: fonts.semibold,
          letterSpacing: 1,
          color: colors.muted,
          marginTop: 20,
          marginHorizontal: 18,
        }}
      >
        TODAY'S HABITS
      </Text>

      <View style={{ padding: 16, gap: 9 }}>
        {loading && <Loading />}
        {error && <ErrorState message={error.message} onRetry={reload} />}
        {data && data.habits.length === 0 && (
          <EmptyState
            icon="🌱"
            title="No habits yet"
            subtitle="Tap + to add your first habit and start a streak."
          />
        )}
        {(data?.habits ?? []).map(({ habit, done }) => {
          const badge = streakBadge(0)
          return (
            <Pressable
              key={habit.id}
              onPress={() => router.push(`/habit/${habit.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${habit.name}, ${habit.category}`}
              accessibilityHint="Opens habit details"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 13,
              }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: rgba(habit.color, 0.15),
                }}
              >
                <Text style={{ fontSize: 22 }}>{habit.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: fonts.semibold, color: colors.ink }}>
                  {habit.name} {badge}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginTop: 2 }}>
                  {habit.category}
                </Text>
              </View>
              <Pressable
                onPress={() => toggle(habit.id)}
                hitSlop={8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={`Mark ${habit.name} ${done ? 'not done' : 'done'}`}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done ? habit.color : 'transparent',
                  borderWidth: done ? 0 : 2.5,
                  borderColor: '#d0c8be',
                }}
              >
                {done && <Text style={{ color: '#fff', fontWeight: '900' }}>✓</Text>}
              </Pressable>
            </Pressable>
          )
        })}
      </View>
    </ScrollView>
  )
}
