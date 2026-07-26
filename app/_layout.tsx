import { useEffect } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { Stack, type ErrorBoundaryProps } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo'
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree'
import { AppProvider } from '@/lib/app-context'
import { AchievementToastProvider } from '@/lib/achievement-toast'
import { ThemeProvider, useTheme } from '@/lib/theme-context'
import { colors } from '@/lib/theme'
import { captureError, initMonitoring } from '@/lib/monitoring'

// Start crash reporting as early as possible (no-op without a DSN).
void initMonitoring()

// Dynamic Type: text honors the OS font-size setting by default. Cap the
// multiplier app-wide so very large accessibility sizes scale text up without
// shattering fixed-height UI (tab bar, streak badges, the toggle check).
const MAX_FONT_SCALE = 1.6
type Scalable = { defaultProps?: { maxFontSizeMultiplier?: number } }
;(Text as unknown as Scalable).defaultProps = {
  ...(Text as unknown as Scalable).defaultProps,
  maxFontSizeMultiplier: MAX_FONT_SCALE,
}
;(TextInput as unknown as Scalable).defaultProps = {
  ...(TextInput as unknown as Scalable).defaultProps,
  maxFontSizeMultiplier: MAX_FONT_SCALE,
}

// Root error boundary — catches render errors anywhere in the app, reports them,
// and offers a retry. Styling is self-contained (no theme/safe-area hooks) since
// it may render when the providers themselves have failed.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    captureError(error)
  }, [error])
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#f5ead8',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 40 }}>🙈</Text>
      <Text style={{ fontSize: 24, fontWeight: '800', color: '#201e1d', textAlign: 'center' }}>
        Something went wrong
      </Text>
      <Text style={{ fontSize: 14, color: '#82796a', textAlign: 'center' }}>
        The app hit an unexpected error. You can try again.
      </Text>
      {typeof __DEV__ !== 'undefined' && __DEV__ && (
        <Text style={{ fontSize: 12, color: '#a09786', textAlign: 'center' }}>{error.message}</Text>
      )}
      <Pressable
        onPress={retry}
        style={{
          marginTop: 8,
          backgroundColor: '#c67139',
          borderRadius: 999,
          paddingHorizontal: 24,
          paddingVertical: 14,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Try again</Text>
      </Pressable>
    </View>
  )
}

function Navigator() {
  const { scheme } = useTheme() // subscribe so nav chrome follows the theme
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="new-habit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="habit/[id]" />
        <Stack.Screen name="reminders" />
        <Stack.Screen name="reminder-edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="streak-freeze" />
        <Stack.Screen name="share-card" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Caprasimo_400Regular,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  })

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <ThemeProvider>
          <AchievementToastProvider>
            <Navigator />
          </AchievementToastProvider>
        </ThemeProvider>
      </AppProvider>
    </SafeAreaProvider>
  )
}
