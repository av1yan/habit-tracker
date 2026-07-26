import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { stats as statsRepo } from '@backend/local'
import { useLocalData } from '@/lib/useLocalData'
import { useTheme } from '@/lib/theme-context'
import { EmptyState, ErrorState, Loading } from '@/components/ScreenState'
import { STAGES, stageIndex, THRIVING } from '@/lib/garden'
import { colors, fonts, rgba } from '@/lib/theme'

export default function Garden() {
  useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { data, loading, error, reload } = useLocalData((l) => statsRepo.getAllStats(l))

  const plants = data ?? []
  const thriving = plants.filter((p) => p.current_streak >= THRIVING).length
  const tileW = (width - 32 - 12) / 2

  const subtitle =
    plants.length === 0
      ? ''
      : thriving === plants.length
        ? 'Every plant is thriving 🌿'
        : thriving > 0
          ? `${thriving} of ${plants.length} plants thriving`
          : 'Check in today to help them grow'

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24, paddingHorizontal: 16 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 4, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontFamily: fonts.display, color: colors.ink }}>Garden</Text>
          {subtitle ? (
            <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.sub, marginTop: 3 }}>{subtitle}</Text>
          ) : null}
        </View>
        {plants.length > 0 && (
          <Pressable
            onPress={() => router.push('/share-card')}
            accessibilityRole="button"
            accessibilityLabel="Share your garden"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: colors.card,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ fontSize: 13 }}>↗</Text>
            <Text style={{ fontSize: 13, fontFamily: fonts.semibold, color: colors.accent }}>Share</Text>
          </Pressable>
        )}
      </View>

      {loading && <Loading />}
      {error && <ErrorState message={error.message} onRetry={reload} />}
      {data && plants.length === 0 && (
        <EmptyState
          icon="🌱"
          title="Your garden is empty"
          subtitle="Add a habit and check it off — every streak grows a plant here."
        />
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {plants.map((p) => (
          <Plant
            key={p.habit_id}
            width={tileW}
            name={p.name}
            color={p.color}
            streak={p.current_streak}
            onPress={() => router.push(`/habit/${p.habit_id}`)}
          />
        ))}
      </View>
    </ScrollView>
  )
}

function Plant({
  width,
  name,
  color,
  streak,
  onPress,
}: {
  width: number
  name: string
  color: string
  streak: number
  onPress: () => void
}) {
  const idx = stageIndex(streak)
  const stage = STAGES[idx]
  const next = idx > 0 ? STAGES[idx - 1] : null // the stage above this one
  const dormant = streak <= 0

  const progress = next ? Math.min(1, (streak - stage.min) / (next.min - stage.min)) : 1
  const toNext = next ? next.min - streak : 0

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${stage.label}, ${streak} day streak. Open habit.`}
      style={{
        width,
        borderRadius: 18,
        paddingVertical: 18,
        paddingHorizontal: 14,
        alignItems: 'center',
        backgroundColor: rgba(color, dormant ? 0.05 : 0.09),
      }}
    >
      <Text style={{ fontSize: 52, marginBottom: 10 }}>{stage.emoji}</Text>

      <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: fonts.semibold, color: colors.ink, maxWidth: '100%' }}>
        {name}
      </Text>
      <Text style={{ fontSize: 12, fontFamily: fonts.body, color: colors.sub, marginTop: 2 }}>
        {dormant ? stage.label : `🔥 ${streak} · ${stage.label}`}
      </Text>

      {/* Progress toward the next stage */}
      <View style={{ height: 5, borderRadius: 999, backgroundColor: rgba(color, 0.16), overflow: 'hidden', alignSelf: 'stretch', marginTop: 14 }}>
        <View style={{ height: 5, borderRadius: 999, backgroundColor: color, width: `${progress * 100}%` }} />
      </View>
      <Text style={{ fontSize: 10, fontFamily: fonts.body, color: colors.muted, marginTop: 6 }}>
        {next ? `${toNext} day${toNext === 1 ? '' : 's'} to ${next.label}` : 'Fully grown 🎉'}
      </Text>
    </Pressable>
  )
}
