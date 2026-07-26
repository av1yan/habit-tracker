# E2E smoke tests (Maestro)

End-to-end UI smoke tests using [Maestro](https://maestro.mobile.dev). They cover
the critical happy paths: sign-in, tab navigation, creating a habit, and switching
theme.

| Flow | Covers |
|---|---|
| `01-sign-in.yaml` | Launch → sign in with the demo account → land on Today |
| `02-navigation.yaml` | Navigate Today / Calendar / Stats / Profile |
| `03-create-habit.yaml` | Create a habit and see it on Today |
| `04-theme.yaml` | Switch appearance to Dark |

## Prerequisites

- **Maestro CLI** (needs a Java 8+ runtime):
  ```bash
  curl -Ls "https://get.maestro.mobile.dev" | bash
  ```
- **A build of the app** — the flows target `appId: com.av1yan.habittracker`, so they
  run against a real build, not Expo Go:
  ```bash
  npx expo run:ios          # local dev build on a booted simulator
  # or a cloud build: eas build --profile preview
  ```
- **Backend + seed applied** so the demo account exists (`supabase/seed.sql`).

## Run

```bash
maestro test .maestro                 # all flows
maestro test .maestro/01-sign-in.yaml # a single flow
```

Credentials default to the seed demo account (`demo@habittracker.app` /
`password123`, from `config.yaml`). Override with:

```bash
maestro test -e EMAIL=you@example.com -e PASSWORD=secret .maestro
```

## Notes

- **Not yet executed / not in CI.** These flows are written against the app's
  current copy but haven't been run here (no Java/Maestro and no build in this
  environment). Expect to tweak a selector or timeout on the first real run.
- **Running against Expo Go** (quick local check without a build): set
  `appId: host.exp.Exponent`, start Metro (`npx expo start`), and add
  `- openLink: exp://127.0.0.1:8081` right after `launchApp` so Expo Go loads the
  app. `clearState` behaves differently in Expo Go, so the fresh-sign-in flow is
  best run against a real build.
- **CI:** running these on GitHub Actions needs a macOS runner + a built app +
  Maestro Cloud or a booted simulator — a heavier follow-up than the unit-test CI.
