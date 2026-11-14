import { StyleSheet } from 'react-native';

/** App-wide design tokens — Arabic-first, RTL, light theme. */
export const colors = {
  primary: '#4f46e5',
  primaryDark: '#3730a3',
  primarySoft: '#eef2ff',
  accent: '#0d9488',
  accentSoft: '#f0fdfa',
  danger: '#dc2626',
  dangerDark: '#b91c1c',
  dangerSoft: '#fef2f2',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  success: '#16a34a',
  successDark: '#15803d',
  successSoft: '#f0fdf4',
  bg: '#f1f5f9',
  surface: '#ffffff',
  surfaceTint: '#f8fafc',
  border: '#e2e8f0',
  borderSoft: '#eef2f7',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
} as const;

export const spacing = (n: number) => n * 4;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const typography = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'right', writingDirection: 'rtl', letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'right', writingDirection: 'rtl', letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'right', writingDirection: 'rtl' },
  body: { fontSize: 15, color: colors.text, textAlign: 'right', writingDirection: 'rtl' },
  bodySecondary: { fontSize: 14, color: colors.textSecondary, textAlign: 'right', writingDirection: 'rtl' },
  caption: { fontSize: 12, color: colors.textMuted, textAlign: 'right', writingDirection: 'rtl' },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textAlign: 'right', writingDirection: 'rtl' },
});

export const shadows = {
  card: {
    shadowColor: '#334155',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  elev: {
    shadowColor: '#334155',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 4,
  },
  elevDanger: {
    shadowColor: '#334155',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 4,
  },
} as const;
