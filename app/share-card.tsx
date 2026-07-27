import { useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Share, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { stats as statsRepo } from '@backend/local'
import { useLocalData } from '@/lib/useLocalData'
import { useTheme } from '@/lib/theme-context'
import { Loading } from '@/components/ScreenState'
import { stageFor, THRIVING } from '@/lib/garden'
import { track } from '@/lib/analytics'
import { colors, fonts, rgba } from '@/lib/theme'

// The card uses a fixed warm palette (not the live theme) so a shared image
// always looks the same and on-brand, whatever mode the app is in.
const CARD = {
  bg: '#f6ecd9',
  ink: '#201e1d',
  sub: '#6d6455',
  muted: '#8a7f6d',
  accent: '#a85e2c',
  line: '#e6d9c1',
}

export default function ShareCard() {
  useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const shotRef = useRef<View>(null)
  const [busy, setBusy] = useState(false)

  const { data } = useLocalData(async (l) => ({
    perHabit: await statsRepo.getAllStats(l),
    overall: await statsRepo.getOverallCompletion(l),
  }))

  const habits = data?.perHabit ?? []
  const overall = data?.overall ?? 0
  // All-time best (longest) streak — the number worth flexing, so it stays
  // impressive even on a day nothing's checked off yet.
  const bestStreak = habits.reduce((m, h) => Math.max(m, h.longest_streak), 0)
  const bestHabit = habits.find((h) => h.longest_streak === bestStreak)
  const thriving = habits.filter((h) => h.current_streak >= THRIVING).length
  const checkins = habits.reduce((a, h) => a + h.total_completions, 0)

  const cardW = Math.min(360, width - 40)

  const message = `🌱 My habit garden — ${thriving} of ${habits.length} plants thriving, ${bestStreak}-day best streak, ${overall}% done. Growing with Habits.`

  const onShare = async () => {
    setBusy(true)
    void track('garden_shared')
    // Try to export the card as an image (needs a dev build).
    try {
      const [{ captureRef }, Sharing] = await Promise.all([
        import('react-native-view-shot'),
        import('expo-sharing'),
      ])
      const uri = await captureRef(shotRef, { format: 'png', quality: 1 })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your garden', UTI: 'public.png' })
        setBusy(false)
        return
      }
    } catch {
      // Image capture unavailable (e.g. Expo Go) — fall back to text.
    }
    try {
      await Share.share({ message })
    } catch {
      /* user dismissed */
    }
    setBusy(false)
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={{ color: colors.accent, fontFamily: fonts.bold, fontSize: 15 }}>Done</Text>
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.display, fontSize: 18, color: colors.ink }}>Share</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: 20, paddingBottom: insets.bottom + 24 }}>
        {!data ? (
          <Loading />
        ) : (
          <>
            {/* Capturable card */}
            <View ref={shotRef} collapsable={false} style={{ width: cardW, backgroundColor: CARD.bg, borderRadius: 24, padding: 24 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.5, color: CARD.accent, textAlign: 'center' }}>
                MY HABIT GARDEN
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 20, marginBottom: 18 }}>
                {habits.slice(0, 6).map((h) => (
                  <View
                    key={h.habit_id}
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: rgba(h.color, 0.16),
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>{stageFor(h.current_streak).emoji}</Text>
                  </View>
                ))}
              </View>

              <View style={{ alignItems: 'center', marginBottom: 18 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 46, color: CARD.ink, lineHeight: 50 }}>🔥 {bestStreak}</Text>
                <Text style={{ fontSize: 13, fontFamily: fonts.body, color: CARD.sub, marginTop: 4 }}>
                  day best streak{bestHabit && bestStreak > 0 ? ` · ${bestHabit.name}` : ''}
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: CARD.line }} />

              <View style={{ flexDirection: 'row', marginTop: 16 }}>
                <CardStat value={`${thriving}/${habits.length}`} label="thriving" />
                <CardStat value={checkins} label="check-ins" />
                <CardStat value={`${overall}%`} label="done" />
              </View>

              <Text style={{ textAlign: 'center', fontSize: 11, fontFamily: fonts.semibold, color: CARD.muted, marginTop: 20 }}>
                Grown with Habits 🌿
              </Text>
            </View>

            {/* Share button */}
            <Pressable
              onPress={onShare}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Share garden card"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: 24,
                backgroundColor: colors.btn,
                borderRadius: 999,
                paddingHorizontal: 28,
                paddingVertical: 15,
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={{ fontSize: 15 }}>↗</Text>
                  <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 15 }}>Share my garden</Text>
                </>
              )}
            </Pressable>

            <Text style={{ fontSize: 11, fontFamily: fonts.body, color: colors.muted, marginTop: 12, textAlign: 'center', maxWidth: cardW }}>
              Or screenshot the card to post it anywhere.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function CardStat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 22, color: CARD.ink }}>{value}</Text>
      <Text style={{ fontSize: 11, fontFamily: fonts.body, color: CARD.muted, marginTop: 3 }}>{label}</Text>
    </View>
  )
}
