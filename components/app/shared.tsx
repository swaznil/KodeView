import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { memo, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native';

import { AppLogo } from '@/components/app/app-logo';
import { radius, spacing, type Palette } from '@/lib/palette';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

export const Pill = memo(function Pill({
  children,
  icon,
  palette,
  selected,
}: {
  children: string;
  icon?: IconName;
  palette: Palette;
  selected?: boolean;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: selected ? palette.accent : palette.secondary,
        borderColor: selected ? palette.accent : palette.border,
        borderRadius: radius.pill,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 5,
        minHeight: 28,
        paddingHorizontal: 10,
      }}>
      {icon ? <MaterialIcons color={selected ? '#ffffff' : palette.muted} name={icon} size={14} /> : null}
      <Text style={{ color: selected ? '#ffffff' : palette.text, fontSize: 12, fontWeight: '700' }}>
        {children}
      </Text>
    </View>
  );
});

export const ProgressBar = memo(function ProgressBar({
  palette,
  progress,
}: {
  palette: Palette;
  progress: number;
}) {
  return (
    <View
      style={{
        backgroundColor: palette.secondary,
        borderColor: palette.border,
        borderRadius: radius.pill,
        borderWidth: 1,
        height: 8,
        overflow: 'hidden',
      }}>
      <View
        style={{
          backgroundColor: palette.success,
          height: '100%',
          width: `${Math.max(4, Math.min(100, progress * 100))}%`,
        }}
      />
    </View>
  );
});

export function AppHeader({
  palette,
  subtitle,
  title,
  trailing,
}: {
  palette: Palette;
  subtitle: string;
  title: string;
  trailing?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const useCompactActions = Boolean(trailing) && width < 500;

  return (
    <View style={{ gap: useCompactActions ? spacing.md : 0 }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
        <AppLogo size={38} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: palette.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.3 }}>
            {title}
          </Text>
          <Text style={{ color: palette.muted, fontSize: 13 }}>{subtitle}</Text>
        </View>
        {useCompactActions ? null : trailing}
      </View>
      {useCompactActions ? (
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'flex-end' }}>
          {trailing}
        </View>
      ) : null}
    </View>
  );
}

export function Panel({
  children,
  palette,
  style,
}: {
  children: ReactNode;
  palette: Palette;
  style?: object;
}) {
  return (
    <View
      style={{
        backgroundColor: palette.fill,
        borderColor: palette.border,
        borderRadius: radius.sm,
        borderCurve: 'continuous',
        borderWidth: 1,
        gap: spacing.md,
        padding: spacing.md,
        ...style,
      }}>
      {children}
    </View>
  );
}

export function HeaderIconButton({
  icon,
  label,
  onPress,
  palette,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  palette: Palette;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? palette.secondary : palette.fill,
        borderColor: palette.border,
        borderRadius: radius.sm,
        borderCurve: 'continuous',
        borderWidth: 1,
        height: 44,
        justifyContent: 'center',
        width: 44,
      })}>
      <MaterialIcons color={palette.text} name={icon} size={20} />
    </Pressable>
  );
}

export function InlineError({
  actionLabel,
  message,
  onAction,
  palette,
}: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  palette: Palette;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        alignItems: 'center',
        backgroundColor: `${palette.danger}14`,
        borderColor: `${palette.danger}55`,
        borderRadius: radius.sm,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.sm,
        padding: spacing.md,
      }}>
      <MaterialIcons color={palette.danger} name="error-outline" size={18} />
      <Text selectable style={{ color: palette.danger, flex: 1, fontSize: 13, fontWeight: '700' }}>
        {message}
      </Text>
      {onAction && actionLabel ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => ({
            backgroundColor: pressed ? `${palette.danger}22` : 'transparent',
            borderColor: `${palette.danger}66`,
            borderRadius: radius.sm,
            borderWidth: 1,
            paddingHorizontal: 10,
            paddingVertical: 7,
          })}>
          <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '800' }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function LoadingState({
  detail,
  palette,
  title = 'Loading',
}: {
  detail?: string;
  palette: Palette;
  title?: string;
}) {
  return (
    <View
      accessibilityLabel={`${title}${detail ? `. ${detail}` : ''}`}
      accessibilityRole="progressbar"
      style={{
        alignItems: 'center',
        flex: 1,
        gap: spacing.md,
        justifyContent: 'center',
        minHeight: 220,
        padding: spacing.xxl,
      }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: palette.accentSoft,
          borderColor: `${palette.accent}44`,
          borderCurve: 'continuous',
          borderRadius: radius.lg,
          borderWidth: 1,
          height: 56,
          justifyContent: 'center',
          width: 56,
        }}>
        <ActivityIndicator color={palette.accent} />
      </View>
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Text style={{ color: palette.text, fontSize: 15, fontWeight: '800' }}>{title}</Text>
        {detail ? (
          <Text style={{ color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
