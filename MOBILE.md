# Habit Tracker — Expo app

An Expo Router (React Native) client for iOS + Android, wired to the offline-first
backend in `src/`. The UI follows the `Habit Tracker MVP Design` prototype.

## Prerequisites

1. A Supabase project with the migrations applied (`supabase db push`) — see
   `supabase/migrations/`.
2. Node 18+ and the Expo tooling (installed via `npm install` below).

## Setup

```bash
cp .env.example .env          # then fill in your Supabase URL + anon key
npm install                   # installs Expo, React Native, and app deps
npx expo start                # press i (iOS sim) / a (Android) / scan for device
```

> First launch signs you in (email/password). The app does an initial sync to
> populate the local SQLite mirror, then works offline; changes sync in the
> background and on reconnect.

## Structure

```
app/                         Expo Router routes
  _layout.tsx                AppProvider + root Stack
  index.tsx                  splash → redirect (auth gate)
  sign-in.tsx                email/password auth
  (tabs)/
    _layout.tsx              Today / Calendar / Stats / Profile
    index.tsx                Today  — ring, list, tap-to-toggle
    calendar.tsx             heatmap (last 15 weeks)
    stats.tsx                overall %, per-habit bars, totals
    profile.tsx              account, freezes, sign out
  habit/[id].tsx             detail — streak, week strip, note, freeze
  new-habit.tsx              create form (modal)
lib/
  supabase.ts                RN Supabase client (AsyncStorage + URL polyfill)
  app-context.tsx            owns the offline stack + auth session
  useLocalData.ts            focus/version-aware loader hook
  theme.ts                   palette from the prototype
components/Ring.tsx          SVG progress ring
src/                         shared backend (data / local / sync) — imported as @backend/*
```

## How it's wired

- `lib/app-context.tsx` boots the offline stack once (`bootstrapOffline`), tracks
  connectivity via NetInfo, and calls `onSignIn` / `onSignOut` as auth changes.
- Screens **read from the local SQLite mirror** through the offline repos
  (`import { logs, stats } from '@backend/local'`) — never directly from the
  network — and re-run on focus or when a mutation/sync bumps `version`.
- Writes (`toggleHabit`, `createHabit`, `setNote`, `useStreakFreeze`) go to
  SQLite instantly and are pushed by the sync engine.

The `@backend/*` alias maps to `src/*` (see `tsconfig.json` paths); Metro bundles
those files directly.

## Scripts

| Command | What |
|---|---|
| `npm start` / `npm run ios` / `npm run android` | run the app |
| `npm run typecheck` | typecheck the **backend** (`tsconfig.backend.json`) |
| `npm run typecheck:app` | typecheck the **app** (needs deps installed) |
| `npm test` | backend sync-engine tests |

## Status / caveats

- **Installed and compiles.** `npm install` succeeds and `npx expo start`
  serves a Metro dev server that bundles the full app for iOS (HTTP 200, ~8.4 MB
  dev bundle) with no resolution/syntax errors — including the shared `@backend/*`
  code. It has **not** yet been booted in a simulator/on device (that needs Expo
  Go + a real `.env`), so runtime behavior is unverified end-to-end.
- **Node 26 note:** this machine runs Node 26; Expo SDK 51 targets Node 18/20.
  The only fallout was that the `expo-sqlite` **config-plugin** entry crashed
  Expo's Node-side config loader, so it was removed from `app.json` `plugins`.
  expo-sqlite is autolinked and works without that entry — the plugin is only for
  build-time options we don't use. If you switch to Node 20, it can be restored.
- `npm run typecheck:app` only works after `npm install` (its tsconfig extends
  `expo/tsconfig.base`).
- **Fonts**: uses system fonts. The prototype's Caprasimo/Figtree can be added
  with `expo-font` + `@expo-google-fonts/*` if you want an exact match.
- **Create flow** is condensed from the prototype's 3-step wizard into one
  scrollable form with the same fields.
- **Reminders UI** — a management screen (Profile → Reminders) with create/edit
  and per-reminder toggles, driving on-device local notifications.

## Building for the stores (EAS)

Build config lives in [`eas.json`](eas.json). Build servers are pinned to Node 20
(`node` field per profile) to avoid the Node-26 config-load issue seen in dev.

**Prerequisites**
- An [Expo account](https://expo.dev) (free) and `eas-cli`: `npm install -g eas-cli`
- Run on **Node 20** locally (`.nvmrc` pins it; `nvm use`)
- Apple Developer + Google Play accounts for store submission

**First-time setup**
```bash
eas login
eas init          # links the project and writes extra.eas.projectId into app.json
```

**Build profiles** (`eas.json`)
- `development` — dev client, iOS simulator build for local testing
- `preview` — internal-distribution release build (TestFlight / ad-hoc)
- `production` — store build (auto-increments build number)

### Development build (simulator — no Apple account needed)

A dev build compiles the native modules that Expo Go doesn't bundle
(`react-native-view-shot` for the shareable-card image export, etc.). The
`development` profile builds for the **iOS simulator** (`ios.simulator: true`),
so it needs only a free Expo account — no Apple Developer membership.

```bash
eas login                                              # your Expo account
eas init                                               # once, links the project
eas build --profile development --platform ios         # cloud build (~10–20 min)
eas build:run -p ios                                   # install the .app to a booted simulator
npx expo start --dev-client                            # then open the dev-client app
```

`expo-dev-client` is already a dependency. The dev-client app replaces Expo Go —
open it (not Expo Go) and it connects to the Metro server from
`expo start --dev-client`. To build locally instead of on EAS (needs Xcode +
CocoaPods), `npx expo run:ios` does a prebuild + local compile.

**Commands** (also wired as npm scripts)
```bash
npm run build:preview            # internal test build (iOS + Android)
npm run build:ios                # production iOS build
npm run build:android            # production Android build
npm run submit:ios               # upload to App Store Connect
npm run submit:android           # upload to Google Play
```

**Still needed before submitting** (see [`ROADMAP.md`](ROADMAP.md) Phase 1)
- App icon + splash assets (currently Expo defaults)
- Password reset, Sign in with Apple, account deletion
- Privacy policy + terms; a paid Supabase plan

> Note: `expo-sqlite` / `expo-font` config plugins are intentionally omitted from
> `app.json` — both modules work via autolinking / runtime loading for our usage,
> so builds don't need them. Re-add them only if you adopt a build-time feature
> they gate (do it on Node 20).

## Crash reporting (Sentry)

Wired in [`lib/monitoring.ts`](lib/monitoring.ts) + a root error boundary in
`app/_layout.tsx`. It's **inert unless `EXPO_PUBLIC_SENTRY_DSN` is set**, and the
SDK is imported lazily — so Expo Go and local dev are unaffected.

**Source-map upload** is wired via [`app.config.ts`](app.config.ts), which adds the
`@sentry/react-native/expo` config plugin **only when `SENTRY_ORG` + `SENTRY_PROJECT`
are set** — so local/Expo Go builds skip it and stay untouched. Symbolicated stack
traces in production just need the env below.

To turn Sentry on for release builds (build on Node 20):
1. Create a Sentry project and grab the DSN + org/project slugs.
2. Set the runtime DSN and the build-time upload vars as EAS values:
   ```bash
   # runtime (baked into the JS bundle — EXPO_PUBLIC_ is not secret)
   eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value "https://…@…ingest.sentry.io/…"
   eas env:create --name SENTRY_ORG     --value "your-org"
   eas env:create --name SENTRY_PROJECT --value "your-project"
   # secret — used only to upload source maps at build time
   eas secret:create --name SENTRY_AUTH_TOKEN --value "sntrys_…"
   ```
3. Build as usual (`npm run build:ios` / `build:android`). Without these vars the
   plugin is skipped and builds still succeed (just no symbolication).

Report errors from anywhere with `captureError(err, context?)`.
