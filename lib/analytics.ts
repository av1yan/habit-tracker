// First-party product analytics — privacy-first and inert by default.
//
// Off unless EXPO_PUBLIC_POSTHOG_KEY is set (so Expo Go and local dev never send
// anything). Events are sent to PostHog's capture endpoint over plain fetch — no
// SDK, no native module, no advertising identifiers, no cross-app tracking. We
// send a pseudonymous id (the auth user id once signed in, otherwise a random
// per-device id) and coarse, non-PII properties only — never habit names, notes,
// or emails.

import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY
const HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com').replace(/\/+$/, '')
const ANON_KEY = 'analytics_anon_id'

let userId: string | null = null
let anonId: string | null = null

async function distinctId(): Promise<string> {
  if (userId) return userId
  if (!anonId) {
    anonId = await AsyncStorage.getItem(ANON_KEY).catch(() => null)
    if (!anonId) {
      anonId = `anon_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
      AsyncStorage.setItem(ANON_KEY, anonId).catch(() => {})
    }
  }
  return anonId
}

/** Tie subsequent events to the signed-in user (pseudonymous — the auth id). */
export function identifyUser(id: string): void {
  userId = id
}

/** Drop the user association on sign-out. */
export function resetAnalytics(): void {
  userId = null
}

/**
 * Record a product event. No-op (dev console only) unless analytics is
 * configured. Fire-and-forget: never throws, never blocks the caller.
 */
export async function track(event: string, properties?: Record<string, unknown>): Promise<void> {
  if (!KEY) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[analytics]', event, properties ?? '')
    return
  }
  try {
    await fetch(`${HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: KEY,
        event,
        distinct_id: await distinctId(),
        properties: { ...properties, $lib: 'habit-tracker' },
        timestamp: new Date().toISOString(),
      }),
    })
  } catch {
    /* fire-and-forget */
  }
}
