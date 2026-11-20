import Constants from 'expo-constants';
import { GoogleAuthProvider, signInWithCredential, getAdditionalUserInfo } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { api } from '../../lib/api';

/**
 * Google Sign-In (native) — @react-native-google-signin/google-signin.
 *
 * The native module does NOT exist inside Expo Go, so the module is loaded
 * lazily the first time a sign-in is attempted — importing this file is always
 * safe. GOOGLE_SIGNIN_ENABLED additionally requires the web OAuth client id,
 * which is configured via EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (.env / eas env).
 */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

export const GOOGLE_SIGNIN_ENABLED =
  !!WEB_CLIENT_ID && Constants.appOwnership !== 'expo' && Constants.executionEnvironment !== 'storeClient';

let configured = false;

function googleSigninModule(): typeof import('@react-native-google-signin/google-signin') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-google-signin/google-signin');
}

function ensureConfigured() {
  if (configured) return;
  const { GoogleSignin } = googleSigninModule();
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, offlineAccess: false });
  configured = true;
}

export type GoogleSignInResult = 'ok' | 'cancelled';

/**
 * Runs the native Google account picker, exchanges the idToken for a Firebase
 * credential, and provisions the teacher profile for brand-new users.
 * Throws a user-facing error message on failure; returns 'cancelled' when the
 * user backs out of the picker.
 */
export async function signInWithGoogleAccount(): Promise<GoogleSignInResult> {
  ensureConfigured();
  const { GoogleSignin, isSuccessResponse, statusCodes } = googleSigninModule();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return 'cancelled';
    const idToken = response.data.idToken;
    if (!idToken) throw new Error('missing_id_token');

    const cred = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, cred);
    await api.post('/api/auth/sync-claims').catch(() => null);

    // First Google sign-in for this account → create the teacher profile
    // (register-profile is idempotent: it merges, never wipes subscription data).
    if (getAdditionalUserInfo(result)?.isNewUser) {
      const name = result.user.displayName || '';
      const email = result.user.email || '';
      await api
        .post('/api/auth/register-profile', { name, email, phone: '', subject: '', grade_level: [] })
        .catch(() => null);
      await api.post('/api/admin/notify-registration', { name, email }).catch(() => null);
    }
    return 'ok';
  } catch (e: any) {
    const code = String(e?.code || '');
    if (code === statusCodes.SIGN_IN_CANCELLED || code === '5') return 'cancelled';
    if (code === statusCodes.IN_PROGRESS) throw new Error('جاري تسجيل الدخول بالفعل — انتظر لحظة.');
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('خدمات Google Play غير متاحة على هذا الجهاز.');
    }
    if (code === 'DEVELOPER_ERROR' || code === '10') {
      throw new Error('إعداد تسجيل الدخول بجوجل غير مكتمل (OAuth client / SHA-1) — راجع إعدادات المشروع.');
    }
    throw new Error(e?.message || 'تعذر تسجيل الدخول بحساب جوجل.');
  }
}
