// Milestone / achievement catalog, derived from live stats.
//
// The `achievements` table mirrors these so an earned milestone can be
// celebrated once and stamped with a date — but the UI derives its display
// straight from stats, so it's always correct even before any row is written.
// (`longest_streak` and total completions only ever grow, so an earned
// milestone never un-earns.)

import { stats as statsRepo, achievements as achievementsRepo, type LocalDB } from '@backend/local'

export interface AchievementMetrics {
  /** Best streak ever reached across all habits. */
  bestStreak: number
  /** Total completed check-ins across all habits. */
  totalDone: number
  /** Number of active habits. */
  habitCount: number
}

export interface AchievementView {
  kind: string
  icon: string
  title: string
  /** What it takes, e.g. "7-day streak". */
  goal: string
  earned: boolean
  /** 0..1 progress toward the goal. */
  progress: number
  /** "Achieved ✓" when earned, otherwise "4 days to go". */
  detail: string
}

interface Def {
  kind: string
  icon: string
  title: string
  goal: string
  threshold: number
  metric: (m: AchievementMetrics) => number
  unit: 'day' | 'completion'
}

const DEFS: Def[] = [
  { kind: 'streak_7', icon: '⭐', title: 'Week Warrior', goal: '7-day streak', threshold: 7, metric: (m) => m.bestStreak, unit: 'day' },
  { kind: 'streak_30', icon: '🏆', title: 'Monthly Master', goal: '30-day streak', threshold: 30, metric: (m) => m.bestStreak, unit: 'day' },
  { kind: 'streak_100', icon: '💎', title: 'Century Club', goal: '100-day streak', threshold: 100, metric: (m) => m.bestStreak, unit: 'day' },
  { kind: 'total_1', icon: '🌱', title: 'First Step', goal: 'First completion', threshold: 1, metric: (m) => m.totalDone, unit: 'completion' },
  { kind: 'total_50', icon: '🔥', title: 'On Fire', goal: '50 completions', threshold: 50, metric: (m) => m.totalDone, unit: 'completion' },
  { kind: 'total_250', icon: '🚀', title: 'Unstoppable', goal: '250 completions', threshold: 250, metric: (m) => m.totalDone, unit: 'completion' },
]

export function deriveAchievements(m: AchievementMetrics): AchievementView[] {
  return DEFS.map((d) => {
    const val = d.metric(m)
    const earned = val >= d.threshold
    const remaining = Math.max(0, d.threshold - val)
    const progress = d.threshold === 0 ? 1 : Math.min(1, val / d.threshold)
    const noun = remaining === 1 ? d.unit : `${d.unit}s`
    return {
      kind: d.kind,
      icon: d.icon,
      title: d.title,
      goal: d.goal,
      earned,
      progress,
      detail: earned ? 'Achieved ✓' : `${remaining} ${noun} to go`,
    }
  })
}

export function earnedCount(views: AchievementView[]): number {
  return views.filter((v) => v.earned).length
}

// -- Persistence orchestration ----------------------------------------------
//
// The display above is derived purely from stats and is always correct. These
// helpers additionally *record* earned milestones (in the synced `achievements`
// table) so each one can be celebrated exactly once, the first time it's
// crossed.

export async function metricsFromLocal(local: LocalDB): Promise<AchievementMetrics> {
  const perHabit = await statsRepo.getAllStats(local)
  return {
    bestStreak: perHabit.reduce((m, s) => Math.max(m, s.longest_streak), 0),
    totalDone: perHabit.reduce((m, s) => m + s.total_completions, 0),
    habitCount: perHabit.length,
  }
}

/**
 * Record every currently-earned milestone without returning anything to
 * celebrate. Run once on sign-in so a user's existing progress is captured
 * silently — only milestones crossed *afterwards* trigger a toast.
 */
export async function backfillAchievements(local: LocalDB): Promise<void> {
  const views = deriveAchievements(await metricsFromLocal(local))
  for (const v of views) {
    if (v.earned) await achievementsRepo.award(local, v.kind)
  }
}

/**
 * Award any newly-earned milestones and return them, so the caller can
 * celebrate. Call after an action that can advance progress (completing a
 * habit). Idempotent: a milestone already recorded is never returned again.
 */
export async function checkForNewAchievements(local: LocalDB): Promise<AchievementView[]> {
  const views = deriveAchievements(await metricsFromLocal(local))
  const already = await achievementsRepo.earnedKinds(local)
  const newly = views.filter((v) => v.earned && !already.has(v.kind))
  for (const v of newly) await achievementsRepo.award(local, v.kind)
  return newly
}
