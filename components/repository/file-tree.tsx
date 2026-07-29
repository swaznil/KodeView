import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, type ReactElement, type ReactNode } from 'react';
import { FlatList, Pressable, Text, View, type ListRenderItem } from 'react-native';

import { useAppPalette } from '@/hooks/use-theme-preference';
import { isImageExtension } from '@/lib/github';
import { formatBytes } from '@/lib/repository-storage';
import { radius, spacing } from '@/lib/palette';
import { flattenVisibleTree, type VisibleTreeRow } from '@/lib/tree';

// ─── File icon ─────────────────────────────────────────────────────────────────

const CODE_EXTENSIONS: Record<string, string> = {
  ts: 'code',
  tsx: 'code',
  js: 'code',
  jsx: 'code',
  py: 'code',
  rb: 'code',
  go: 'code',
  rs: 'code',
  swift: 'code',
  kt: 'code',
  java: 'code',
  c: 'code',
  cpp: 'code',
  cs: 'code',
  php: 'code',
  sh: 'terminal',
  bash: 'terminal',
  zsh: 'terminal',
  md: 'article',
  mdx: 'article',
  txt: 'article',
  json: 'data-object',
  yaml: 'data-object',
  yml: 'data-object',
  toml: 'data-object',
  xml: 'data-object',
  html: 'html',
  css: 'css',
  scss: 'css',
  svg: 'polyline',
  lock: 'lock',
  env: 'lock',
  gitignore: 'do-not-disturb',
  dockerfile: 'dns',
};

function fileIcon(
  ext: string | null,
  isImage: boolean,
): keyof typeof MaterialIcons.glyphMap {
  if (isImage) return 'image';
  if (!ext) return 'description';
  return (CODE_EXTENSIONS[ext.toLowerCase()] as keyof typeof MaterialIcons.glyphMap) ?? 'description';
}

// Extension-based colour hints
const EXT_COLORS: Record<string, string> = {
  ts: '#3178C6',
  tsx: '#3178C6',
  js: '#F7DF1E',
  jsx: '#F7DF1E',
  py: '#3572A5',
  go: '#00ADD8',
  rs: '#CE422B',
  swift: '#FA7343',
  kt: '#A97BFF',
  java: '#B07219',
  rb: '#CC342D',
  md: '#6B7280',
  mdx: '#6B7280',
  json: '#7C3AED',
  yaml: '#7C3AED',
  yml: '#7C3AED',
  css: '#563D7C',
  scss: '#C6538C',
  html: '#E34C26',
  sh: '#89E051',
  bash: '#89E051',
  dockerfile: '#2496ED',
};

function fileColor(ext: string | null, fallback: string): string {
  if (!ext) return fallback;
  return EXT_COLORS[ext.toLowerCase()] ?? fallback;
}

// ─── Depth indent guides ───────────────────────────────────────────────────────

function IndentGuides({
  depth,
  palette,
}: {
  depth: number;
  palette: ReturnType<typeof useAppPalette>;
}) {
  if (depth === 0) return null;

  return (
    <>
      {Array.from({ length: depth }).map((_, i) => (
        <View
          key={i}
          style={{
            borderLeftColor: `${palette.border}`,
            borderLeftWidth: 1,
            height: '100%',
            left: 8 + i * 14 + 8, // aligns to the icon centre of that depth
            position: 'absolute',
          }}
        />
      ))}
    </>
  );
}

// ─── Tree row ──────────────────────────────────────────────────────────────────

const TreeRow = memo(function TreeRow({
  compact,
  depth,
  isOpen,
  node,
  onToggle,
  repositoryId,
  showFileSizes,
}: {
  compact: boolean;
  depth: number;
  isOpen: boolean;
  node: VisibleTreeRow['node'];
  onToggle: (path: string) => void;
  repositoryId: string;
  showFileSizes: boolean;
}) {
  const palette = useAppPalette();
  const directory = node.type === 'directory';
  const isImg = !directory && isImageExtension(node.extension);
  const iconName = directory
    ? isOpen
      ? 'folder-open'
      : 'folder'
    : fileIcon(node.extension, isImg);

  const iconColor = directory
    ? palette.accent
    : fileColor(node.extension, palette.muted);

  const rowHeight = compact ? 30 : 34;

  return (
    <Pressable
      accessibilityHint={directory ? 'Expands or collapses this folder. Long press to copy its path.' : 'Opens this file. Long press to copy its path.'}
      accessibilityLabel={`${directory ? 'Folder' : 'File'} ${node.path}`}
      accessibilityRole="button"
      onLongPress={() => {
        Clipboard.setStringAsync(node.path)
          .then(() => Haptics.selectionAsync())
          .catch(() => undefined);
      }}
      onPress={() =>
        directory
          ? onToggle(node.path)
          : router.push({
              pathname: '/reader',
              params: { repoId: repositoryId, path: node.path },
            })
      }
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? palette.secondary : palette.fill,
        borderColor: palette.border,
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 6,
        minHeight: rowHeight,
        overflow: 'visible',
        paddingLeft: 8 + depth * 14,
        paddingRight: 8,
        position: 'relative',
      })}
    >
      {/* Indent guides sit behind content */}
      <IndentGuides depth={depth} palette={palette} />

      {/* Icon */}
      <MaterialIcons color={iconColor} name={iconName} size={16} />

      {/* Name */}
      <Text
        numberOfLines={1}
        style={{
          color: directory ? palette.text : palette.text,
          flex: 1,
          fontFamily: 'monospace',
          fontSize: compact ? 12 : 13,
          fontWeight: directory ? '600' : '400',
          opacity: directory ? 1 : 0.9,
        }}
      >
        {node.name}
      </Text>

      {/* File size badge */}
      {!directory && showFileSizes ? (
        <Text
          style={{
            color: palette.muted,
            fontSize: 10,
            fontVariant: ['tabular-nums'],
            opacity: 0.7,
          }}
        >
          {formatBytes(node.size)}
        </Text>
      ) : null}

      {/* Directory chevron */}
      {directory ? (
        <MaterialIcons
          color={palette.muted}
          name={isOpen ? 'expand-more' : 'chevron-right'}
          size={16}
        />
      ) : null}
    </Pressable>
  );
});

// ─── FileTreeList ──────────────────────────────────────────────────────────────

export const FileTreeList = memo(function FileTreeList({
  compact,
  expanded,
  header,
  nodes,
  onToggle,
  repositoryId,
  showFileSizes,
}: {
  compact: boolean;
  expanded: Set<string>;
  header?: ReactElement;
  nodes: VisibleTreeRow['node'][];
  onToggle: (path: string) => void;
  repositoryId: string;
  showFileSizes: boolean;
}) {
  const palette = useAppPalette();
  const rows = useMemo(
    () => flattenVisibleTree(nodes, expanded),
    [expanded, nodes],
  );

  const renderItem: ListRenderItem<VisibleTreeRow> = useCallback(
    ({ item }) => (
      <TreeRow
        compact={compact}
        depth={item.depth}
        isOpen={expanded.has(item.node.path)}
        node={item.node}
        onToggle={onToggle}
        repositoryId={repositoryId}
        showFileSizes={showFileSizes}
      />
    ),
    [compact, expanded, onToggle, repositoryId, showFileSizes],
  );

  return (
    <FlatList
      contentContainerStyle={{ gap: 3, padding: spacing.lg, paddingBottom: 40 }}
      contentInsetAdjustmentBehavior="automatic"
      data={rows}
      initialNumToRender={30}
      keyboardDismissMode="on-drag"
      keyExtractor={(item) => item.key}
      ListEmptyComponent={
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            gap: 6,
            justifyContent: 'center',
            paddingVertical: spacing.xxl,
          }}>
          <MaterialIcons color={palette.muted} name="search-off" size={18} />
          <Text style={{ color: palette.muted, fontSize: 13 }}>No matching files</Text>
        </View>
      }
      ListHeaderComponent={header}
      ListHeaderComponentStyle={{ marginBottom: spacing.md }}
      maxToRenderPerBatch={28}
      removeClippedSubviews
      renderItem={renderItem}
      style={{ flex: 1 }}
      windowSize={10}
    />
  );
});

// ─── FileTreePanel ─────────────────────────────────────────────────────────────

export function FileTreePanel({ children }: { children: ReactNode }) {
  const palette = useAppPalette();

  return (
    <View
      style={{
        backgroundColor: palette.fill,
        borderColor: palette.border,
        borderRadius: radius.sm,
        borderWidth: 1,
        overflow: 'hidden',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
      }}
    >
      {children}
    </View>
  );
}

// ─── FileTreeStats ─────────────────────────────────────────────────────────────
// Optional summary row to render above the tree

export function FileTreeStats({
  fileCount,
  folderCount,
  palette,
}: {
  fileCount: number;
  folderCount: number;
  palette: ReturnType<typeof useAppPalette>;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
      }}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
        <MaterialIcons color={palette.muted} name="folder" size={13} />
        <Text style={{ color: palette.muted, fontSize: 11 }}>
          {folderCount} folder{folderCount !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
        <MaterialIcons color={palette.muted} name="description" size={13} />
        <Text style={{ color: palette.muted, fontSize: 11 }}>
          {fileCount} file{fileCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}
