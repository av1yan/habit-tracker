// Load data from the local SQLite mirror. Re-runs on screen focus and whenever
// the app `version` bumps (mutation or background sync), so screens stay fresh.

import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import type { LocalDB } from '@backend/local'
import { useApp } from './app-context'

export function useLocalData<T>(
  loader: (local: LocalDB) => Promise<T>,
): { data: T | null; error: Error | null; reload: () => void } {
  const { local, version } = useApp()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const reload = useCallback(() => {
    if (!local) return
    loader(local)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e) => setError(e as Error))
    // loader is defined inline by callers; local/version are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, version])

  useFocusEffect(reload)

  return { data, error, reload }
}
