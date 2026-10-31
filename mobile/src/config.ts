import Constants from 'expo-constants';

/**
 * Central runtime configuration.
 *
 * The API base URL is resolved in this order:
 *  1. EXPO_PUBLIC_API_URL environment variable (dev machines / EAS env)
 *  2. app.json -> expo.extra.apiBaseUrl (baked into the binary)
 *
 * NOTE: Never put secrets in this file or in app.json extra — the app bundle
 * is public. All secrets (Gemini key, Stripe, JWT) live on the server only.
 */

const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string };

export const API_BASE_URL: string = (
  process.env.EXPO_PUBLIC_API_URL ||
  extra.apiBaseUrl ||
  ''
).replace(/\/+$/, '');

export const APP_NAME = 'مصحح الواجبات الذكي';

export const LIMITS = {
  studentNameMax: 120,
  centerNameMax: 100,
  phoneMax: 50,
  essayAnswerMax: 5000,
  questionTextMax: 10000,
  quizTitleMax: 200,
} as const;

export function assertApiConfigured(): void {
  if (!API_BASE_URL) {
    throw new Error(
      'API base URL is not configured. Set EXPO_PUBLIC_API_URL or expo.extra.apiBaseUrl in app.json.'
    );
  }
}
