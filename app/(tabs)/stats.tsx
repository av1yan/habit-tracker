import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { stats as statsRepo } from '@backend/local'
import { useLocalData } from '@/lib/useLocalData'
import { useTheme } from '@/lib/theme-context'
import { EmptyState, ErrorState, Loading } from '@/components/ScreenState'
import { deriveAchievements, earnedCount, type AchievementView } from '@/lib/achievements'
import { colors, fonts, rgba } from '@/lib/theme'

export default function Stats() {
  useTheme()
  const insets = useSafeAreaInsets()
  const { data, loading, error, reload } = useLocalData(async (l) => ({
    perHabit: await statsRepo.getAllStats(l),
    overall: await statsRepo.getOverallCompletion(l),
  }))

  const perHabit = data?.perHabit ?? []
  const bestStreak = perHabit.reduce((m, s) => Math.max(m, s.longest_streak), 0)
  const totalDone = perHabit.reduce((m, s) => m + s.total_completions, 0)
  const achievements = deriveAchievements({ bestStreak, totalDone, habitCount: perHabit.length })

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24, gap: 12 }}
    >
      <Text style={{ fontSize: 26, fontFamily: fonts.display, color: colors.ink, marginHorizontal: 20 }}>
        Your Stats
      </Text>

      {loading && <Loading />}
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {data && perHabit.length === 0 && (
        <EmptyState
          icon="📊"
          title="No stats yet"
          subtitle="Add a habit and check it off to start seeing your progress here."
        />
      )}

      {data && perHabit.length > 0 && (
        <>
      <View style={{ marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 20, padding: 22 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.sub }}>
          OVERALL COMPLETION
        </Text>
        <Text style={{ fontSize: 52, fontFamily: fonts.display, color: colors.accent, marginTop: 4 }}>
          {data?.overall ?? 0}%
        </Text>
      </View>

      <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.muted, marginBottom: 12 }}>
          PER HABIT
        </Text>
        {perHabit.map((s) => (
          <View key={s.habit_id} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontFamily: fonts.semibold, color: colors.ink }}>
                {s.icon} {s.name}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>🔥 {s.current_streak}d</Text>
            </View>
            <View style={{ height: 6, backgroundColor: colors.card, borderRadius: 999, overflow: 'hidden' }}>
              <View style={{ height: 6, borderRadius: 999, backgroundColor: s.color, width: `${s.rate_90d}%` }} />
            </View>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16 }}>
        <Stat label="best streak" value={bestStreak} color={colors.accent} />
        <Stat label="total done" value={totalDone} color={colors.green} />
      </View>

      <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ fontSize: 11, fontFamily: fonts.semibold, letterSpacing: 1, color: colors.muted }}>
            ACHIEVEMENTS
          </Text>
          <Text style={{ fontSize: 11, fontFamily: fonts.semibold, color: colors.muted }}>
            {earnedCount(achievements)} of {achievements.length} earned
          </Text>
        </View>
        <View style={{ gap: 14 }}>
          {achievements.map((a) => (
            <AchievementRow key={a.kind} a={a} />
          ))}
        </View>
      </View>
        </>
      )}
    </ScrollView>
  )
}

function AchievementRow({ a }: { a: AchievementView }) {
  return (
    <View
      accessible
      accessibilityLabel={`${a.title}, ${a.goal}. ${a.earned ? 'Achieved' : a.detail}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: a.earned ? 1 : 0.55 }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: a.earned ? rgba(colors.accent, 0.15) : colors.card,
        }}
      >
        <Text style={{ fontSize: 22 }}>{a.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontFamily: fonts.semibold, color: colors.ink }}>{a.title}</Text>
        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>{a.goal}</Text>
        {!a.earned && (
          <View style={{ height: 5, backgroundColor: colors.card, borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
            <View style={{ height: 5, borderRadius: 999, backgroundColor: colors.accent, width: `${a.progress * 100}%` }} />
          </View>
        )}
      </View>
      <Text
        style={{
          fontSize: 12,
          fontFamily: fonts.semibold,
          color: a.earned ? colors.green : colors.muted,
          maxWidth: 96,
          textAlign: 'right',
        }}
      >
        {a.detail}
      </Text>
    </View>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 16, alignItems: 'center' }}>
      <Text style={{ fontSize: 34, fontFamily: fonts.display, color }}>{value}</Text>
      <Text style={{ fontSize: 11, fontFamily: fonts.body, color: colors.muted, marginTop: 5 }}>{label}</Text>
    </View>
  )
}
