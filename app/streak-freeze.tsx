import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  habits as habitsRepo,
  logs as logsRepo,
  profile as profileRepo,
  freezes as freezeRepo,
} from '@backend/local'
import type { Habit } from '@backend/local'
import { useApp } from '@/lib/app-context'
import { useLocalData } from '@/lib/useLocalData'
import { useTheme } from '@/lib/theme-context'
import { track } from '@/lib/analytics'
import { colors, fonts, rgba } from '@/lib/theme'

export default function StreakFreeze() {
  useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { local, refresh } = useApp()

  const { data } = useLocalData(async (l) => {
    const [profile, hs, today] = await Promise.all([
      profileRepo.getProfile(l),
      habitsRepo.listHabits(l),
      logsRepo.getToday(l),
    ])
    const frozen = new Set(
      today.habits.filter((h) => h.status === 'frozen').map((h) => h.habit.id),
    )
    return { balance: profile?.streak_freeze_balance ?? 0, habits: hs, frozen }
  })

  const balance = data?.balance ?? 0

  const useOn = (habit: Habit) => {
    Alert.alert(
      'Use a streak freeze?',
      `This protects today's ${habit.name} streak — the day counts as kept. You have ${balance} freeze${balance === 1 ? '' : 's'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use one',
          onPress: async () => {
            if (!local) return
            try {
              await freezeRepo.useStreakFreeze(local, habit.id)
              void track('streak_freeze_used', { from: 'streak_freeze_screen' })
              refresh()
            } catch (e) {
              Alert.alert('Streak freeze', (e as Error).message)
            }
          },
        },
      ],
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={{ color: colors.accent, fontFamily: fonts.bold, fontSize: 15 }}>‹ Back</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.ink, flex: 1 }}>Streak Freeze</Text>
      </View>

      {/* Balance hero */}
      <View style={{ marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 20, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: rgba('#4a90d9', 0.15),
          }}
        >
          <Text style={{ fontSize: 32 }}>🧊</Text>
        </View>
        <View>
          <Text style={{ fontSize: 40, fontFamily: fonts.display, color: colors.ink, lineHeight: 44 }}>{balance}</Text>
          <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.sub, marginTop: 2 }}>
            freeze{balance === 1 ? '' : 's'} available
          </Text>
        </View>
      </View>

      <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.sub, lineHeight: 20, marginHorizontal: 20, marginTop: 14 }}>
        A streak freeze protects a habit’s streak on a day you miss — the day counts as kept instead of breaking the chain. Freezes are limited, so save them for when you really need one.
      </Text>

      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, color: colors.muted, marginHorizontal: 20, marginTop: 22, marginBottom: 10 }}>
        PROTECT A HABIT TODAY
      </Text>

      <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
        {(data?.habits ?? []).map((habit, i) => {
          const isFrozen = data?.frozen.has(habit.id)
          return (
            <View
              key={habit.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.bg,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: rgba(habit.color, 0.15),
                }}
              >
                <Text style={{ fontSize: 20 }}>{habit.icon}</Text>
              </View>
              <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>{habit.name}</Text>
              {isFrozen ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 14 }}>🧊</Text>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.sub }}>Frozen</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => useOn(habit)}
                  disabled={balance <= 0}
                  accessibilityRole="button"
                  accessibilityLabel={`Freeze today for ${habit.name}`}
                  accessibilityState={{ disabled: balance <= 0 }}
                  style={{
                    backgroundColor: balance > 0 ? colors.btn : colors.card,
                    borderRadius: 999,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: balance > 0 ? '#fff' : colors.muted, fontFamily: fonts.bold, fontSize: 13 }}>
                    Freeze
                  </Text>
                </Pressable>
              )}
            </View>
          )
        })}
        {(data?.habits ?? []).length === 0 && (
          <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, padding: 16 }}>
            You don’t have any habits yet.
          </Text>
        )}
      </View>

      {balance <= 0 && (data?.habits ?? []).length > 0 && (
        <Text style={{ fontSize: 12, fontFamily: fonts.body, color: colors.muted, marginHorizontal: 20, marginTop: 12, lineHeight: 18 }}>
          You have no freezes to use right now. Keep your streaks going and you’ll have them when you need them.
        </Text>
      )}
    </ScrollView>
  )
}
