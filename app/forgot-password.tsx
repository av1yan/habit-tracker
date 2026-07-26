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
import * as Linking from 'expo-linking'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme-context'
import { colors, fonts } from '@/lib/theme'

export default function ForgotPassword() {
  useTheme()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL('/reset-password'),
      })
      if (error) setError(error.message)
      else setSent(true)
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
        <Text style={{ fontSize: 30, fontFamily: fonts.display, color: colors.ink }}>Reset password</Text>

        {sent ? (
          <>
            <Text style={{ fontSize: 15, fontFamily: fonts.body, color: colors.sub, lineHeight: 22 }}>
              If an account exists for {email.trim()}, we've sent a reset link. Open it on this device
              to choose a new password.
            </Text>
            <Pressable
              onPress={() => router.back()}
              style={{ backgroundColor: colors.accent, borderRadius: 999, padding: 16, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 15 }}>Back to sign in</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 15, fontFamily: fonts.body, color: colors.sub, marginBottom: 4 }}>
              Enter your email and we'll send a reset link.
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
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
              disabled={busy || !email.trim()}
              style={{
                backgroundColor: colors.accent,
                borderRadius: 999,
                padding: 16,
                alignItems: 'center',
                opacity: busy || !email.trim() ? 0.6 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 15 }}>Send reset link</Text>
              )}
            </Pressable>
            <Pressable onPress={() => router.back()} style={{ alignItems: 'center', paddingTop: 6 }}>
              <Text style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: 13 }}>Back to sign in</Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}
