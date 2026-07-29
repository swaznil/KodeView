import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { ThemePreferenceProvider, useThemePreference } from '@/hooks/use-theme-preference';
import { loadGitHubToken } from '@/lib/github-token';
import { createPalette } from '@/lib/palette';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 450, fade: true });

export const unstable_settings = {
  anchor: 'index',
};

function ThemedRootLayout() {
  const { appPreferences, colorScheme, isReady: preferencesReady } = useThemePreference();
  const [tokenReady, setTokenReady] = useState(false);
  const palette = createPalette(colorScheme, appPreferences.accentColor);
  const navigationTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  useEffect(() => {
    loadGitHubToken()
      .catch(() => undefined)
      .finally(() => setTokenReady(true));
  }, []);

  const isReady = preferencesReady && tokenReady;

  useEffect(() => {
    if (isReady) {
      SplashScreen.hide();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <ThemeProvider
      value={{
        ...navigationTheme,
        colors: {
          ...navigationTheme.colors,
          background: palette.background,
          border: palette.border,
          card: palette.fill,
          primary: palette.accent,
          text: palette.text,
        },
      }}>
      <Stack
        screenOptions={{
          headerBackTitle: 'Back',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.accent,
          headerTitleStyle: { color: palette.text, fontWeight: '700' },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="discover" options={{ headerLargeTitle: false, title: 'Discover' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen
          name="repository/[id]"
          options={{
            headerLargeTitle: false,
            title: 'Repository',
          }}
        />
        <Stack.Screen name="repository/commits" options={{ title: 'Commits' }} />
        <Stack.Screen name="repository/branches" options={{ title: 'Branches' }} />
        <Stack.Screen
          name="reader"
          options={{
            presentation: 'card',
            title: 'Reader',
          }}
        />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <ThemedRootLayout />
    </ThemePreferenceProvider>
  );
}
