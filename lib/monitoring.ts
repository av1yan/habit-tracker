// Crash/error reporting via Sentry.
//
// Inert unless EXPO_PUBLIC_SENTRY_DSN is set — so it stays completely off in
// Expo Go and local dev (no DSN), and turns on automatically in dev/production
// builds that provide one. The SDK is imported lazily, so when disabled it's
// never loaded and never touches the native module (which isn't in Expo Go).

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN

let sentry: typeof import('@sentry/react-native') | null = null

/** Initialize Sentry once, if configured. Safe to call when disabled (no-op). */
export async function initMonitoring(): Promise<void> {
  if (!DSN || sentry) return
  try {
    const S = await import('@sentry/react-native')
    S.init({
      dsn: DSN,
      // Keep the performance sample rate low to control quota; tune per traffic.
      tracesSampleRate: 0.2,
    })
    sentry = S
  } catch (e) {
    console.warn('[monitoring] Sentry init failed', e)
  }
}

/** Report an error. Goes to Sentry when enabled, otherwise the dev console. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (sentry) {
    sentry.captureException(error, context ? { extra: context } : undefined)
  } else if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.error('[error]', error, context ?? '')
  }
}
