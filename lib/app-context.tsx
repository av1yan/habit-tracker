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
import NetInfo from '@react-native-community/netinfo'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { createExpoAdapter } from '@backend/local'
import type { LocalDB } from '@backend/local'
import { bootstrapOffline, onSignIn, onSignOut, type OfflineStack } from '@backend/offline'
import { rescheduleReminders } from './notifications'

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
