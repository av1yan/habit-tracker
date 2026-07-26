// App-wide provider that owns the offline stack (SQLite mirror + sync engine)
// and the auth session. Screens read `local` and call the offline repos; they
// re-run when `version` bumps (after a mutation or a background sync).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AppState as RNAppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { createExpoAdapter } from '@backend/local'
import type { LocalDB } from '@backend/local'
import { bootstrapOffline, onSignIn, onSignOut, type OfflineStack } from '@backend/offline'
import { rescheduleOnForeground, rescheduleReminders } from './notifications'
import { backfillAchievements } from './achievements'
import { captureError } from './monitoring'

interface AppState {
  ready: boolean
  session: Session | null
  local: LocalDB | null
  version: number
  refresh: () => void
  signOut: () => Promise<void>
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [local, setLocal] = useState<LocalDB | null>(null)
  const [version, setVersion] = useState(0)

  const stackRef = useRef<OfflineStack | null>(null)
  const onlineRef = useRef(true)
  const lastUser = useRef<string | null | undefined>(undefined)

  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const router = useRouter()

  useEffect(() => {
    let authSub: { unsubscribe: () => void } | undefined
    let netSub: (() => void) | undefined

    const handleSession = async (s: Session | null, stack: OfflineStack) => {
      const uid = s?.user?.id ?? null
      setSession(s)
      if (uid === lastUser.current) return
      lastUser.current = uid
      if (uid) {
        await onSignIn(stack.local, stack.engine, uid)
        // Reschedule local notifications from the freshly-synced reminders.
        rescheduleReminders(stack.local).catch(() => {})
        // Record already-earned milestones silently, so only milestones crossed
        // from here on trigger a celebration toast.
        backfillAchievements(stack.local).catch(() => {})
      } else {
        await onSignOut(stack.local, stack.engine)
      }
      setVersion((v) => v + 1)
    }

    ;(async () => {
      const adapter = await createExpoAdapter('habit-tracker.db')
      const stack = await bootstrapOffline(supabase, adapter, {
        isOnline: () => onlineRef.current,
        onSync: (report) => {
          const pushed = Object.entries(report.pushed).filter(([, n]) => n > 0)
          if (pushed.length) console.log('[sync] pushed', Object.fromEntries(pushed))
          setVersion((v) => v + 1)
        },
        onError: (err, ctx) => {
          const msg = err instanceof Error ? err.message : String(err)
          console.warn('[sync] error', ctx, msg)
          captureError(err, { source: 'sync', ...ctx })
        },
      })
      stackRef.current = stack
      setLocal(stack.local)

      netSub = NetInfo.addEventListener((s) => {
        onlineRef.current = s.isConnected === true
      })

      const { data } = await supabase.auth.getSession()
      await handleSession(data.session, stack)
      authSub = supabase.auth.onAuthStateChange((_e, s) => {
        void handleSession(s, stack)
      }).data.subscription

      setReady(true)
    })()

    return () => {
      authSub?.unsubscribe()
      netSub?.()
      stackRef.current?.engine.stop()
    }
  }, [])

  // Handle incoming deep links — specifically the password-recovery link, which
  // carries a session (PKCE code or token fragment). Establish it, then route to
  // the reset-password screen.
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return
      try {
        if (url.includes('code=')) {
          await supabase.auth.exchangeCodeForSession(url)
        } else if (url.includes('access_token=')) {
          const frag = url.split('#')[1] ?? url.split('?')[1] ?? ''
          const params = new URLSearchParams(frag)
          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token')
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token })
          }
        }
        if (url.includes('reset-password') || url.includes('type=recovery')) {
          router.replace('/reset-password')
        }
      } catch {
        /* malformed / expired link — ignore */
      }
    }
    Linking.getInitialURL().then(handleUrl)
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url))
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the app returns to the foreground, reschedule reminders if the
  // timezone or day changed while it was away — covers travel across timezones,
  // DST shifts, and a reboot the user opened the app after.
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (state) => {
      const l = stackRef.current?.local
      if (state === 'active' && l && lastUser.current) {
        rescheduleOnForeground(l).catch(() => {})
      }
    })
    return () => sub.remove()
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AppContext.Provider value={{ ready, session, local, version, refresh, signOut }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within <AppProvider>')
  return ctx
}
