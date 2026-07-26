// Plant growth stages, shared by the Garden tab and the shareable card.
// A plant grows the longer a habit's streak stays alive.

export interface Stage {
  min: number
  emoji: string
  label: string
}

export const STAGES: Stage[] = [
  { min: 100, emoji: '🌳', label: 'Mighty' },
  { min: 30, emoji: '🌻', label: 'Blooming' },
  { min: 14, emoji: '🌷', label: 'Flowering' },
  { min: 7, emoji: '🪴', label: 'Thriving' },
  { min: 3, emoji: '🌿', label: 'Sprouting' },
  { min: 1, emoji: '🌱', label: 'Seedling' },
  { min: 0, emoji: '🌰', label: 'Dormant' },
]

export const stageIndex = (streak: number) => STAGES.findIndex((s) => streak >= s.min)
export const stageFor = (streak: number): Stage => STAGES[stageIndex(streak)]

/** Streak at which a plant counts as thriving. */
export const THRIVING = 7
