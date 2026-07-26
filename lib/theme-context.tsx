// Theme controller. Resolves the active color scheme from the user's setting
// (system/light/dark) + the device scheme, swaps the live palette, and persists
// the choice to the profile. Screens call useTheme() to subscribe so they
// re-render (and read the freshly-swapped `colors`) on any change.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useColorScheme } from 'react-native'
import { profile as profileRepo } from '@backend/local'
import { applyScheme, type Scheme } from './theme'
import { useApp } from './app-context'

export type ThemePref = 'system' | 'light' | 'dark'

interface ThemeState {
  scheme: Scheme
  pref: ThemePref
  setPref: (pref: ThemePref) => Promise<void>
}

const ThemeContext = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { local, version } = useApp()
  const device = useColorScheme()
  const [pref, setPrefState] = useState<ThemePref>('system')

  // Load the persisted preference from the profile once it's synced.
  useEffect(() => {
    if (!local) return
    profileRepo
      .getProfile(local)
      .then((p) => {
        if (p?.theme === 'system' || p?.theme === 'light' || p?.theme === 'dark') {
          setPrefState(p.theme)
        }
      })
      .catch(() => {})
  }, [local, version])

  const scheme: Scheme = pref === 'system' ? (device === 'dark' ? 'dark' : 'light') : pref

  // Swap the live palette before children render.
  useMemo(() => applyScheme(scheme), [scheme])

  const setPref = useCallback(
    async (next: ThemePref) => {
      setPrefState(next)
      if (local) {
        try {
          await profileRepo.updateProfile(local, { theme: next })
        } catch {
          /* offline write still succeeds locally; ignore */
        }
      }
    },
    [local],
  )

  const value = useMemo(() => ({ scheme, pref, setPref }), [scheme, pref, setPref])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>')
  return ctx
}
