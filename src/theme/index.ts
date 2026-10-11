// Mash visual language. Warm, grown-up, no neon. Built for people who are done with the apps.
// Colours are tokens; components read from here and never hard-code hex.

export const palette = {
  plum900: '#1F1430',
  plum700: '#3A2650',
  plum500: '#5B3F7A',
  plum300: '#A58CC1',
  plum100: '#EFE8F6',
  cream: '#FBF7F1',
  cream200: '#F2EBE0',
  sand: '#E6DCCB',
  ink: '#1C1A1F',
  ink700: '#4A454F',
  ink500: '#7A7482',
  ink300: '#B8B2BF',
  terracotta: '#D9704F',
  terracottaDeep: '#B9573A',
  olive: '#6F8F5E',
  oliveSoft: '#E4EBDD',
  rose: '#E9C9C0',
  gold: '#D8A85B',
  white: '#FFFFFF',
  danger: '#B3261E',
} as const;

export const colors = {
  background: palette.cream,
  surface: palette.white,
  surfaceAlt: palette.cream200,
  surfaceInverse: palette.plum900,
  border: palette.sand,
  text: palette.ink,
  textSecondary: palette.ink700,
  textMuted: palette.ink500,
  textInverse: palette.cream,
  primary: palette.plum700,
  primaryPressed: palette.plum900,
  accent: palette.terracotta,
  accentPressed: palette.terracottaDeep,
  success: palette.olive,
  successSoft: palette.oliveSoft,
  warm: palette.rose,
  highlight: palette.plum100,
  gold: palette.gold,
  danger: palette.danger,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

// System fonts on purpose: one less thing to load, and SF reads as native to the audience.
export const type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' as const },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' as const },
  bodyStrong: { fontSize: 17, lineHeight: 24, fontWeight: '600' as const },
  quote: { fontSize: 19, lineHeight: 27, fontWeight: '400' as const, fontStyle: 'italic' as const },
  caption: { fontSize: 14, lineHeight: 19, fontWeight: '400' as const },
  label: { fontSize: 13, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.4 },
} as const;

export const shadow = {
  card: {
    shadowColor: palette.plum900,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;

export const theme = { colors, spacing, radius, type, shadow, palette };
export type Theme = typeof theme;
