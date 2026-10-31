/**
 * Firebase App Check token provider.
 *
 * The server verifies App Check via `verifyAppCheckOptional` (non-blocking
 * unless ENFORCE_APP_CHECK=true). To enable it here:
 *
 *  1. `npx expo install @react-native-firebase/app @react-native-firebase/app-check`
 *  2. Add Play Integrity provider in the Firebase console (App Check → Apps)
 *  3. Replace `getToken` below with the real implementation:
 *       import appCheck from '@react-native-firebase/app-check';
 *       await appCheck().activate('PLAY_INTEGRITY_PROVIDER...');
 *       return (await appCheck().getToken(false)).token;
 *  4. Set ENFORCE_APP_CHECK=true on the server.
 *
 * Kept as a safe stub so the app bundles without the native module.
 */
export async function getAppCheckToken(): Promise<string | null> {
  return null;
}
