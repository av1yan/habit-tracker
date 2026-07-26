import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useApp } from '@/lib/app-context'
import { hasSeenOnboarding } from '@/lib/onboarding'
import { colors } from '@/lib/theme'

export default function Index() {
  const { ready, session } = useApp()
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null)

  useEffect(() => {
    hasSeenOnboarding().then(setSeenOnboarding)
  }, [])

  if (!ready || seenOnboarding === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }
  if (session) return <Redirect href="/(tabs)" />
  return <Redirect href={seenOnboarding ? '/sign-in' : '/onboarding'} />
}
