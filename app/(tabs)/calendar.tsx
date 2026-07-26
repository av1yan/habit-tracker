import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { stats as statsRepo } from '@backend/local'
import { addDays, startOfWeek, toLocalISODate } from '@backend/data'
import { useLocalData } from '@/lib/useLocalData'
import { useTheme } from '@/lib/theme-context'
import { Loading } from '@/components/ScreenState'
import { colors, fonts, heat } from '@/lib/theme'

const WEEKS = 15

export default function Calendar() {
  useTheme()
  const insets = useSafeAreaInsets()
  const { data, loading } = useLocalData((l) => statsRepo.recentHeatmap(l, WEEKS))

  const counts = new Map((data ?? []).map((c) => [c.log_date, c.completions]))
  const today = toLocalISODate()
  const start = addDays(startOfWeek(today, 0), -((WEEKS - 1) * 7))

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
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Daily completion heatmap for the last ${WEEKS} weeks`}
          style={{ flexDirection: 'row', gap: 3 }}
        >
          {Array.from({ length: WEEKS }, (_, w) => (
            <View key={w} style={{ gap: 3 }}>
              {Array.from({ length: 7 }, (_, d) => {
                const date = addDays(start, w * 7 + d)
                const future = date > today
                const lvl = level(counts.get(date) ?? 0)
                return (
                  <View
                    key={d}
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: 3,
                      backgroundColor: future ? 'transparent' : heat[lvl],
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
    </ScrollView>
  )
}
