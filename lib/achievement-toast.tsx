// A celebratory toast shown when a milestone is earned for the first time.
// Mounted once at the app root; screens fire it via `useAchievementToast()`.
// Toasts queue and show one at a time, auto-dismissing after a few seconds.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Animated, Easing, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AchievementView } from './achievements'
import { colors, fonts, rgba } from './theme'

interface ToastCtx {
  celebrate: (a: AchievementView | AchievementView[]) => void
}

const AchievementToastContext = createContext<ToastCtx>({ celebrate: () => {} })

export function useAchievementToast(): ToastCtx {
  return useContext(AchievementToastContext)
}

const VISIBLE_MS = 3600

export function AchievementToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  const [queue, setQueue] = useState<AchievementView[]>([])
  const [current, setCurrent] = useState<AchievementView | null>(null)
  const anim = useRef(new Animated.Value(0)).current

  const celebrate = useCallback((a: AchievementView | AchievementView[]) => {
    const list = Array.isArray(a) ? a : [a]
    if (list.length) setQueue((q) => q.concat(list))
  }, [])

  // Pull the next toast off the queue when idle.
  useEffect(() => {
    if (current || queue.length === 0) return
    setCurrent(queue[0])
    setQueue((q) => q.slice(1))
  }, [queue, current])

  const dismiss = useCallback(() => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setCurrent(null))
  }, [anim])

  // Animate the current toast in, then auto-dismiss.
  useEffect(() => {
    if (!current) return
    anim.setValue(0)
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 55 }).start()
    const t = setTimeout(dismiss, VISIBLE_MS)
    return () => clearTimeout(t)
  }, [current, anim, dismiss])

  return (
    <AchievementToastContext.Provider value={{ celebrate }}>
      {children}
      {current && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 0,
            right: 0,
            alignItems: 'center',
            opacity: anim,
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] }) },
            ],
          }}
        >
          <Pressable
            onPress={dismiss}
            accessibilityRole="alert"
            accessibilityLabel={`Achievement unlocked: ${current.title}, ${current.goal}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              maxWidth: 360,
              marginHorizontal: 16,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 18,
              backgroundColor: colors.ink,
              shadowColor: '#000',
              shadowOpacity: 0.22,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: rgba(colors.accent, 0.9),
              }}
            >
              <Text style={{ fontSize: 24 }}>{current.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontFamily: fonts.semibold, letterSpacing: 1, color: rgba(colors.bg, 0.7) }}>
                ACHIEVEMENT UNLOCKED 🎉
              </Text>
              <Text style={{ fontSize: 16, fontFamily: fonts.display, color: colors.bg, marginTop: 2 }}>
                {current.title}
              </Text>
              <Text style={{ fontSize: 12, fontFamily: fonts.body, color: rgba(colors.bg, 0.7), marginTop: 1 }}>
                {current.goal}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      )}
    </AchievementToastContext.Provider>
  )
}
