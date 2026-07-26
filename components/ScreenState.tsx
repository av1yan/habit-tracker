// Reusable loading / empty / error states for data-driven screens.

import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { colors, fonts } from '@/lib/theme'

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  )
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: string
  title: string
  subtitle?: string
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 6 }}>
      <Text style={{ fontSize: 44, marginBottom: 4 }}>{icon}</Text>
      <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.ink, textAlign: 'center' }}>{title}</Text>
      {subtitle ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 8 }}>
      <Text style={{ fontSize: 40 }}>⚠️</Text>
      <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.ink }}>Couldn't load</Text>
      {message ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, textAlign: 'center' }}>{message}</Text>
      ) : null}
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={{ marginTop: 8, backgroundColor: colors.btn, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 }}
        >
          <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 14 }}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
