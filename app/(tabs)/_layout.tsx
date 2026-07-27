import { Redirect, Tabs } from 'expo-router'
import { type ColorValue, Text } from 'react-native'
import { useApp } from '@/lib/app-context'
import { useTheme } from '@/lib/theme-context'
import { colors, fonts } from '@/lib/theme'

function Icon({ emoji, color }: { emoji: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{emoji}</Text>
}

export default function TabsLayout() {
  useTheme()
  const { ready, session } = useApp()
  if (ready && !session) return <Redirect href="/sign-in" />

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarIcon: ({ color }) => <Icon emoji="◧" color={color} /> }}
      />
      <Tabs.Screen
        name="garden"
        options={{ title: 'Garden', tabBarIcon: ({ color }) => <Icon emoji="❀" color={color} /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendar', tabBarIcon: ({ color }) => <Icon emoji="▦" color={color} /> }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarIcon: ({ color }) => <Icon emoji="▍" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <Icon emoji="☺" color={color} /> }}
      />
    </Tabs>
  )
}
