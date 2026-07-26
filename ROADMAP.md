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
- [ ] Configure **EAS Build**; produce iOS + Android release binaries
- [ ] Restore `expo-sqlite` / `expo-font` config plugins in `app.json` (removed as a
      Node 26 dev workaround) and build on Node 20
- [ ] Real bundle identifiers (replace `com.example.habittracker`), app icon, splash
- [ ] Apple Developer ($99/yr) + Google Play ($25) accounts; store listings & assets
- [ ] Submit for review (TestFlight / internal testing first)

**Auth completeness**
- [ ] Password reset flow
- [ ] Enforce email verification on signup
- [ ] **Sign in with Apple** (required by App Store if any social login is offered)
- [ ] Account deletion (App Store + GDPR requirement)
- [ ] Enable leaked-password protection (Supabase Auth setting)

**Legal & infra**
- [ ] Privacy policy + terms of service (required by both stores)
- [ ] GDPR/CCPA data export + delete endpoints
- [ ] Move Supabase off free tier (backups, no auto-pause, SLA)

---

## Phase 2 — Should-fix before real users

**Testing & CI**
- [ ] Tests for the DAL and local repos
- [ ] E2E smoke tests (Maestro or Detox) for core flows
- [ ] CI pipeline (typecheck + test on PR)

**Observability**
- [ ] Crash/error reporting (Sentry) + app error boundaries
- [ ] Basic product analytics
- [ ] Server logging/alerting

**Sync hardening**
- [ ] Retry with backoff on failed cycles
- [ ] Keyset `(updated_at, id)` cursor (fixes the same-timestamp page-boundary gap)
- [ ] Tombstone purge cron (delete old soft-deleted rows)
- [ ] Sync status + conflict surfacing in the UI

---

## Phase 3 — Product polish

- [ ] Loading / empty / error states across screens
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
