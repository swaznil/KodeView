import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { InlineError, ProgressBar } from "@/components/app/shared";
import { parseGitHubRepository, resolveGitHubRepository } from "@/lib/github";
import { spacing, type Palette } from "@/lib/palette";
import {
  importRepository,
  formatBytes,
  type ImportProgress,
} from "@/lib/repository-storage";

type CloneModalProps = {
  onClose: () => void;
  onCloned: (repositoryId: string) => void;
  palette: Palette;
  visible: boolean;
};

export function CloneModal({
  onClose,
  onCloned,
  palette,
  visible,
}: CloneModalProps) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setInput("");
      setBusy(false);
      setProgress(null);
      setError(null);
    }
  }, [visible]);

  async function cloneRepository(value = input) {
    if (!parseGitHubRepository(value)) {
      setError("Enter a valid public GitHub URL or owner/repo.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      return;
    }

    setBusy(true);
    setError(null);
    setProgress(null);

    try {
      const details = await resolveGitHubRepository(value);
      const saved = await importRepository(details, setProgress);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      onClose();
      onCloned(saved.id);
    } catch (caught) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not download this repository.",
      );
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Pressable
          accessibilityLabel="Dismiss"
          onPress={onClose}
          style={{ backgroundColor: "rgba(0,0,0,0.45)", flex: 1 }}
        />
        <View
          style={{
            backgroundColor: palette.background,
            borderColor: palette.border,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderWidth: 1,
            gap: spacing.md,
            maxHeight: "88%",
            paddingBottom: Math.max(16, insets.bottom),
            paddingHorizontal: 16,
            paddingTop: 16,
          }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Text
              style={{
                color: palette.text,
                flex: 1,
                fontSize: 18,
                fontWeight: "800",
              }}
            >
              Clone repository
            </Text>
            <Pressable
              accessibilityLabel="Close"
              onPress={onClose}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: pressed ? palette.secondary : palette.fill,
                borderColor: palette.border,
                borderRadius: 8,
                borderWidth: 1,
                height: 36,
                justifyContent: "center",
                width: 36,
              })}
            >
              <MaterialIcons color={palette.text} name="close" size={20} />
            </Pressable>
          </View>

          <View
            style={{
              backgroundColor: `${palette.accent}12`,
              borderColor: `${palette.accent}44`,
              borderRadius: 8,
              borderWidth: 1,
              gap: 6,
              padding: 12,
            }}
          >
            <Text
              style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}
            >
              Downloads can take a while
            </Text>
            <Text
              style={{ color: palette.muted, fontSize: 12, lineHeight: 18 }}
            >
              Large repositories may need several minutes on slow networks. Keep
              the app open until extraction finishes.
            </Text>
          </View>

          <Text style={{ color: palette.muted, fontSize: 13, lineHeight: 19 }}>
            Enter a public GitHub URL or owner/repo name. Only public
            repositories are supported.
          </Text>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={visible}
              editable={!busy}
              onChangeText={setInput}
              onSubmitEditing={() => cloneRepository()}
              placeholder="github.com/owner/repo"
              placeholderTextColor={palette.muted}
              returnKeyType="go"
              style={{
                backgroundColor: palette.fill,
                borderColor: palette.border,
                borderRadius: 8,
                borderWidth: 1,
                color: palette.text,
                flex: 1,
                fontFamily: "monospace",
                fontSize: 14,
                minHeight: 46,
                paddingHorizontal: 12,
              }}
              value={input}
            />
            <Pressable
              accessibilityLabel="Paste repository URL"
              disabled={busy}
              onPress={async () => {
                const value = await Clipboard.getStringAsync();
                if (value.trim()) {
                  setInput(value.trim());
                  setError(null);
                  Haptics.selectionAsync().catch(() => undefined);
                }
              }}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: pressed ? palette.secondary : palette.fill,
                borderColor: palette.border,
                borderCurve: "continuous",
                borderRadius: 8,
                borderWidth: 1,
                justifyContent: "center",
                minHeight: 46,
                width: 46,
              })}
            >
              <MaterialIcons color={palette.text} name="content-paste" size={20} />
            </Pressable>
            <Pressable
              accessibilityLabel="Download repository"
              disabled={busy || !input.trim()}
              onPress={() => cloneRepository()}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: busy || !input.trim() ? palette.secondary : palette.primary,
                borderRadius: 8,
                justifyContent: "center",
                minHeight: 46,
                opacity: pressed ? 0.85 : 1,
                width: 52,
              })}
            >
              {busy ? (
                <ActivityIndicator color={palette.muted} />
              ) : (
                <MaterialIcons color="#ffffff" name="download" size={22} />
              )}
            </Pressable>
          </View>

          {progress ? (
            <View style={{ gap: 8 }}>
              <View
                style={{ alignItems: "center", flexDirection: "row", gap: 8 }}
              >
                <MaterialIcons color={palette.success} name="sync" size={18} />
                <Text
                  style={{
                    color: palette.text,
                    flex: 1,
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  {progress.message}
                </Text>
                <Text style={{ color: palette.muted, fontSize: 12 }}>
                  {progress.downloadedBytes
                    ? `${formatBytes(progress.downloadedBytes)} · `
                    : ""}
                  {Math.round(progress.progress * 100)}%
                </Text>
              </View>
              <ProgressBar palette={palette} progress={progress.progress} />
            </View>
          ) : null}

          {error ? <InlineError message={error} palette={palette} /> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
