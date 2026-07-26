import { useRef, useState } from 'react'
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTheme } from '@/lib/theme-context'
import { setOnboardingSeen } from '@/lib/onboarding'
import { colors, fonts, rgba } from '@/lib/theme'

interface Slide {
  icon: string
  tint: string
  title: string
  body: string
}

const SLIDES: Slide[] = [
  {
    icon: '🌱',
    tint: '#7a8a5e',
    title: 'Build habits\nthat stick',
    body: 'Add the habits you want to grow and check them off each day. Small steps, real momentum.',
  },
  {
    icon: '🔥',
    tint: '#c67139',
    title: 'Keep the\nstreak alive',
    body: 'Watch your streaks climb as you stay consistent — and freeze one to protect a streak when life gets in the way.',
  },
  {
    icon: '🏆',
    tint: '#4a90d9',
    title: 'Celebrate\nyour progress',
    body: 'Heatmaps, stats, and milestone achievements show how far you’ve come and keep you going.',
  },
]

export default function Onboarding() {
  useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const scrollRef = useRef<ScrollView>(null)
  const [index, setIndex] = useState(0)

  const last = index === SLIDES.length - 1

  const finish = async () => {
    await setOnboardingSeen()
    router.replace('/sign-in')
  }

  const next = () => {
    if (last) {
      void finish()
    } else {
      scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true })
    }
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width)
    if (i !== index) setIndex(i)
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Skip */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, alignItems: 'flex-end' }}>
        <Pressable onPress={finish} hitSlop={8} accessibilityRole="button" accessibilityLabel="Skip onboarding">
          <Text style={{ color: colors.muted, fontFamily: fonts.semibold, fontSize: 14 }}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s) => (
          <View key={s.icon} style={{ width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 22 }}>
            <View
              style={{
                width: 156,
                height: 156,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: rgba(s.tint, 0.15),
              }}
            >
              <Text style={{ fontSize: 76 }}>{s.icon}</Text>
            </View>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 30, lineHeight: 36, fontFamily: fonts.display, color: colors.ink, textAlign: 'center' }}
            >
              {s.title}
            </Text>
            <Text style={{ fontSize: 15, lineHeight: 23, fontFamily: fonts.body, color: colors.sub, textAlign: 'center' }}>
              {s.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
        {SLIDES.map((s, i) => (
          <View
            key={s.icon}
            style={{
              width: i === index ? 22 : 8,
              height: 8,
              borderRadius: 999,
              backgroundColor: i === index ? colors.accent : rgba(colors.ink, 0.15),
            }}
          />
        ))}
      </View>

      {/* Next / Get started */}
      <View style={{ paddingHorizontal: 28, paddingBottom: insets.bottom + 16 }}>
        <Pressable
          onPress={next}
          accessibilityRole="button"
          accessibilityLabel={last ? 'Get started' : 'Next'}
          style={{ backgroundColor: colors.btn, borderRadius: 999, padding: 17, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 16 }}>
            {last ? 'Get started' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
