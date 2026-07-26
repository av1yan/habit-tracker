import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { stats as statsRepo } from '@backend/local'
import { useLocalData } from '@/lib/useLocalData'
import { useTheme } from '@/lib/theme-context'
import { EmptyState, ErrorState, Loading } from '@/components/ScreenState'
import { colors, fonts, rgba } from '@/lib/theme'

// Growth stages by current streak. A plant grows the longer you keep the streak
// alive; a broken streak leaves a dormant seed to coax back to life.
interface Stage {
  min: number
  emoji: string
  label: string
}
const STAGES: Stage[] = [
  { min: 100, emoji: '🌳', label: 'Mighty' },
  { min: 30, emoji: '🌻', label: 'Blooming' },
  { min: 14, emoji: '🌷', label: 'Flowering' },
  { min: 7, emoji: '🪴', label: 'Thriving' },
  { min: 3, emoji: '🌿', label: 'Sprouting' },
  { min: 1, emoji: '🌱', label: 'Seedling' },
  { min: 0, emoji: '🌰', label: 'Dormant' },
]
const stageIndex = (streak: number) => STAGES.findIndex((s) => streak >= s.min)

const THRIVING = 7 // streak at which a plant is considered thriving

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
      <View style={{ marginHorizontal: 4, marginBottom: 16 }}>
        <Text style={{ fontSize: 26, fontFamily: fonts.display, color: colors.ink }}>Garden</Text>
        {subtitle ? (
          <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.sub, marginTop: 3 }}>{subtitle}</Text>
        ) : null}
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
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        backgroundColor: rgba(color, dormant ? 0.06 : 0.13),
        borderWidth: 1,
        borderColor: rgba(color, dormant ? 0.08 : 0.18),
        opacity: dormant ? 0.85 : 1,
      }}
    >
      <View
        style={{
          width: 84,
          height: 84,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: rgba(color, dormant ? 0.08 : 0.16),
          marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 44 }}>{stage.emoji}</Text>
      </View>

      <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: fonts.semibold, color: colors.ink, maxWidth: '100%' }}>
        {name}
      </Text>
      <Text style={{ fontSize: 12, fontFamily: fonts.body, color: colors.sub, marginTop: 3 }}>
        {dormant ? stage.label : `🔥 ${streak} · ${stage.label}`}
      </Text>

      {/* Progress toward the next stage */}
      <View style={{ width: '100%', marginTop: 12 }}>
        <View style={{ height: 6, borderRadius: 999, backgroundColor: rgba(color, 0.12), overflow: 'hidden' }}>
          <View style={{ height: 6, borderRadius: 999, backgroundColor: color, width: `${progress * 100}%` }} />
        </View>
        <Text style={{ fontSize: 10, fontFamily: fonts.body, color: colors.muted, marginTop: 5, textAlign: 'center' }}>
          {next ? `${toNext} day${toNext === 1 ? '' : 's'} to ${next.label}` : 'Fully grown 🎉'}
        </Text>
      </View>
    </Pressable>
  )
}
