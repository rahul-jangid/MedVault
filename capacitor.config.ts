import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medvault.app',
  appName: 'MedVault',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      '*.firebaseapp.com',
      '*.google.com',
      '*.googleusercontent.com',
      'ais-dev-oqpwo4vcu45abrkrsxegym-749674698439.asia-southeast1.run.app'
    ]
  }
};

export default config;
