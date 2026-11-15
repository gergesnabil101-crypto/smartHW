import { StyleSheet } from 'react-native';

/** App-wide design tokens — Arabic-first, RTL, light theme.
 *  Identity: a teacher's desk — warm paper background, deep ink-navy chrome,
 *  and the red correction pen reserved for scores, marks and grading. */
export const colors = {
  primary: '#16405b',        // deep ink navy — headers, primary actions
  primaryDark: '#0f2f45',
  primarySoft: '#e8f0f4',
  accent: '#0d9488',
  accentSoft: '#f0fdfa',
  pen: '#b91c1c',            // correction-pen red — scores & grading marks
  danger: '#dc2626',
  dangerDark: '#b91c1c',
  dangerSoft: '#fef2f2',
  warning: '#b45309',
  warningSoft: '#fef6e7',
  success: '#15803d',
  successDark: '#166534',
  successSoft: '#f0fdf4',
  bg: '#f5f2ea',             // warm paper
  surface: '#ffffff',
  surfaceTint: '#faf8f3',
  border: '#e4ded0',
  borderSoft: '#eeeae0',
  text: '#1c2b33',
  textSecondary: '#4b5d68',
  textMuted: '#8b97a0',
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
