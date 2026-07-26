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

const light = {
  bg: '#f5ead8',
  card: '#ebddc5',
  surface: '#ffffff',
  ink: '#201e1d',
  sub: '#82796a',
  muted: '#a09786',
  accent: '#c67139',
  accentDark: '#b2622d',
  green: '#7a8a5e',
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
  muted: '#8a8073',
  accent: '#d98a52',
  accentDark: '#c67139',
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
