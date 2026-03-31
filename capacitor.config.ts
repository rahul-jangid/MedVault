import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rahuljangid.medvault',
  appName: 'MedVault',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    allowNavigation: [
      'gen-lang-client-0597938563.firebaseapp.com',
      '*.firebaseapp.com',
      '*.google.com',
      '*.googleusercontent.com',
      'accounts.google.com',
      'https://accounts.google.com/*',
      'https://ais-dev-oqpwo4vcu45abrkrsxegym-749674698439.asia-southeast1.run.app'
    ]
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"]
    }
  },
  // Spoof a Desktop Chrome user agent. Google often allows this in WebViews 
  // because it thinks it's a desktop browser, bypassing the "disallowed_useragent" block.
  overrideUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
};

export default config;
