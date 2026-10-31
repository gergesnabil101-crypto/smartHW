import { StyleSheet } from 'react-native';

/** App-wide design tokens — Arabic-first, RTL, light theme. */
export const colors = {
  primary: '#4f46e5',
  primaryDark: '#4338ca',
  primarySoft: '#eef2ff',
  accent: '#0d9488',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  success: '#16a34a',
  successSoft: '#f0fdf4',
  bg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
} as const;

export const spacing = (n: number) => n * 4;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const typography = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'right', writingDirection: 'rtl' },
  h2: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'right', writingDirection: 'rtl' },
  h3: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'right', writingDirection: 'rtl' },
  body: { fontSize: 15, color: colors.text, textAlign: 'right', writingDirection: 'rtl' },
  bodySecondary: { fontSize: 14, color: colors.textSecondary, textAlign: 'right', writingDirection: 'rtl' },
  caption: { fontSize: 12, color: colors.textMuted, textAlign: 'right', writingDirection: 'rtl' },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, textAlign: 'right', writingDirection: 'rtl' },
});

export const shadows = {
  card: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
} as const;
