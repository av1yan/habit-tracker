// Supabase client configured for React Native: AsyncStorage-backed sessions and
// the URL polyfill supabase-js needs on RN. Uses the typed factory from the
// shared backend so every call is checked against the schema.

import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createDbClient } from '@backend/data'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anonKey)

if (!isConfigured) {
  // Fall back to a syntactically-valid placeholder so createClient doesn't throw
  // (which would white-screen the whole app). Auth calls will fail until a real
  // .env is provided — see the banner on the sign-in screen.
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy .env.example to .env.',
  )
}

export const supabase = createDbClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
