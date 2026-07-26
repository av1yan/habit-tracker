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
import { Link, Redirect } from 'expo-router'
import { isConfigured, supabase } from '@/lib/supabase'
import { useApp } from '@/lib/app-context'
import { useTheme } from '@/lib/theme-context'
import { colors, fonts } from '@/lib/theme'

const inputStyle = () =>
  ({
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.ink,
  }) as const

export default function SignIn() {
  useTheme()
  const { session } = useApp()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session) return <Redirect href="/(tabs)" />

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const fn =
        mode === 'signin'
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({ email, password })
      const { error } = await fn
      if (error) setError(error.message)
      // On success, AppProvider's auth listener flips `session` and we redirect.
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
        <Text style={{ fontSize: 40, fontFamily: fonts.display, color: colors.ink }}>Habits</Text>
        <Text style={{ fontSize: 15, fontFamily: fonts.body, color: colors.sub, marginBottom: 8 }}>
          {mode === 'signin' ? 'Welcome back.' : 'Create your account.'}
        </Text>

        {!isConfigured && (
          <View style={{ backgroundColor: '#c0504a18', borderRadius: 12, padding: 12 }}>
            <Text style={{ color: colors.danger, fontSize: 12, lineHeight: 17 }}>
              Backend not configured — copy .env.example to .env and add your Supabase URL + anon
              key. Auth won't work until then.
            </Text>
          </View>
        )}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor={colors.muted}
          style={inputStyle()}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          placeholderTextColor={colors.muted}
          style={inputStyle()}
        />

        {error && <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={busy}
          style={{
            backgroundColor: colors.accent,
            borderRadius: 999,
            padding: 16,
            alignItems: 'center',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 15 }}>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          style={{ alignItems: 'center', paddingTop: 6 }}
        >
          <Text style={{ color: colors.accent, fontSize: 13 }}>
            {mode === 'signin' ? 'No account? Sign up' : 'Have an account? Sign in'}
          </Text>
        </Pressable>

        {mode === 'signin' && (
          <Link href="/forgot-password" asChild>
            <Pressable style={{ alignItems: 'center' }}>
              <Text style={{ color: colors.muted, fontFamily: fonts.semibold, fontSize: 13 }}>
                Forgot password?
              </Text>
            </Pressable>
          </Link>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

