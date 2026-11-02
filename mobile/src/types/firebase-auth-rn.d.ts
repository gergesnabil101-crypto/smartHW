/**
 * getReactNativePersistence ships in Firebase Auth's React Native bundle
 * (index.rn.*) but is missing from the web-facing type declarations that
 * TypeScript resolves. This augmentation re-exposes it so metro bundles
 * keep type safety.
 */
import 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(
    storage: unknown
  ): import('firebase/auth').Persistence;
}
