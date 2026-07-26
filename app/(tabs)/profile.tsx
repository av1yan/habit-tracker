import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import { profile as profileRepo } from '@backend/local'
import { deleteAccount } from '@backend/data'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/lib/app-context'
import { useLocalData } from '@/lib/useLocalData'
import { useTheme, type ThemePref } from '@/lib/theme-context'
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
        <Row emoji="🧊" title="Streak Freeze" sub={`${data?.streak_freeze_balance ?? 0} freezes available`} />
        <Divider />
        <Link href="/reminders" asChild>
          <Pressable>
            <Row emoji="🔔" title="Reminders" sub="Per-habit, custom times" />
          </Pressable>
        </Link>
        <Divider />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Text style={{ fontSize: 20, width: 28 }}>🌙</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: fonts.semibold, color: colors.ink }}>Appearance</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              {(['system', 'light', 'dark'] as ThemePref[]).map((opt) => {
                const active = pref === opt
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setPref(opt)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      alignItems: 'center',
                      backgroundColor: active ? colors.accent : colors.card,
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

      <Pressable onPress={confirmDeleteAccount} style={{ alignItems: 'center', paddingVertical: 14 }}>
        <Text style={{ color: colors.muted, fontFamily: fonts.semibold, fontSize: 13 }}>
          Delete account
        </Text>
      </Pressable>
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
