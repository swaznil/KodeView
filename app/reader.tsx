import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';

import { InlineError, LoadingState } from '@/components/app/shared';
import { ImageViewer } from '@/components/reader/image-viewer';
import { ReaderBody } from '@/components/reader/markdown-view';
import { isImageExtension } from '@/lib/github';
import { isMarkdownExtension } from '@/lib/markdown';
import { useAppPalette, useThemePreference } from '@/hooks/use-theme-preference';
import { spacing } from '@/lib/palette';
import {
  findRepositoryNode,
  listSavedRepositories,
  readRepositoryFile,
  type RepositoryTreeNode,
  type SavedRepository,
} from '@/lib/repository-storage';

function Tool({
  active,
  icon,
  label,
  onPress,
}: {
  active?: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const palette = useAppPalette();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: active ? palette.accent : pressed ? palette.secondary : palette.fill,
        borderColor: active ? palette.accent : palette.border,
        borderRadius: 8,
        borderWidth: 1,
        height: 42,
        justifyContent: 'center',
        width: 42,
      })}>
      <MaterialIcons color={active ? '#ffffff' : palette.text} name={icon} size={18} />
    </Pressable>
  );
}

export default function ReaderScreen() {
  const { path, repoId } = useLocalSearchParams<{ path: string; repoId: string }>();
  const { appPreferences } = useThemePreference();
  const palette = useAppPalette();
  const [repository, setRepository] = useState<SavedRepository | null>(null);
  const [node, setNode] = useState<RepositoryTreeNode | null>(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [preview, setPreview] = useState(appPreferences.markdownPreviewDefault);
  const [showLines, setShowLines] = useState(appPreferences.showLineNumbers);
  const [wrap, setWrap] = useState(appPreferences.wrapCodeByDefault);
  const [fontSize, setFontSize] = useState(appPreferences.defaultCodeFontSize);
  const [findVisible, setFindVisible] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const markdown = useMemo(() => isMarkdownExtension(node?.extension ?? null), [node?.extension]);
  const image = useMemo(() => isImageExtension(node?.extension ?? null), [node?.extension]);
  const matchCount = useMemo(() => {
    const needle = findQuery.trim().toLocaleLowerCase();
    return needle ? content.toLocaleLowerCase().split(needle).length - 1 : 0;
  }, [content, findQuery]);
  const markdownBaseUrl = useMemo(() => {
    if (!repository || !node) {
      return undefined;
    }
    return `${repository.htmlUrl}/blob/${encodeURIComponent(repository.defaultBranch)}/${node.path}`;
  }, [node, repository]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    listSavedRepositories()
      .then(async (repositories) => {
        const repository = repositories.find((item) => item.id === repoId);
        if (!repository || !path) {
          throw new Error('File not found.');
        }

        const found = await findRepositoryNode(repository, path);
        if (!found) {
          throw new Error('File not found.');
        }

        const nextContent = isImageExtension(found.extension) ? '' : await readRepositoryFile(found);
        if (!active) {
          return;
        }

        setRepository(repository);
        setNode(found);
        setPreview(appPreferences.markdownPreviewDefault);
        setShowLines(appPreferences.showLineNumbers);
        setFontSize(appPreferences.defaultCodeFontSize);
        setWrap(appPreferences.wrapCodeByDefault || isMarkdownExtension(found.extension));
        setContent(nextContent);
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Could not open file.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    appPreferences.defaultCodeFontSize,
    appPreferences.markdownPreviewDefault,
    appPreferences.showLineNumbers,
    appPreferences.wrapCodeByDefault,
    path,
    reloadKey,
    repoId,
  ]);

  useEffect(() => {
    if (!markdown) {
      setWrap(appPreferences.wrapCodeByDefault);
    }
  }, [appPreferences.wrapCodeByDefault, markdown]);

  async function copyFile() {
    await Clipboard.setStringAsync(content);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setTimeout(() => setCopied(false), 1800);
  }

  async function shareFile() {
    if (!node) {
      return;
    }

    const sourceUrl = markdownBaseUrl ?? repository?.htmlUrl;
    const message =
      content.length <= 80_000
        ? `${node.path}\n\n${content}`
        : `${node.path}${sourceUrl ? `\n${sourceUrl}` : ''}`;
    await Share.share({ message, title: node.name });
  }

  return (
    <View style={{ backgroundColor: palette.background, flex: 1 }}>
      <Stack.Screen options={{ title: node?.name ?? 'Reader' }} />
      <View
        style={{
          borderBottomColor: palette.border,
          borderBottomWidth: 1,
          gap: spacing.sm,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}>
        <Text selectable numberOfLines={1} style={{ color: palette.muted, fontFamily: 'monospace', fontSize: 12 }}>
          {node?.path ?? path}
        </Text>
        {!image && !loading && !error ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {markdown ? (
            <Tool active={preview} icon="article" label="Markdown preview" onPress={() => setPreview((value) => !value)} />
          ) : null}
          {!markdown || !preview ? (
            <>
              <Tool
                active={showLines}
                icon="format-list-numbered"
                label="Line numbers"
                onPress={() => setShowLines((value) => !value)}
              />
              <Tool active={wrap} icon="wrap-text" label="Wrap lines" onPress={() => setWrap((value) => !value)} />
            </>
          ) : (
            <Tool active={wrap} icon="wrap-text" label="Wrap code blocks" onPress={() => setWrap((value) => !value)} />
          )}
          <Tool icon="text-decrease" label="Decrease font size" onPress={() => setFontSize((value) => Math.max(11, value - 1))} />
          <Tool icon="text-increase" label="Increase font size" onPress={() => setFontSize((value) => Math.min(18, value + 1))} />
          <Tool
            active={findVisible}
            icon="search"
            label="Find in file"
            onPress={() => {
              setFindVisible((value) => !value);
              Haptics.selectionAsync().catch(() => undefined);
            }}
          />
          <Tool icon={copied ? 'check' : 'content-copy'} label={copied ? 'Copied' : 'Copy file'} onPress={copyFile} />
          <Tool icon="share" label="Share file" onPress={shareFile} />
        </ScrollView>
        ) : null}
        {findVisible && !image && !loading && !error ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: palette.fill,
              borderColor: palette.border,
              borderCurve: 'continuous',
              borderRadius: 10,
              borderWidth: 1,
              flexDirection: 'row',
              gap: 8,
              paddingHorizontal: 10,
            }}>
            <MaterialIcons color={palette.muted} name="search" size={18} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              onChangeText={setFindQuery}
              placeholder="Find in file"
              placeholderTextColor={palette.muted}
              returnKeyType="search"
              style={{ color: palette.text, flex: 1, fontSize: 14, minHeight: 42 }}
              value={findQuery}
            />
            {findQuery ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: matchCount > 0 ? palette.accent : palette.muted, fontSize: 12, fontWeight: '700' }}>
                {matchCount} {matchCount === 1 ? 'match' : 'matches'}
              </Text>
            ) : null}
            {findQuery ? (
              <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setFindQuery('')}>
                <MaterialIcons color={palette.muted} name="close" size={18} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {loading ? (
        <LoadingState detail="Reading from your offline repository" palette={palette} title="Opening file" />
      ) : error ? (
        <View style={{ padding: 16 }}>
          <InlineError
            actionLabel="Retry"
            message={error}
            onAction={() => setReloadKey((value) => value + 1)}
            palette={palette}
          />
        </View>
      ) : image && node ? (
        <ImageViewer name={node.name} palette={palette} uri={node.uri} />
      ) : (
        <ReaderBody
          content={content}
          extension={node?.extension ?? null}
          fontSize={fontSize}
          markdownBaseUrl={markdownBaseUrl}
          markdownPreview={preview}
          palette={palette}
          searchQuery={findQuery}
          showCodeLines={showLines}
          wrap={wrap}
        />
      )}
    </View>
  );
}
