import { Linking, ScrollView, Text, View } from 'react-native';

import { CodeBlock } from '@/components/reader/code-block';
import { parseInline, parseMarkdown } from '@/lib/markdown';
import { type Palette } from '@/lib/palette';

type MarkdownViewProps = {
  baseUrl?: string;
  content: string;
  fontSize: number;
  palette: Palette;
  searchQuery?: string;
  showCodeLines: boolean;
  wrapCode: boolean;
};

function InlineText({
  baseUrl,
  fontSize,
  palette,
  text,
}: {
  baseUrl?: string;
  fontSize: number;
  palette: Palette;
  text: string;
}) {
  const segments = parseInline(text);

  return (
    <Text selectable style={{ color: palette.text, fontSize, lineHeight: fontSize + 9 }}>
      {segments.map((segment, index) => {
        if (segment.link) {
          return (
            <Text
              accessibilityRole="link"
              key={index}
              onPress={() => {
                try {
                  const href = baseUrl ? new URL(segment.link!, baseUrl).toString() : segment.link!;
                  Linking.openURL(href).catch(() => undefined);
                } catch {
                  // Ignore malformed links in repository documentation.
                }
              }}
              style={{ color: palette.accent, fontWeight: '700', textDecorationLine: 'underline' }}>
              {segment.text}
            </Text>
          );
        }

        if (segment.code) {
          return (
            <Text
              key={index}
              style={{
                backgroundColor: palette.secondary,
                borderRadius: 4,
                color: palette.accent,
                fontFamily: 'monospace',
                fontSize: fontSize - 1,
              }}>
              {segment.text}
            </Text>
          );
        }

        return (
          <Text
            key={index}
            style={{
              color: palette.text,
              fontStyle: segment.italic ? 'italic' : 'normal',
              fontWeight: segment.bold ? '800' : '400',
            }}>
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}

export function MarkdownView({
  baseUrl,
  content,
  fontSize,
  palette,
  searchQuery,
  showCodeLines,
  wrapCode,
}: MarkdownViewProps) {
  const blocks = parseMarkdown(content);

  return (
    <View style={{ gap: 10, paddingHorizontal: 18, paddingVertical: 16 }}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <Text
                key={index}
                style={{
                  color: palette.text,
                  fontSize: Math.max(fontSize + 14 - block.level * 2, fontSize + 2),
                  fontWeight: '900',
                  lineHeight: fontSize + 18,
                  marginTop: index === 0 ? 0 : 6,
                }}>
                {block.text}
              </Text>
            );
          case 'paragraph':
            return <InlineText baseUrl={baseUrl} key={index} fontSize={fontSize} palette={palette} text={block.text} />;
          case 'list':
            return (
              <View key={index} style={{ gap: 6, paddingLeft: 4 }}>
                {block.items.map((item, itemIndex) => (
                  <View key={itemIndex} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ color: palette.accent, fontSize, fontWeight: '900', lineHeight: fontSize + 9, width: 18 }}>
                      {block.ordered ? `${itemIndex + 1}.` : '•'}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <InlineText baseUrl={baseUrl} fontSize={fontSize} palette={palette} text={item} />
                    </View>
                  </View>
                ))}
              </View>
            );
          case 'quote':
            return (
              <View
                key={index}
                style={{
                  backgroundColor: palette.secondary,
                  borderLeftColor: palette.accent,
                  borderLeftWidth: 3,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}>
                <InlineText baseUrl={baseUrl} fontSize={fontSize} palette={palette} text={block.text} />
              </View>
            );
          case 'code':
            return (
              <View
                key={index}
                style={{
                  backgroundColor: palette.fill,
                  borderColor: palette.border,
                  borderRadius: 10,
                  borderWidth: 1,
                  overflow: 'hidden',
                }}>
                {block.language ? (
                  <Text
                    style={{
                      borderBottomColor: palette.border,
                      borderBottomWidth: 1,
                      color: palette.muted,
                      fontFamily: 'monospace',
                      fontSize: 11,
                      fontWeight: '700',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}>
                    {block.language}
                  </Text>
                ) : null}
                <CodeBlock
                  content={block.lines.join('\n')}
                  extension={block.language}
                  fontSize={fontSize - 1}
                  palette={palette}
                  searchQuery={searchQuery}
                  showLines={showCodeLines}
                  wrap={wrapCode}
                />
              </View>
            );
          case 'rule':
            return <View key={index} style={{ backgroundColor: palette.border, height: 1, marginVertical: 4 }} />;
          case 'spacer':
            return <View key={index} style={{ height: 4 }} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

export function ReaderBody({
  content,
  extension,
  fontSize,
  markdownBaseUrl,
  markdownPreview,
  palette,
  searchQuery,
  showCodeLines,
  wrap,
}: {
  content: string;
  extension: string | null;
  fontSize: number;
  markdownBaseUrl?: string;
  markdownPreview: boolean;
  palette: Palette;
  searchQuery?: string;
  showCodeLines: boolean;
  wrap: boolean;
}) {
  const markdown = extension === 'md' || extension === 'mdx' || extension === 'markdown';

  if (markdown && markdownPreview) {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} style={{ flex: 1 }}>
        <MarkdownView
          baseUrl={markdownBaseUrl}
          content={content}
          fontSize={fontSize + 1}
          palette={palette}
          searchQuery={searchQuery}
          showCodeLines={showCodeLines}
          wrapCode={wrap}
        />
      </ScrollView>
    );
  }

  const code = (
    <CodeBlock
      content={content}
      extension={extension}
      fontSize={fontSize}
      palette={palette}
      searchQuery={searchQuery}
      showLines={showCodeLines}
      virtualized
      wrap={wrap}
    />
  );

  if (wrap) {
    return <View style={{ flex: 1 }}>{code}</View>;
  }

  return (
    <ScrollView
      directionalLockEnabled
      horizontal
      contentContainerStyle={{ flexGrow: 1 }}
      style={{ flex: 1 }}>
      {code}
    </ScrollView>
  );
}
