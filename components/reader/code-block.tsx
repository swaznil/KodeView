import { memo, useCallback, useMemo } from 'react';
import { FlatList, Text, View, useWindowDimensions, type ListRenderItem } from 'react-native';

import { highlightLine } from '@/lib/markdown';
import { type Palette } from '@/lib/palette';

type CodeBlockProps = {
  content: string;
  extension: string | null;
  fontSize: number;
  palette: Palette;
  searchQuery?: string;
  showLines: boolean;
  virtualized?: boolean;
  wrap: boolean;
};

type LineRow = {
  index: number;
  line: string;
};

const CodeLine = memo(function CodeLine({
  extension,
  fontSize,
  gutter,
  index,
  line,
  lineHeight,
  palette,
  searchQuery,
  showLines,
  wrap,
}: {
  extension: string | null;
  fontSize: number;
  gutter: number;
  index: number;
  line: string;
  lineHeight: number;
  palette: Palette;
  searchQuery?: string;
  showLines: boolean;
  wrap: boolean;
}) {
  const colors = useMemo(
    () => ({
      attr: '#9CDCFE',
      comment: palette.muted,
      function: '#DCDCAA',
      keyword: '#C586C0',
      number: '#B5CEA8',
      operator: '#D4D4D4',
      punctuation: '#808080',
      string: '#CE9178',
      tag: '#569CD6',
      text: palette.text,
      variable: '#4FC1FF',
    }),
    [palette]
  );

  const parts = useMemo(() => highlightLine(line, extension, colors), [colors, extension, line]);
  const matchesSearch = Boolean(
    searchQuery?.trim() && line.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase()),
  );

  return (
    <View
      style={{
        backgroundColor: matchesSearch ? `${palette.accent}24` : 'transparent',
        flexDirection: 'row',
        width: wrap ? '100%' : undefined,
      }}>
      {showLines ? (
        <Text
          style={{
            color: palette.muted,
            fontFamily: 'monospace',
            fontSize,
            lineHeight,
            marginRight: 10,
            minWidth: gutter * (fontSize * 0.62) + 8,
            textAlign: 'right',
          }}>
          {String(index + 1).padStart(gutter, ' ')}
        </Text>
      ) : null}
      <Text
        selectable
        style={{
          color: palette.text,
          flex: wrap ? 1 : undefined,
          flexShrink: wrap ? 1 : undefined,
          fontFamily: 'monospace',
          fontSize,
          lineHeight,
        }}>
        {parts.map((part) => (
          <Text key={part.key} style={{ color: part.color }}>
            {part.text}
          </Text>
        ))}
      </Text>
    </View>
  );
});

export const CodeBlock = memo(function CodeBlock({
  content,
  extension,
  fontSize,
  palette,
  searchQuery,
  showLines,
  virtualized = false,
  wrap,
}: CodeBlockProps) {
  const { width: windowWidth } = useWindowDimensions();
  const lines = useMemo(() => content.replace(/\t/g, '  ').split(/\r\n|\n|\r/), [content]);
  const gutter = String(lines.length).length;
  const lineHeight = fontSize + 8;
  const data = useMemo(() => lines.map((line, index) => ({ index, line })), [lines]);
  const contentWidth = useMemo(() => {
    if (wrap) {
      return windowWidth;
    }
    const longestLine = lines.reduce((longest, line) => Math.max(longest, line.length), 0);
    const gutterWidth = showLines ? (gutter + 2) * fontSize * 0.62 : 0;
    return Math.max(windowWidth, Math.min(longestLine, 5_000) * fontSize * 0.62 + gutterWidth + 32);
  }, [fontSize, gutter, lines, showLines, windowWidth, wrap]);

  const renderItem: ListRenderItem<LineRow> = useCallback(
    ({ item }) => (
      <CodeLine
        extension={extension}
        fontSize={fontSize}
        gutter={gutter}
        index={item.index}
        line={item.line}
        lineHeight={lineHeight}
        palette={palette}
        searchQuery={searchQuery}
        showLines={showLines}
        wrap={wrap}
      />
    ),
    [extension, fontSize, gutter, lineHeight, palette, searchQuery, showLines, wrap]
  );

  if (virtualized) {
    return (
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={data}
        directionalLockEnabled
        initialNumToRender={32}
        keyExtractor={(item) => String(item.index)}
        maxToRenderPerBatch={40}
        nestedScrollEnabled
        removeClippedSubviews
        renderItem={renderItem}
        scrollEventThrottle={16}
        style={{
          flex: 1,
          height: '100%',
          width: wrap ? '100%' : contentWidth,
        }}
        windowSize={12}
      />
    );
  }

  return (
    <View style={{ gap: 0, padding: 16, width: wrap ? '100%' : undefined }}>
      {data.map((item) => (
        <CodeLine
          key={item.index}
          extension={extension}
          fontSize={fontSize}
          gutter={gutter}
          index={item.index}
          line={item.line}
          lineHeight={lineHeight}
          palette={palette}
          searchQuery={searchQuery}
          showLines={showLines}
          wrap={wrap}
        />
      ))}
    </View>
  );
});
