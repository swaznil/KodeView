import * as SecureStore from 'expo-secure-store';

import { setGitHubToken } from '@/lib/github';

const GITHUB_TOKEN_KEY = 'kodeview.github-token';

export async function loadGitHubToken() {
  try {
    if (!(await SecureStore.isAvailableAsync())) {
      setGitHubToken(null);
      return false;
    }

    const token = await SecureStore.getItemAsync(GITHUB_TOKEN_KEY);
    setGitHubToken(token);
    return Boolean(token);
  } catch {
    setGitHubToken(null);
    return false;
  }
}

export async function saveGitHubToken(token: string) {
  const normalized = token.trim();
  if (!normalized) {
    throw new Error('Enter a GitHub token first.');
  }

  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error('Secure token storage is unavailable on this platform.');
  }

  await SecureStore.setItemAsync(GITHUB_TOKEN_KEY, normalized, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
  setGitHubToken(normalized);
}

export async function removeGitHubToken() {
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.deleteItemAsync(GITHUB_TOKEN_KEY);
  }
  setGitHubToken(null);
}
