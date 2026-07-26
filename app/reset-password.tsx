import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme-context'
import { colors, fonts } from '@/lib/theme'

// Reached via the password-recovery deep link — by this point the deep-link
// handler in app-context has established a temporary recovery session, so
// updateUser can set the new password.
export default function ResetPassword() {
  useTheme()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) setError(error.message)
      else router.replace('/(tabs)')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={{ flex: 1, justifyContent: 'center', padding: 28, gap: 16 }}>
        <Text style={{ fontSize: 30, fontFamily: fonts.display, color: colors.ink }}>New password</Text>
        <Text style={{ fontSize: 15, fontFamily: fonts.body, color: colors.sub, marginBottom: 4 }}>
          Choose a new password for your account.
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="New password"
          secureTextEntry
          placeholderTextColor={colors.muted}
          style={{
            backgroundColor: colors.card,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            fontFamily: fonts.body,
            color: colors.ink,
          }}
        />
        {error && <Text style={{ color: colors.danger, fontFamily: fonts.body, fontSize: 13 }}>{error}</Text>}
        <Pressable
          onPress={submit}
          disabled={busy || !password}
          style={{
            backgroundColor: colors.btn,
            borderRadius: 999,
            padding: 16,
            alignItems: 'center',
            opacity: busy || !password ? 0.6 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 15 }}>Save password</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}
