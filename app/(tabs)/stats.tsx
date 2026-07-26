import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { stats as statsRepo } from '@backend/local'
import { useLocalData } from '@/lib/useLocalData'
import { useTheme } from '@/lib/theme-context'
import { colors, fonts } from '@/lib/theme'

export default function Stats() {
  useTheme()
  const insets = useSafeAreaInsets()
  const { data } = useLocalData(async (l) => ({
    perHabit: await statsRepo.getAllStats(l),
    overall: await statsRepo.getOverallCompletion(l),
  }))

  const perHabit = data?.perHabit ?? []
  const bestStreak = perHabit.reduce((m, s) => Math.max(m, s.longest_streak), 0)
  const totalDone = perHabit.reduce((m, s) => m + s.total_completions, 0)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24, gap: 12 }}
    >
      <Text style={{ fontSize: 26, fontFamily: fonts.display, color: colors.ink, marginHorizontal: 20 }}>
        Your Stats
      </Text>

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
        {perHabit.length === 0 && (
          <Text style={{ color: colors.muted, fontSize: 13 }}>No data yet.</Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16 }}>
        <Stat label="best streak" value={bestStreak} color={colors.accent} />
        <Stat label="total done" value={totalDone} color={colors.green} />
      </View>
    </ScrollView>
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
