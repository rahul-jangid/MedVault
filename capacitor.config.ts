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
  },
  // Spoof a standard mobile Safari user agent to bypass Google's 403 disallowed_useragent
  overrideUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
};

export default config;
