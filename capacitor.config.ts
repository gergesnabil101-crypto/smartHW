import type { CapacitorConfig } from '@capacitor/cli';

// The Android app loads the live web app so teachers keep the same accounts, data and server.
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.smarthw.app',
  appName: 'مصحح الواجبات الذكي',
  webDir: 'dist',
  ...(serverUrl ? { server: { url: serverUrl, cleartext: false } } : {}),
  android: {
    allowMixedContent: false
  }
};

export default config;
