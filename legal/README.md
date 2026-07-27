# Legal documents

Draft [Privacy Policy](privacy-policy.md) and [Terms of Service](terms-of-service.md)
for the Habit Tracker app.

> ⚠️ **These are templates, not legal advice.** Have them reviewed by a qualified
> attorney before publishing. They reflect the app as built (offline-first habit
> tracker, Supabase backend, Sign in with Apple, optional Sentry crash reporting,
> on-device reminders, no ads/analytics/data-selling) — re-check them whenever that
> changes (e.g. when analytics is added).

## Before publishing

1. Replace every `[BRACKET]` placeholder:
   - `[LEGAL NAME / DEVELOPER NAME]`, `[CONTACT EMAIL]`, `[MAILING ADDRESS]`
   - `[DATE]` (effective / last-updated date)
   - `[JURISDICTION / STATE / COUNTRY]` and `[VENUE]` (governing law)
   - liability figures in Terms §10
2. Remove the `<!-- TEMPLATE … -->` comment at the top of each file.
3. Confirm the sub-processor list still matches what you actually use.
4. Regenerate the hosted HTML: `npm run build:legal` (writes `docs/privacy.html`
   and `docs/terms.html` from these markdown files).

## Hosting (GitHub Pages)

The markdown here is the source of truth; `npm run build:legal` renders it to
styled HTML in `docs/`, which the app already links to (see `lib/legal.ts`):

- https://av1yan.github.io/habit-tracker/privacy.html
- https://av1yan.github.io/habit-tracker/terms.html

**One-time toggle to make those URLs live:** GitHub → repo **Settings → Pages →
Build and deployment → Source: Deploy from a branch → Branch: `main` / `/docs`**,
then Save. In-app links are already wired on the Profile screen.
