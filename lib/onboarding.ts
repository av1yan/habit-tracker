// Tracks whether the one-time welcome carousel has been shown. Stored locally
// (per-device) in AsyncStorage — it's a UI preference, not user data, so it
// doesn't need to sync.

import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'onboarding_seen_v1'

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1'
  } catch {
    // If storage is unavailable, don't trap the user on onboarding forever.
    return true
  }
}

export async function setOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1')
  } catch {
    /* best-effort */
  }
}
