import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { InlineError, LoadingState } from '@/components/app/shared';
import { useAppPalette } from '@/hooks/use-theme-preference';
import { fetchRepositoryCommits, type GitHubCommit } from '@/lib/github';
import { spacing } from '@/lib/palette';
import { listSavedRepositories, type SavedRepository } from '@/lib/repository-storage';

function formatWhen(value: string | null) {
  if (!value) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function CommitsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = useAppPalette();
  const [repository, setRepository] = useState<SavedRepository | null>(null);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    (async () => {
      setBusy(true);
      setError(null);

      try {
        const found = (await listSavedRepositories()).find((item) => item.id === id) ?? null;
        if (!found) {
          throw new Error('Repository not found.');
        }

        if (!active) {
          return;
        }

        setRepository(found);
        setCommits(await fetchRepositoryCommits(found.owner, found.repo, found.defaultBranch, controller.signal));
      } catch (caught) {
        if (active && !controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : 'Could not load commits.');
        }
      } finally {
        if (active) {
          setBusy(false);
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [id, reloadKey]);

  return (
    <View style={{ backgroundColor: palette.background, flex: 1 }}>
      <Stack.Screen options={{ title: repository ? `Commits · ${repository.repo}` : 'Commits' }} />
      {busy ? (
        <LoadingState detail="Fetching the latest commit history from GitHub" palette={palette} title="Loading commits" />
      ) : error ? (
        <View style={{ padding: spacing.lg }}>
          <InlineError
            actionLabel="Retry"
            message={error}
            onAction={() => setReloadKey((value) => value + 1)}
            palette={palette}
          />
        </View>
      ) : (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ gap: 10, padding: 16, paddingBottom: 32 }}
          data={commits}
          initialNumToRender={16}
          keyExtractor={(item) => item.sha + item.message}
          maxToRenderPerBatch={20}
          removeClippedSubviews
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                if (item.url) {
                  WebBrowser.openBrowserAsync(item.url).catch(() => undefined);
                }
              }}
              style={({ pressed }) => ({
                backgroundColor: pressed ? palette.secondary : palette.fill,
                borderColor: palette.border,
                borderRadius: 8,
                borderWidth: 1,
                gap: 6,
                padding: 12,
              })}>
              <Text selectable style={{ color: palette.accent, fontFamily: 'monospace', fontSize: 12, fontWeight: '700' }}>
                {item.sha}
              </Text>
              <Text selectable style={{ color: palette.text, fontSize: 14, fontWeight: '700' }}>{item.message}</Text>
              <Text selectable style={{ color: palette.muted, fontSize: 12 }}>
                {item.author ?? 'Unknown author'} · {formatWhen(item.date)}
              </Text>
            </Pressable>
          )}
          windowSize={10}
        />
      )}
    </View>
  );
}
