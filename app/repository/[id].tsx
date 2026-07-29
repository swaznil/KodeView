import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { InlineError, LoadingState, Panel, Pill } from '@/components/app/shared';
import { OwnerAvatar } from '@/components/repository/owner-avatar';
import { FileTreeList } from '@/components/repository/file-tree';
import { useAppPalette, useThemePreference } from '@/hooks/use-theme-preference';
import { spacing } from '@/lib/palette';
import {
  deleteRepository,
  formatBytes,
  listSavedRepositories,
  loadRepositoryTree,
  type SavedRepository,
} from '@/lib/repository-storage';
import { collectDirectoryPaths, filterTree, findReadme } from '@/lib/tree';

export default function RepositoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { appPreferences } = useThemePreference();
  const palette = useAppPalette();
  const [repository, setRepository] = useState<SavedRepository | null>(null);
  const [tree, setTree] = useState<Awaited<ReturnType<typeof loadRepositoryTree>>>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [openedReadme, setOpenedReadme] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const visibleTree = useMemo(() => filterTree(tree, query), [query, tree]);
  const allDirectoryPaths = useMemo(
    () => collectDirectoryPaths(tree, Number.MAX_SAFE_INTEGER),
    [tree],
  );
  const displayedExpanded = useMemo(
    () =>
      query.trim()
        ? new Set(collectDirectoryPaths(visibleTree, Number.MAX_SAFE_INTEGER))
        : expanded,
    [expanded, query, visibleTree],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const repositories = await listSavedRepositories();
      const found = repositories.find((item) => item.id === id) ?? null;
      setRepository(found);
      setOpenedReadme(false);

      if (!found) {
        setTree([]);
        return;
      }

      const nodes = await loadRepositoryTree(found);
      setTree(nodes);
      setExpanded(new Set(collectDirectoryPaths(nodes)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open repository.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!appPreferences.autoOpenReadme || openedReadme || tree.length === 0 || !repository) {
      return;
    }

    const readme = findReadme(tree);
    if (!readme) {
      return;
    }

    setOpenedReadme(true);
    router.push({ pathname: '/reader', params: { repoId: repository.id, path: readme.path } });
  }, [appPreferences.autoOpenReadme, openedReadme, repository, tree]);

  const toggle = useCallback((path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  async function removeRepository() {
    if (!repository) {
      return;
    }

    await deleteRepository(repository);
    router.back();
  }

  return (
    <View style={{ backgroundColor: palette.background, flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityLabel="Delete repository"
              accessibilityRole="button"
              onPress={() =>
                Alert.alert('Delete repository?', repository?.fullName, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: removeRepository },
                ])
              }
              style={{ paddingHorizontal: spacing.sm }}>
              <MaterialIcons color={palette.danger} name="delete-outline" size={22} />
            </Pressable>
          ),
          title: repository?.fullName ?? 'Repository',
        }}
      />
      {loading ? (
        <LoadingState detail="Indexing folders for fast offline browsing" palette={palette} title="Loading repository" />
      ) : error ? (
        <View style={{ padding: spacing.lg }}>
          <InlineError actionLabel="Retry" message={error} onAction={load} palette={palette} />
        </View>
      ) : repository ? (
        <FileTreeList
          compact={appPreferences.compactExplorer}
          expanded={displayedExpanded}
          header={
            <View style={{ gap: spacing.md }}>
              <Panel palette={palette}>
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
                  <OwnerAvatar owner={repository.owner} palette={palette} size={44} uri={repository.ownerAvatarUrl} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text selectable style={{ color: palette.text, fontSize: 18, fontWeight: '900' }}>
                      {repository.fullName}
                    </Text>
                    <Text selectable style={{ color: palette.muted, fontSize: 12 }}>
                      {formatBytes(repository.sizeBytes)} saved · {repository.fileCount.toLocaleString()} files
                    </Text>
                  </View>
                </View>
                {repository.description ? (
                  <Text selectable style={{ color: palette.muted, fontSize: 13, lineHeight: 19 }}>
                    {repository.description}
                  </Text>
                ) : null}
              </Panel>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                onChangeText={setQuery}
                placeholder="Search files and paths"
                placeholderTextColor={palette.muted}
                style={{
                  backgroundColor: palette.fill,
                  borderColor: palette.border,
                  borderCurve: 'continuous',
                  borderRadius: 10,
                  borderWidth: 1,
                  color: palette.text,
                  fontSize: 14,
                  minHeight: 44,
                  paddingHorizontal: 12,
                }}
                value={query}
              />
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
                <Text style={{ color: palette.text, flex: 1, fontSize: 16, fontWeight: '800' }}>
                  Files
                </Text>
                <Pressable
                  accessibilityLabel="Collapse all folders"
                  disabled={Boolean(query.trim())}
                  onPress={() => setExpanded(new Set())}
                  style={{ opacity: query.trim() ? 0.45 : 1 }}>
                  <Pill palette={palette}>Collapse</Pill>
                </Pressable>
                <Pressable
                  accessibilityLabel="Expand all folders"
                  disabled={Boolean(query.trim())}
                  onPress={() => setExpanded(new Set(allDirectoryPaths))}
                  style={{ opacity: query.trim() ? 0.45 : 1 }}>
                  <Pill palette={palette}>Expand all</Pill>
                </Pressable>
              </View>
            </View>
          }
          nodes={visibleTree}
          onToggle={toggle}
          repositoryId={repository.id}
          showFileSizes={appPreferences.showFileSizes}
        />
      ) : (
        <View style={{ padding: spacing.lg }}>
          <InlineError message="Repository not found." palette={palette} />
        </View>
      )}
    </View>
  );
}
