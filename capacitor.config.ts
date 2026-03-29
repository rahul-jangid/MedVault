import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medvault.app',
  appName: 'MedVault',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
