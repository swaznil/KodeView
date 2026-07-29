import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { createPalette, type AccentColor } from '@/lib/palette';

export type ThemePreference = 'system' | 'light' | 'dark';

export type AppPreferences = {
  accentColor: AccentColor;
  autoOpenReadme: boolean;
  autoSync: boolean;
  compactExplorer: boolean;
  defaultCodeFontSize: number;
  markdownPreviewDefault: boolean;
  showFileSizes: boolean;
  showLineNumbers: boolean;
  wrapCodeByDefault: boolean;
};

type ThemePreferenceContextValue = {
  appPreferences: AppPreferences;
  colorScheme: 'light' | 'dark';
  isReady: boolean;
  preference: ThemePreference;
  setAppPreference: <Key extends keyof AppPreferences>(key: Key, value: AppPreferences[Key]) => void;
  setPreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = 'kodeview.theme-preference';
const APP_STORAGE_KEY = 'kodeview.app-preferences';

export const defaultAppPreferences: AppPreferences = {
  accentColor: 'green',
  autoOpenReadme: false,
  autoSync: false,
  compactExplorer: false,
  defaultCodeFontSize: 13,
  markdownPreviewDefault: true,
  showFileSizes: false,
  showLineNumbers: true,
  wrapCodeByDefault: false,
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

function normalizePreferences(stored: Partial<AppPreferences> & Record<string, unknown>): AppPreferences {
  const next = { ...defaultAppPreferences, ...stored };

  if (typeof stored.defaultDiscoveryLanguage === 'string') {
    delete (stored as { defaultDiscoveryLanguage?: string }).defaultDiscoveryLanguage;
  }

  if (typeof stored.showRepositoryInsights === 'boolean') {
    delete (stored as { showRepositoryInsights?: boolean }).showRepositoryInsights;
  }

  if (!['blue', 'green', 'purple', 'amber'].includes(String(next.accentColor))) {
    next.accentColor = 'green';
  }

  next.defaultCodeFontSize = Math.min(18, Math.max(11, Number(next.defaultCodeFontSize) || 13));

  return next;
}

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [appPreferences, setAppPreferences] = useState<AppPreferences>(defaultAppPreferences);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(APP_STORAGE_KEY)])
      .then(([storedTheme, storedPreferences]) => {
        const stored = storedTheme;
        if (stored === 'system' || stored === 'light' || stored === 'dark') {
          setPreferenceState(stored);
        }

        if (storedPreferences) {
          setAppPreferences(normalizePreferences(JSON.parse(storedPreferences)));
        }
      })
      .catch(() => undefined)
      .finally(() => setIsReady(true));
  }, []);

  const setPreference = (nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    AsyncStorage.setItem(STORAGE_KEY, nextPreference).catch(() => undefined);
  };

  const colorScheme = preference === 'system' ? systemScheme ?? 'light' : preference;

  const setAppPreference = <Key extends keyof AppPreferences>(key: Key, value: AppPreferences[Key]) => {
    setAppPreferences((current) => {
      const next = normalizePreferences({ ...current, [key]: value });
      AsyncStorage.setItem(APP_STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  };

  const value = useMemo(
    () => ({ appPreferences, colorScheme, isReady, preference, setAppPreference, setPreference }),
    [appPreferences, colorScheme, isReady, preference]
  );

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  const value = useContext(ThemePreferenceContext);

  if (!value) {
    throw new Error('useThemePreference must be used inside ThemePreferenceProvider.');
  }

  return value;
}

export function useAppPalette() {
  const { appPreferences, colorScheme } = useThemePreference();
  return useMemo(() => createPalette(colorScheme, appPreferences.accentColor), [appPreferences.accentColor, colorScheme]);
}
