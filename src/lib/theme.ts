/** Black + canary — modern operator, not cream editorial. */
export const colors = {
  ink: '#0A0A0A',
  inkMuted: '#3D3D3A',
  inkFaint: '#8B8B86',
  paper: '#FAFAF8',
  paperDeep: '#EDEDE9',
  panel: '#FFFFFF',
  line: 'rgba(10, 10, 10, 0.1)',
  accent: '#FFE500',
  accentSoft: '#FFF8CC',
  accentDeep: '#0A0A0A',
  night: '#0A0A0A',
  nightFog: 'rgba(10, 10, 10, 0.55)',
  warn: '#B45309',
  danger: '#C81E1E',
  onAccent: '#0A0A0A',
  onNight: '#FAFAF8',
};

export const fonts = {
  display: 'Syne_800ExtraBold',
  displaySemi: 'Syne_700Bold',
  body: 'SpaceGrotesk_400Regular',
  bodyMedium: 'SpaceGrotesk_500Medium',
  bodySemi: 'SpaceGrotesk_600SemiBold',
  bodyBold: 'SpaceGrotesk_700Bold',
};

export const space = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 36,
  xxl: 48,
};

/** Sharper controls — modern, not soft consumer. */
export const radii = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
};

export const type = {
  hero: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
  },
  title: {
    fontFamily: fonts.displaySemi,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.6,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyStrong: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
};
