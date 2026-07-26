import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useApp } from '@/lib/app-context'
import { colors } from '@/lib/theme'

export default function Index() {
  const { ready, session } = useApp()

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }
  return <Redirect href={session ? '/(tabs)' : '/sign-in'} />
}
