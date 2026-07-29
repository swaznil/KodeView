import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppPalette } from "@/hooks/use-theme-preference";
import { spacing, type Palette } from "@/lib/palette";
import type { SavedRepository } from "@/lib/repository-storage";

const USE_NATIVE_DRIVER = process.env.EXPO_OS !== "web";

type MenuAction = {
  destructive?: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  description?: string;
  onPress: () => void;
};

// ─── Single action row ─────────────────────────────────────────────────────────

function ActionRow({
  action,
  index,
  last,
  palette,
  slideAnim,
}: {
  action: MenuAction;
  index: number;
  last: boolean;
  palette: ReturnType<typeof useAppPalette>;
  slideAnim: Animated.Value;
}) {
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12 + index * 4, 0],
  });
  const opacity = slideAnim.interpolate({
    inputRange: [0, 0.4 + index * 0.08, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable
        onPress={action.onPress}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: pressed
            ? action.destructive
              ? `${palette.danger}14`
              : palette.secondary
            : "transparent",
          borderBottomColor: last ? "transparent" : palette.border,
          borderBottomWidth: last ? 0 : 1,
          flexDirection: "row",
          gap: 12,
          minHeight: 52,
          paddingHorizontal: spacing.md,
          paddingVertical: 2,
        })}
      >
        {/* Icon container */}
        <View
          style={{
            alignItems: "center",
            backgroundColor: action.destructive
              ? `${palette.danger}14`
              : `${palette.accent}14`,
            borderRadius: 8,
            height: 32,
            justifyContent: "center",
            width: 32,
          }}
        >
          <MaterialIcons
            color={action.destructive ? palette.danger : palette.accent}
            name={action.icon}
            size={18}
          />
        </View>

        {/* Label + description */}
        <View style={{ flex: 1, gap: 1 }}>
          <Text
            style={{
              color: action.destructive ? palette.danger : palette.text,
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            {action.label}
          </Text>
          {action.description ? (
            <Text style={{ color: palette.muted, fontSize: 11 }}>
              {action.description}
            </Text>
          ) : null}
        </View>

        {!action.destructive ? (
          <MaterialIcons color={palette.muted} name="chevron-right" size={18} />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function RepositoryMenu({
  onClose,
  palette: paletteProp,
  repository,
  visible,
  pinned,
  onPin,
  onSync,
  onDelete,
}: {
  onClose: () => void;
  palette?: Palette;
  repository: SavedRepository | null;
  visible: boolean;
  pinned: boolean;
  onPin: () => void;
  onSync: () => void;
  onDelete: () => void;
}) {
  const fallbackPalette = useAppPalette();
  const palette = paletteProp ?? fallbackPalette;
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset for entry
      slideAnim.setValue(0);
      sheetAnim.setValue(0);
      backdropAnim.setValue(0);

      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.spring(sheetAnim, {
          toValue: 1,
          damping: 22,
          stiffness: 280,
          mass: 0.9,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }
  }, [visible, backdropAnim, sheetAnim, slideAnim]);

  function handleClose() {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(sheetAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => onClose());
  }

  if (!repository) return null;

  const sheetTranslate = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  const actions: MenuAction[] = [
    {
      icon: pinned ? "push-pin" : "bookmark-border",
      label: pinned ? "Unpin repository" : "Pin repository",
      description: pinned ? "Remove from pinned" : "Keep at top of your list",
      onPress: () => {
        // Pin immediately without closing, so user sees the result
        onPin();
        handleClose();
      },
    },
    {
      icon: "sync",
      label: "Sync repository",
      description: "Re-download the latest files from GitHub",
      onPress: () => {
        handleClose();
        // Slight delay so sheet has time to dismiss
        setTimeout(onSync, 240);
      },
    },
    {
      icon: "history",
      label: "Commit history",
      description: "Browse recent commits",
      onPress: () => {
        handleClose();
        setTimeout(
          () =>
            router.push({
              pathname: "/repository/commits",
              params: { id: repository.id },
            }),
          240,
        );
      },
    },
    {
      icon: "call-split",
      label: "Branches",
      description: "View repository branches",
      onPress: () => {
        handleClose();
        setTimeout(
          () =>
            router.push({
              pathname: "/repository/branches",
              params: { id: repository.id },
            }),
          240,
        );
      },
    },
    {
      icon: "open-in-new",
      label: "Open on GitHub",
      description: "View the repository in your browser",
      onPress: () => {
        handleClose();
        setTimeout(
          () => WebBrowser.openBrowserAsync(repository.htmlUrl).catch(() => undefined),
          240,
        );
      },
    },
    {
      icon: "link",
      label: "Copy GitHub URL",
      description: "Copy a shareable repository link",
      onPress: () => {
        Clipboard.setStringAsync(repository.htmlUrl)
          .then(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
          .catch(() => undefined);
        handleClose();
      },
    },
    {
      destructive: true,
      icon: "delete-outline",
      label: "Delete repository",
      onPress: () => {
        handleClose();
        setTimeout(onDelete, 240);
      },
    },
  ];

  return (
    <Modal
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        {/* Backdrop */}
        <Animated.View
          style={{
            ...StyleSheet_absoluteFill,
            backgroundColor: "rgba(0,0,0,0.5)",
            opacity: backdropAnim,
          }}
        >
          <Pressable onPress={handleClose} style={{ flex: 1 }} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={{
            transform: [{ translateY: sheetTranslate }],
          }}
        >
          <View
            style={{
              backgroundColor: palette.fill,
              borderColor: palette.border,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              borderWidth: 1,
              marginHorizontal: 0,
              marginBottom: 0,
              overflow: "hidden",
              paddingBottom: Math.max(8, insets.bottom),
            }}
          >
            {/* Drag handle */}
            <View
              style={{
                alignItems: "center",
                paddingTop: 10,
                paddingBottom: 4,
              }}
            >
              <View
                style={{
                  backgroundColor: palette.border,
                  borderRadius: 3,
                  height: 4,
                  width: 36,
                }}
              />
            </View>

            {/* Header */}
            <View
              style={{
                borderBottomColor: palette.border,
                borderBottomWidth: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: spacing.md,
                paddingVertical: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: palette.text,
                    fontSize: 15,
                    fontWeight: "800",
                    letterSpacing: -0.3,
                  }}
                >
                  {repository.fullName}
                </Text>
                <Text
                  style={{ color: palette.muted, fontSize: 11, marginTop: 1 }}
                >
                  {pinned ? "📌 Pinned" : "Repository actions"}
                </Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={handleClose}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: pressed ? palette.secondary : palette.border,
                  borderRadius: 14,
                  height: 28,
                  justifyContent: "center",
                  width: 28,
                })}
              >
                <MaterialIcons color={palette.muted} name="close" size={16} />
              </Pressable>
            </View>

            {/* Actions */}
            <View style={{ paddingTop: 4, paddingBottom: 4 }}>
              {actions.map((action, index) => (
                <ActionRow
                  action={action}
                  index={index}
                  key={action.label}
                  last={index === actions.length - 1}
                  palette={palette}
                  slideAnim={slideAnim}
                />
              ))}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// Inline StyleSheet.absoluteFill equivalent to avoid import
const StyleSheet_absoluteFill = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
