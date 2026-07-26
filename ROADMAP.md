# Roadmap

Path from the current state (a working offline-first MVP running in Expo Go against
a live Supabase project) to a production v1.0 on the App Store and Google Play.

Ordered by priority. Rough estimate to v1.0: **~4–8 focused weeks**, most of it in
builds/store submission, auth completeness, testing, and polish — not core
architecture.

## ✅ Done

- Supabase backend: schema, migrations, seed, RLS on every table, stats/streak
  RPCs, function hardening
- Typed data-access layer + offline-first SQLite mirror + sync engine (push/pull,
  last-write-wins, tombstone deletes) with 15 runtime tests
- Sync resilience: per-table isolation, per-op timeout, error surfacing
- Expo app: Today / Calendar / Stats / Profile, habit + reminder CRUD, local
  notifications, light/dark theming, email/password auth
- Deployed to a live Supabase project and verified end-to-end on the simulator

---

## Phase 1 — Ship blockers (can't launch without these)

**Builds & distribution**
- [x] **EAS Build config** — `eas.json` (dev/preview/production profiles), Node 20
      pinned for builds, `.nvmrc`, npm build/submit scripts (see [`MOBILE.md`](MOBILE.md))
- [x] Real bundle identifiers (`com.av1yan.habittracker`)
- [x] Config plugins: decided — `expo-sqlite`/`expo-font` intentionally omitted
      (work via autolinking / runtime loading; not needed for our usage)
- [ ] Run `eas login && eas init && eas build` to produce iOS + Android binaries
- [x] App icon + splash assets (on-brand checkmark placeholder via
      `scripts/generate-icons.mjs`) — replace with real artwork before submitting
- [ ] Apple Developer ($99/yr) + Google Play ($25) accounts; store listings & assets
- [ ] Submit for review (TestFlight / internal testing first)

**Auth completeness**
- [x] Password reset flow (forgot-password + reset-password screens + recovery
      deep-link handler). **Config:** add the app's redirect URL to Supabase Auth →
      URL Configuration; test the email→link→app flow on a real device.
- [x] Account deletion (`delete_account()` RPC — cascades all user data; verified;
      wired to Profile → "Delete account")
- [ ] **Sign in with Apple** — *not required* while email/password is the only
      login. Needs `expo-apple-authentication` + a dev/prod build (not Expo Go),
      an Apple Developer account, and the Supabase Apple provider configured.
- [ ] Verify email confirmation is enabled (Supabase default: on)
- [ ] Enable leaked-password protection (Supabase Auth → Passwords — dashboard toggle)

**Legal & infra**
- [ ] Privacy policy + terms of service (required by both stores)
- [ ] GDPR/CCPA data export + delete endpoints
- [ ] Move Supabase off free tier (backups, no auto-pause, SLA)

---

## Phase 2 — Should-fix before real users

**Testing & CI**
- [x] Tests for the DAL (mock Supabase client) and local repos (real node:sqlite) —
      ~29 new tests, 44 total via `npm test`
- [x] CI pipeline — GitHub Actions runs backend + app typecheck and all tests on push/PR
- [x] E2E smoke flows (Maestro, `.maestro/`) — sign-in, navigation, create-habit,
      theme. Run against a dev/preview build (see `.maestro/README.md`).
- [ ] Execute the E2E flows against a build + wire into CI (needs Java/Maestro + a build)

**Observability**
- [x] Crash/error reporting (Sentry via `lib/monitoring.ts` — inert without a DSN,
      loaded lazily so Expo Go still works) + a root error boundary; sync errors
      report through it too
- [ ] Wire Sentry for production builds: set `EXPO_PUBLIC_SENTRY_DSN`, add the
      `@sentry/react-native/expo` config plugin (on Node 20) for source-map upload
- [ ] Basic product analytics
- [ ] Server logging/alerting

**Sync hardening**
- [ ] Retry with backoff on failed cycles
- [ ] Keyset `(updated_at, id)` cursor (fixes the same-timestamp page-boundary gap)
- [ ] Tombstone purge cron (delete old soft-deleted rows)
- [ ] Sync status + conflict surfacing in the UI

---

## Phase 3 — Product polish

- [x] Loading / empty / error states across screens (reusable `components/ScreenState.tsx`,
      `loading` flag threaded through `useLocalData`; on Today/Stats/Calendar/habit/Reminders)
- [ ] Onboarding flow
- [ ] Accessibility: screen readers, dynamic type, contrast
- [ ] Localization / i18n
- [ ] Reminders robustness: reschedule on device reboot, timezone edge cases
- [ ] Restore the full 3-step create-habit wizard (currently condensed to one form)
- [ ] Wire achievements into the UI

---

## Phase 4 — Growth & nice-to-have

- [ ] Home-screen widgets (iOS WidgetKit / Android)
- [ ] Remote push notifications (APNs/FCM) if needed beyond local
- [ ] True week-based streaks for count/interval habits (currently daily-approximated)
- [ ] Optimize `longest_streak` (day-by-day walk → gaps-and-islands query) for large histories
- [ ] Monetization (subscriptions via RevenueCat) if that's the model
- [ ] Social / accountability features (friends, shared habits)

---

_See [`BACKEND_SCHEMA.md`](BACKEND_SCHEMA.md), [`MOBILE.md`](MOBILE.md), and
[`src/sync/README.md`](src/sync/README.md) for design details and documented
trade-offs._
