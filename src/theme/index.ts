// Mash visual language, matched to the pitch deck: black, white, one red. Bricolage Grotesque,
// heavy and tight for headings. Pill buttons with a black outline. Grey cards. Red for the vouch.
// Colours are tokens; components read from here and never hard-code hex.
//
// `palette` keeps its historical key names so every screen still compiles; the values are the
// deck's. Prefer `colors` in new code.

export const palette = {
  plum900: '#000000',
  plum700: '#000000',
  plum500: '#333333',
  plum300: '#8A8A8A',
  plum100: '#F2F2F2',
  cream: '#FFFFFF',
  cream200: '#F4F4F4',
  sand: '#D9D9D9',
  ink: '#000000',
  ink700: '#444444',
  ink500: '#8A8A8A',
  ink300: '#BDBDBD',
  terracotta: '#E8322D',
  terracottaDeep: '#C4271F',
  olive: '#000000',
  oliveSoft: '#F2F2F2',
  rose: '#F4F4F4',
  gold: '#E8322D',
  white: '#FFFFFF',
  danger: '#E8322D',
} as const;

export const colors = {
  background: palette.white,
  surface: palette.cream200,
  surfaceAlt: palette.plum100,
  surfaceInverse: palette.ink,
  border: palette.sand,
  text: palette.ink,
  textSecondary: palette.ink700,
  textMuted: palette.ink500,
  textInverse: palette.white,
  primary: palette.ink,
  primaryPressed: palette.plum500,
  accent: palette.terracotta,
  accentPressed: palette.terracottaDeep,
  success: palette.terracotta,
  successSoft: palette.plum100,
  warm: palette.cream200,
  highlight: palette.plum100,
  gold: palette.terracotta,
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
  sm: 10,
  md: 16,
  lg: 20,
  pill: 999,
} as const;

// Loaded in the root layout from @expo-google-fonts/bricolage-grotesque.
export const fonts = {
  regular: 'BricolageGrotesque_400Regular',
  medium: 'BricolageGrotesque_500Medium',
  semibold: 'BricolageGrotesque_600SemiBold',
  bold: 'BricolageGrotesque_700Bold',
  extrabold: 'BricolageGrotesque_800ExtraBold',
} as const;

export const type = {
  display: { fontFamily: fonts.extrabold, fontSize: 56, lineHeight: 54, letterSpacing: -2 },
  title: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 34, letterSpacing: -1 },
  heading: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 24 },
  quote: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
  caption: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19 },
  label: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
} as const;

// The deck has no shadows. Kept as a no-op so callers still compile.
export const shadow = {
  card: {},
} as const;

export const theme = { colors, spacing, radius, type, shadow, palette, fonts };
export type Theme = typeof theme;
