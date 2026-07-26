import type { ConfigContext, ExpoConfig } from 'expo/config'

// Layers optional, build-time-only config onto app.json. Kept out of app.json
// itself so the Expo Go dev workflow (which has no Sentry env) is never touched.
export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins: NonNullable<ExpoConfig['plugins']> = [...(config.plugins ?? [])]

  // Sentry source-map upload for release builds. Enabled only when the org +
  // project are supplied via env, so local/dev/Expo Go builds skip it entirely.
  // The upload itself also needs SENTRY_AUTH_TOKEN (an EAS secret) at build time.
  const org = process.env.SENTRY_ORG
  const project = process.env.SENTRY_PROJECT
  if (org && project) {
    plugins.push([
      '@sentry/react-native/expo',
      { organization: org, project, url: process.env.SENTRY_URL ?? 'https://sentry.io/' },
    ])
  }

  return { ...config, plugins } as ExpoConfig
}
