import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloneModal } from '@/components/app/clone-modal';
import {
  AppHeader,
  HeaderIconButton,
  InlineError,
  LoadingState,
  Panel,
  Pill,
  ProgressBar,
} from '@/components/app/shared';
import { RepositoryMenu } from '@/components/repository/repository-menu';
import { RepositoryRow } from '@/components/repository/repository-row';
import { useAppPalette, useThemePreference } from '@/hooks/use-theme-preference';
import { runAutoSyncIfEnabled, syncRepository, syncStaleRepositories } from '@/lib/repository-sync';
import {
  filterAndSortRepositories,
  getPinnedRepositoryIds,
  getRepositorySort,
  setRepositorySort,
  togglePinnedRepository,
  type RepositorySort,
} from '@/lib/repository-prefs';
import { spacing } from '@/lib/palette';
import { deleteRepository, listSavedRepositories, type ImportProgress, type SavedRepository } from '@/lib/repository-storage';

const sortOptions: { label: string; value: RepositorySort }[] = [
  { label: 'Recent', value: 'recent' },
  { label: 'A–Z', value: 'name-asc' },
  { label: 'Z–A', value: 'name-desc' },
  { label: 'Stars', value: 'stars' },
  { label: 'Size', value: 'size' },
];

export default function HomeScreen() {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();
  const { appPreferences } = useThemePreference();
  const [repositories, setRepositories] = useState<SavedRepository[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [sort, setSort] = useState<RepositorySort>('recent');
  const [query, setQuery] = useState('');
  const [menuRepository, setMenuRepository] = useState<SavedRepository | null>(null);
  const [cloneVisible, setCloneVisible] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [saved, pinned, savedSort] = await Promise.all([
      listSavedRepositories().catch(() => []),
      getPinnedRepositoryIds(),
      getRepositorySort(),
    ]);
    setRepositories(saved);
    setPinnedIds(pinned);
    setSort(savedSort);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          await refresh();
          if (active) {
            setInitialLoading(false);
          }
          if (!active) {
            return;
          }

          if (appPreferences.autoSync) {
            setSyncing(true);
            await runAutoSyncIfEnabled(true);
            if (active) {
              await refresh();
            }
          }
        } catch (caught) {
          if (active) {
            setError(caught instanceof Error ? caught.message : 'Could not load your repositories.');
          }
        } finally {
          if (active) {
            setInitialLoading(false);
            setSyncing(false);
          }
        }
      })();

      return () => {
        active = false;
      };
    }, [appPreferences.autoSync, refresh])
  );

  const visibleRepositories = useMemo(
    () => filterAndSortRepositories(repositories, { pinnedIds, query, sort }),
    [pinnedIds, query, repositories, sort]
  );

  const repoCount = repositories.length;
  const subtitle = useMemo(
    () =>
      repoCount === 0
        ? initialLoading
          ? 'Loading your offline library…'
          : 'Clone public GitHub repositories for offline reading.'
        : `${repoCount} local ${repoCount === 1 ? 'repository' : 'repositories'}${syncing ? ' · syncing…' : ''}`,
    [initialLoading, repoCount, syncing]
  );

  async function handlePin(repository: SavedRepository) {
    await togglePinnedRepository(repository.id);
    const next = await getPinnedRepositoryIds();
    setPinnedIds(next);
  }

  async function handleSync(repository: SavedRepository) {
    setSyncing(true);
    setError(null);
    setSyncProgress({ phase: 'download', progress: 0, message: `Syncing ${repository.fullName}` });

    try {
      await syncRepository(repository, setSyncProgress);
      await refresh();
      Alert.alert('Synced', `${repository.fullName} was updated from GitHub.`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Sync failed.';
      setError(message);
      Alert.alert('Sync failed', message);
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  }

  function handleDelete(repository: SavedRepository) {
    Alert.alert('Delete repository?', repository.fullName, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRepository(repository);
          await refresh();
        },
      },
    ]);
  }

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={palette.accent}
            onRefresh={async () => {
              setRefreshing(true);
              setError(null);
              try {
                if (appPreferences.autoSync) {
                  await syncStaleRepositories({ force: true });
                }
                await refresh();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'Refresh failed.');
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
        style={{ backgroundColor: palette.background }}
        contentContainerStyle={{
          gap: 16,
          minHeight: '100%',
          padding: 16,
          paddingBottom: 32,
          paddingTop: Math.max(16, insets.top + 8),
        }}>
        <AppHeader
          palette={palette}
          subtitle={subtitle}
          title="Repositories"
          trailing={
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <HeaderIconButton icon="add" label="Clone repository" onPress={() => setCloneVisible(true)} palette={palette} />
              <HeaderIconButton icon="search" label="Discover" onPress={() => router.push('/discover')} palette={palette} />
              <HeaderIconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} palette={palette} />
            </View>
          }
        />

        {syncProgress ? (
          <Panel palette={palette}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
              <ActivityIndicator color={palette.accent} />
              <Text style={{ color: palette.text, flex: 1, fontSize: 13, fontWeight: '700' }}>
                {syncProgress.message}
              </Text>
              <Text style={{ color: palette.muted, fontSize: 12 }}>{Math.round(syncProgress.progress * 100)}%</Text>
            </View>
            <ProgressBar palette={palette} progress={syncProgress.progress} />
          </Panel>
        ) : null}

        {error ? <InlineError message={error} palette={palette} /> : null}

        {repoCount > 0 ? (
          <View style={{ gap: 10 }}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Search local repositories"
              placeholderTextColor={palette.muted}
              style={{
                backgroundColor: palette.fill,
                borderColor: palette.border,
                borderRadius: 8,
                borderWidth: 1,
                color: palette.text,
                fontSize: 14,
                minHeight: 42,
                paddingHorizontal: 12,
              }}
              value={query}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {sortOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={async () => {
                    setSort(option.value);
                    await setRepositorySort(option.value);
                  }}>
                  <Pill palette={palette} selected={sort === option.value}>
                    {option.label}
                  </Pill>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
            <Text style={{ color: palette.text, flex: 1, fontSize: 18, fontWeight: '800' }}>
              Local repositories
            </Text>
            <Pill icon="save" palette={palette}>
              {visibleRepositories.length.toString()}
            </Pill>
          </View>

          {initialLoading ? (
            <LoadingState detail="Checking downloaded repositories" palette={palette} title="Loading library" />
          ) : repoCount === 0 ? (
            <Panel palette={palette}>
              <MaterialIcons color={palette.muted} name="inventory-2" size={26} />
              <Text style={{ color: palette.text, fontSize: 16, fontWeight: '800' }}>No repositories saved yet</Text>
              <Text style={{ color: palette.muted, fontSize: 13, lineHeight: 19 }}>
                Tap Clone to add a GitHub URL, or browse trending repos in Discover.
              </Text>
              <Pressable
                onPress={() => setCloneVisible(true)}
                style={({ pressed }) => ({
                  alignSelf: 'flex-start',
                  backgroundColor: pressed ? palette.secondary : palette.primary,
                  borderRadius: 8,
                  marginTop: spacing.sm,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                })}>
                <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>Clone repository</Text>
              </Pressable>
            </Panel>
          ) : visibleRepositories.length === 0 ? (
            <Text style={{ color: palette.muted, fontSize: 14, paddingVertical: spacing.lg, textAlign: 'center' }}>
              No repositories match your search.
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {visibleRepositories.map((repository) => (
                <RepositoryRow
                  key={repository.id}
                  onOpenMenu={setMenuRepository}
                  pinned={pinnedIds.includes(repository.id)}
                  repository={repository}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <CloneModal
        onClose={() => setCloneVisible(false)}
        onCloned={(id) => {
          refresh();
          router.push({ pathname: '/repository/[id]', params: { id } });
        }}
        palette={palette}
        visible={cloneVisible}
      />

      <RepositoryMenu
        onClose={() => setMenuRepository(null)}
        onDelete={() => menuRepository && handleDelete(menuRepository)}
        onPin={() => menuRepository && handlePin(menuRepository)}
        onSync={() => menuRepository && handleSync(menuRepository)}
        palette={palette}
        pinned={menuRepository ? pinnedIds.includes(menuRepository.id) : false}
        repository={menuRepository}
        visible={Boolean(menuRepository)}
      />
    </>
  );
}
