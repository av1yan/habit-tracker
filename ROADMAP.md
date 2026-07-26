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
- Calendar: Month-grid and Heatmap views (toggle); tap any day for a detail panel
  (per-habit completion status + a done/total summary for that date); tap a habit
  there to open its detail. Month grid has prev/next navigation (chevrons or
  horizontal swipe) with per-month data. Heatmap has month/weekday labels and a
  window summary (active days · check-ins).
- Streak Freeze management screen (Profile → Streak Freeze): balance, explainer,
  and per-habit "Freeze today" actions.
- Garden tab: each habit is a plant that grows through stages with its streak
  (seed → seedling → sprout → thriving → flowering → blooming → mighty tree),
  with progress toward the next stage. The flagship engagement/retention hook.

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
- [x] **Sign in with Apple** — wired on the sign-in screen (`expo-apple-authentication`
      → `supabase.auth.signInWithIdToken`), iOS-only, shown when available. Entitlement
      enabled in `app.json` (`ios.usesAppleSignIn` + plugin). **Remaining to go live:**
      run it on a dev/prod build (not Expo Go) and enable the Supabase Apple provider
      (Dashboard → Authentication → Providers → Apple) with bundle id
      `com.av1yan.habittracker` in the authorized client IDs.
- [ ] Verify email confirmation is enabled (Supabase default: on)
- [ ] Enable leaked-password protection (Supabase Auth → Passwords — dashboard toggle)

**Legal & infra**
- [x] Privacy policy + terms of service drafted ([`legal/`](legal/)) — tailored to
      the app as built. **Remaining:** legal review, fill the `[BRACKET]`
      placeholders, and host at public URLs linked from the store listing + app.
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
- [x] Wire Sentry for production builds — source-map upload plugin is added
      conditionally via `app.config.ts` (only when `SENTRY_ORG`/`SENTRY_PROJECT`
      are set, so Expo Go is untouched). **Remaining:** set `EXPO_PUBLIC_SENTRY_DSN`,
      `SENTRY_ORG`, `SENTRY_PROJECT`, and the `SENTRY_AUTH_TOKEN` secret in EAS
      (see [`MOBILE.md`](MOBILE.md)).
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
- [x] Onboarding flow — one-time 3-slide welcome carousel (`app/onboarding.tsx`)
      shown on first launch before sign-in, gated by an AsyncStorage flag
      (`lib/onboarding.ts`); paged swipe + dots, Skip, and Next/Get started
- Accessibility:
  - [x] Screen readers — roles, labels, and states on all interactive controls;
        decorative grids collapsed to summarized elements
  - [x] Dynamic type — text honors the OS font-size setting; a global
        `maxFontSizeMultiplier` cap (1.6) keeps large sizes from breaking
        fixed-height UI (tab bar, badges)
  - [x] Contrast audit against WCAG AA — palette retuned so all text/background
        pairs pass (see `scripts/contrast-audit.mjs`); primary buttons use a
        dedicated `btn` color for AA-compliant white labels in both themes
- [ ] Localization / i18n
- [x] Reminders robustness: reschedule on foreground when the timezone or day
      changes (covers travel across timezones, DST, and reboots the user opens
      the app after); cold launches already reschedule via the sign-in path
- [x] Restore the full 3-step create-habit wizard — step 1 name/icon/color,
      step 2 frequency/type/category, step 3 live-preview + build/quit, with a
      progress bar, step counter, and forward/back nav (matches the design prototype)
- [x] Wire achievements into the UI — Achievements section on Stats (6 milestones:
      streak ⭐/🏆/💎 + completion-count tiers, earned/locked with progress bars)
      and per-habit ⭐ streak badges on Today. Derived live from stats via
      `lib/achievements.ts`. Earned milestones are also persisted (synced
      `achievements` table) and celebrated once with an animated toast
      (`lib/achievement-toast.tsx`) — existing progress is backfilled silently
      on sign-in, so only milestones crossed afterwards pop a toast.

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
