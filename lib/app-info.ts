import Constants from 'expo-constants';

export const APP_NAME = 'KodeView';

/** Replace with your hosted privacy policy URL before Play Store submission. */
export const PRIVACY_POLICY_URL = 'https://example.com/kodeview/privacy-policy';

export const SUPPORT_EMAIL = 'support@example.com';
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
export const APP_BUILD =
  Constants.expoConfig?.android?.versionCode?.toString() ??
  Constants.expoConfig?.ios?.buildNumber?.toString() ??
  '1';
