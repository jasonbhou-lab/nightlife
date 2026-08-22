/**
 * Design system.
 *
 * Visual direction is taken from "Blue and White Modern Mobile Prototype":
 * a deep-blue gradient ground, white rounded cards floating on it with soft
 * shadows, circular blue icon badges, and dark-navy inset pills for the
 * numbers that matter. Section headers sit directly on the blue ground in
 * bold white with a small white pill button pushed to the right edge.
 *
 * Dark mode is a first-class theme rather than an inversion (PRD U-06): the
 * ground drops to near-black navy and the white cards become deep navy, but
 * the accent, spacing, and shadow language are unchanged.
 */

export const palette = {
  blue900: '#0B1F52',
  blue800: '#12307F',
  blue700: '#1739A8',
  blue600: '#1B3FBF',
  blue500: '#2E63F5',
  blue400: '#5C8BFA',
  blue300: '#93B4F9',
  blue200: '#C3D5FD',
  blue100: '#E8F0FF',
  blue050: '#F4F8FF',

  navy: '#0A1A3F',
  navyDeep: '#08142F',
  navyInk: '#04070F',

  ink: '#0B1220',
  ink70: '#334155',
  ink50: '#64748B',
  ink30: '#94A3B8',
  ink15: '#CBD5E1',
  ink08: '#E2E8F0',

  white: '#FFFFFF',
  amber: '#F59E0B',
  amberSoft: '#FEF3C7',
  green: '#16A34A',
  greenSoft: '#DCFCE7',
  red: '#DC2626',
  redSoft: '#FEE2E2',
  violet: '#7C3AED',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

/** Minimum touch target, PRD U-08. */
export const HIT = 44;

export const font = {
  /** Display / screen title, sits on the blue ground. */
  display: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  section: { fontSize: 19, fontWeight: '800' as const, letterSpacing: -0.2 },
  cardTitle: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  meta: { fontSize: 13, fontWeight: '500' as const },
  small: { fontSize: 12, fontWeight: '600' as const },
  micro: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.3 },
} as const;

export type ThemeMode = 'light' | 'dark';

export type Theme = {
  mode: ThemeMode;
  /** Screen ground: deep blue at the top fading lighter toward the bottom. */
  ground: readonly [string, string, string];
  /** Hero / feature card gradient (the "Your Wallet" card in the prototype). */
  hero: readonly [string, string];
  /** Text sitting directly on the ground. */
  onGround: string;
  onGroundDim: string;
  onGroundFaint: string;
  /** Cards. */
  card: string;
  cardMuted: string;
  cardBorder: string;
  /** Text inside cards. */
  text: string;
  textDim: string;
  textFaint: string;
  /** Accent (circular icon badges, primary buttons). */
  accent: string;
  accentText: string;
  accentSoft: string;
  accentSoftText: string;
  /** Dark inset pill inside a white card. */
  inset: string;
  insetText: string;
  insetDim: string;
  /** Semantics. */
  star: string;
  open: string;
  openSoft: string;
  closed: string;
  closedSoft: string;
  warn: string;
  warnSoft: string;
  shadow: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
};

const sharedShadow = (color: string, opacity: number, elevation: number) => ({
  shadowColor: color,
  shadowOpacity: opacity,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation,
});

export const lightTheme: Theme = {
  mode: 'light',
  ground: [palette.blue600, palette.blue500, palette.blue300],
  hero: [palette.blue500, palette.blue700],
  onGround: palette.white,
  onGroundDim: 'rgba(255,255,255,0.82)',
  onGroundFaint: 'rgba(255,255,255,0.62)',
  card: palette.white,
  cardMuted: palette.blue050,
  cardBorder: 'rgba(11,31,82,0.08)',
  text: palette.ink,
  textDim: palette.ink50,
  textFaint: palette.ink30,
  accent: palette.blue500,
  accentText: palette.white,
  accentSoft: palette.blue100,
  accentSoftText: palette.blue700,
  inset: palette.navy,
  insetText: palette.white,
  insetDim: 'rgba(255,255,255,0.66)',
  star: palette.amber,
  open: palette.green,
  openSoft: palette.greenSoft,
  closed: palette.red,
  closedSoft: palette.redSoft,
  warn: '#B45309',
  warnSoft: palette.amberSoft,
  shadow: sharedShadow(palette.blue900, 0.18, 6),
};

export const darkTheme: Theme = {
  mode: 'dark',
  ground: [palette.navyInk, '#081334', '#0E2050'],
  hero: [palette.blue600, '#122A6E'],
  onGround: palette.white,
  onGroundDim: 'rgba(255,255,255,0.74)',
  onGroundFaint: 'rgba(255,255,255,0.52)',
  card: '#101A33',
  cardMuted: '#16223F',
  cardBorder: 'rgba(147,180,249,0.16)',
  text: '#F1F5F9',
  textDim: '#9CB0D0',
  textFaint: '#6E82A3',
  accent: palette.blue500,
  accentText: palette.white,
  accentSoft: 'rgba(46,99,245,0.20)',
  accentSoftText: palette.blue300,
  inset: '#060E24',
  insetText: palette.white,
  insetDim: 'rgba(255,255,255,0.60)',
  star: palette.amber,
  open: '#34D399',
  openSoft: 'rgba(52,211,153,0.16)',
  closed: '#F87171',
  closedSoft: 'rgba(248,113,113,0.16)',
  warn: '#FBBF24',
  warnSoft: 'rgba(251,191,36,0.16)',
  shadow: sharedShadow('#000000', 0.5, 6),
};

export const themes: Record<ThemeMode, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};
