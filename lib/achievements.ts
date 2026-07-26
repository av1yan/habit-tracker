// Milestone / achievement catalog, derived from live stats.
//
// The `achievements` table mirrors these so an earned milestone can be
// celebrated once and stamped with a date — but the UI derives its display
// straight from stats, so it's always correct even before any row is written.
// (`longest_streak` and total completions only ever grow, so an earned
// milestone never un-earns.)

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
