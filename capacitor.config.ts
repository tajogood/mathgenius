import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android shell for the existing offline-capable math learning web app.
 * Change appId only if needed BEFORE releasing through an app store.
 */
const config: CapacitorConfig = {
  appId: 'kr.larix.mathgenius',
  appName: '수학천재',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
