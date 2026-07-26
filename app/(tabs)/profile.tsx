import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import { profile as profileRepo } from '@backend/local'
import { deleteAccount } from '@backend/data'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/app-context'
import { useLocalData } from '@/lib/useLocalData'
import { useTheme, type ThemePref } from '@/lib/theme-context'
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal'
import { colors, fonts } from '@/lib/theme'

export default function Profile() {
  const insets = useSafeAreaInsets()
  const { session, signOut } = useApp()
  const { pref, setPref } = useTheme()
  const { data } = useLocalData((l) => profileRepo.getProfile(l))

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount(supabase)
            } catch (e) {
              Alert.alert('Could not delete account', (e as Error).message)
              return
            }
            await signOut()
          },
        },
      ],
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24, gap: 12 }}
    >
      <Text style={{ fontSize: 26, fontFamily: fonts.display, color: colors.ink, marginHorizontal: 20 }}>
        Profile
      </Text>

      <View
        style={{
          marginHorizontal: 16,
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 24,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 999,
            backgroundColor: colors.track,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 28 }}>{data?.avatar_emoji ?? '🙂'}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 20, fontFamily: fonts.display, color: colors.ink }}>
            {data?.display_name || 'Your Habits'}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.sub, marginTop: 3 }}>{session?.user?.email}</Text>
        </View>
      </View>

      <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 14 }}>
        <Link href="/streak-freeze" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Streak Freeze">
            <Row emoji="🧊" title="Streak Freeze" sub={`${data?.streak_freeze_balance ?? 0} freezes available`} />
          </Pressable>
        </Link>
        <Divider />
        <Link href="/reminders" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Reminders, per-habit custom times">
            <Row emoji="🔔" title="Reminders" sub="Per-habit, custom times" />
          </Pressable>
        </Link>
        <Divider />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Text style={{ fontSize: 20, width: 28 }}>🌙</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: fonts.semibold, color: colors.ink }}>Appearance</Text>
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              {(['system', 'light', 'dark'] as ThemePref[]).map((opt) => {
                const active = pref === opt
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setPref(opt)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${opt[0].toUpperCase() + opt.slice(1)} appearance`}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      alignItems: 'center',
                      backgroundColor: active ? colors.btn : colors.card,
                    }}
                  >
                    <Text
                      style={{ fontFamily: fonts.semibold, fontSize: 13, color: active ? '#fff' : colors.sub }}
                    >
                      {opt[0].toUpperCase() + opt.slice(1)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        </View>
      </View>

      <Pressable
        onPress={signOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={{
          marginHorizontal: 16,
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.danger, fontFamily: fonts.bold, fontSize: 15 }}>Sign out</Text>
      </Pressable>

      <Pressable onPress={confirmDeleteAccount} accessibilityRole="button" accessibilityLabel="Delete account" style={{ alignItems: 'center', paddingVertical: 14 }}>
        <Text style={{ color: colors.muted, fontFamily: fonts.semibold, fontSize: 13 }}>
          Delete account
        </Text>
      </Pressable>

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingTop: 4 }}>
        <Pressable
          onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
          hitSlop={6}
          accessibilityRole="link"
          accessibilityLabel="Privacy Policy"
        >
          <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12 }}>Privacy Policy</Text>
        </Pressable>
        <Text style={{ color: colors.muted, fontSize: 12 }}>·</Text>
        <Pressable
          onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
          hitSlop={6}
          accessibilityRole="link"
          accessibilityLabel="Terms of Service"
        >
          <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12 }}>Terms of Service</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

function Row({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Text style={{ fontSize: 20, width: 28 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontFamily: fonts.semibold, color: colors.ink }}>{title}</Text>
        <Text style={{ fontSize: 12, fontFamily: fonts.body, color: colors.sub }}>{sub}</Text>
      </View>
      <Text style={{ color: colors.track, fontSize: 20 }}>›</Text>
    </View>
  )
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.bg }} />
}
