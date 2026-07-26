// Palette + type lifted from the dc.html prototype.

// Font families (loaded in app/_layout.tsx via @expo-google-fonts).
// Caprasimo is the serif display face; Figtree is the sans body face. Because
// each Figtree weight is a distinct font file, use the specific family for a
// weight rather than fontWeight (which is ignored once fontFamily is set).
export const fonts = {
  display: 'Caprasimo_400Regular',
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  extrabold: 'Figtree_800ExtraBold',
}

// Colors are tuned to meet WCAG AA (see scripts/contrast-audit.mjs):
// - `accent` doubles as text/icon color, so it's dark enough to read on the
//   light surfaces yet light enough to pop on dark ones.
// - `btn` is the primary-button background: white label text needs a darker
//   orange than accent-as-text can be, so CTAs use this instead of `accent`.
const light = {
  bg: '#f5ead8',
  card: '#ebddc5',
  surface: '#ffffff',
  ink: '#201e1d',
  sub: '#6d6455', // AA on bg/surface (was #82796a, large-only)
  muted: '#766c5a', // 3:1+ everywhere, AA on surface (was #a09786, failing)
  accent: '#a85e2c', // AA as text on surface; white label AA on this bg
  accentDark: '#8f4f25',
  btn: '#a85e2c', // white text 4.9:1
  green: '#6b784f', // AA as "Achieved" text on white (was #7a8a5e)
  danger: '#c0504a',
  track: '#dcd3c4',
  line: '#ebddc5',
}

const dark: typeof light = {
  bg: '#1b1916',
  card: '#2b2620',
  surface: '#241f19',
  ink: '#f5ead8',
  sub: '#b3a793',
  muted: '#a1988a', // AA on card/surface (was #8a8073)
  accent: '#d98a52', // stays light — reads well as text on the dark surfaces
  accentDark: '#c67139',
  btn: '#a85e2c', // white label 4.9:1 (accent itself is too light for white text)
  green: '#9aa877',
  danger: '#dc8079',
  track: '#3a352d',
  line: '#332e27',
}

export type Palette = typeof light
export type Scheme = 'light' | 'dark'
export const palettes: Record<Scheme, Palette> = { light, dark }

// Live palette. Screens read from this import and re-render when the
// ThemeProvider swaps its contents (via applyScheme) on a theme change.
export const colors: Palette = { ...light }

export function applyScheme(scheme: Scheme): void {
  Object.assign(colors, palettes[scheme])
}

/** GitHub-style heatmap ramp (empty → full). */
export const heat = ['#ebddc5', '#ffc6a5', '#f6a06b', '#d67f48', '#b2622d']

/** hex + alpha → rgba() string. */
export function rgba(hex: string, a: number): string {
  const h = hex.length === 7 ? hex : '#c67139'
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

/** Milestone badge for a streak length. */
export function streakBadge(streak: number): string {
  return streak >= 100 ? '💎' : streak >= 30 ? '🏆' : streak >= 7 ? '⭐' : ''
}
