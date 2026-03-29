import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medvault.app',
  appName: 'MedVault',
  webDir: 'dist',
  server: {
    iosScheme: 'https',
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: [
      '*.firebaseapp.com',
      '*.google.com',
      '*.googleusercontent.com',
      'accounts.google.com',
      'https://accounts.google.com/*',
      'https://ais-dev-oqpwo4vcu45abrkrsxegym-749674698439.asia-southeast1.run.app'
    ]
  }
};

export default config;
