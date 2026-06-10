import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppLogo } from "@/components/app/app-logo";
import { AppHeader } from "@/components/app/shared";
import { Chip, Section, SettingRow } from "@/components/ui/primitives";
import {
  useAppPalette,
  useThemePreference,
  type ThemePreference,
} from "@/hooks/use-theme-preference";
import {
  APP_BUILD,
  APP_NAME,
  APP_VERSION,
  PRIVACY_POLICY_URL,
} from "@/lib/app-info";
import * as WebBrowser from "expo-web-browser";
import { hasGitHubToken, setGitHubToken } from "@/lib/github";
import { spacing, type AccentColor } from "@/lib/palette";

// ─── Theme / accent options ────────────────────────────────────────────────────

const themes: { label: string; value: ThemePreference }[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

const accentOptions: { color: string; label: string; value: AccentColor }[] = [
  { label: "Green", value: "green", color: "#22C55E" },
  { label: "Blue", value: "blue", color: "#3B82F6" },
  { label: "Purple", value: "purple", color: "#A855F7" },
  { label: "Amber", value: "amber", color: "#F59E0B" },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionDivider({
  palette,
}: {
  palette: ReturnType<typeof useAppPalette>;
}) {
  return (
    <View
      style={{
        borderTopColor: palette.border,
        borderTopWidth: 1,
        marginHorizontal: spacing.md,
      }}
    />
  );
}

function InfoCallout({
  icon,
  palette,
  text,
  title,
  variant = "default",
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  palette: ReturnType<typeof useAppPalette>;
  text: string;
  title: string;
  variant?: "default" | "warning";
}) {
  const color = variant === "warning" ? "#F59E0B" : palette.accent;
  const bg = variant === "warning" ? "#F59E0B14" : `${palette.accent}10`;
  const border = variant === "warning" ? "#F59E0B40" : `${palette.accent}30`;

  return (
    <View
      style={{
        backgroundColor: bg,
        borderColor: border,
        borderRadius: 9,
        borderWidth: 1,
        gap: 5,
        margin: spacing.sm,
        padding: 12,
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
        <MaterialIcons color={color} name={icon} size={15} />
        <Text
          style={{ color, fontSize: 12, fontWeight: "700", letterSpacing: 0.1 }}
        >
          {title}
        </Text>
      </View>
      <Text
        style={{
          color: palette.muted,
          fontSize: 12,
          lineHeight: 18,
          paddingLeft: 22,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function TokenField({
  palette,
}: {
  palette: ReturnType<typeof useAppPalette>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(hasGitHubToken());
  const [masked, setMasked] = useState(true);

  function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) return;
    setGitHubToken(trimmed);
    setSaved(true);
    setEditing(false);
    setValue("");
  }

  function handleRemove() {
    Alert.alert(
      "Remove token",
      "This will remove the saved GitHub token. Requests will fall back to the unauthenticated limit (10/min).",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setGitHubToken(null);
            setSaved(false);
            setEditing(false);
            setValue("");
          },
        },
      ],
    );
  }

  if (!editing && saved) {
    return (
      <View style={{ gap: 8, padding: spacing.md }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: "#22C55E18",
              borderRadius: 20,
              height: 28,
              justifyContent: "center",
              width: 28,
            }}
          >
            <MaterialIcons color="#22C55E" name="check-circle" size={16} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}
            >
              Token saved
            </Text>
            <Text style={{ color: palette.muted, fontSize: 11 }}>
              5,000 requests/hr · Authenticated
            </Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={() => setEditing(true)}
            style={{
              borderColor: palette.border,
              borderRadius: 7,
              borderWidth: 1,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text
              style={{ color: palette.muted, fontSize: 12, fontWeight: "600" }}
            >
              Replace
            </Text>
          </Pressable>
          <Pressable hitSlop={8} onPress={handleRemove}>
            <MaterialIcons
              color={palette.danger}
              name="delete-outline"
              size={18}
            />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 8, padding: spacing.md }}>
      {!saved ? (
        <Text style={{ color: palette.muted, fontSize: 12, lineHeight: 17 }}>
          A{" "}
          <Text
            style={{ color: palette.accent, textDecorationLine: "underline" }}
            onPress={() =>
              router.push(
                "https://github.com/settings/tokens/new?scopes=public_repo&description=KodeView",
              )
            }
          >
            Personal Access Token
          </Text>{" "}
          (no scopes needed for public repos) raises the search limit from
          10/min to 5,000/hr.
        </Text>
      ) : null}

      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.background,
          borderColor: value.length > 0 ? palette.accent : palette.border,
          borderRadius: 9,
          borderWidth: 1,
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: 10,
        }}
      >
        <MaterialIcons color={palette.muted} name="vpn-key" size={15} />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setValue}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          placeholderTextColor={palette.muted}
          secureTextEntry={masked}
          style={{
            color: palette.text,
            flex: 1,
            fontSize: 13,
            fontFamily: "monospace",
            minHeight: 42,
          }}
          value={value}
        />
        <Pressable hitSlop={8} onPress={() => setMasked((m) => !m)}>
          <MaterialIcons
            color={palette.muted}
            name={masked ? "visibility-off" : "visibility"}
            size={16}
          />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          disabled={!value.trim()}
          onPress={handleSave}
          style={{
            alignItems: "center",
            backgroundColor: value.trim() ? palette.accent : palette.border,
            borderRadius: 8,
            flex: 1,
            paddingVertical: 9,
          }}
        >
          <Text
            style={{
              color: value.trim() ? "#fff" : palette.muted,
              fontSize: 13,
              fontWeight: "700",
            }}
          >
            Save token
          </Text>
        </Pressable>
        {editing || saved ? (
          <Pressable
            onPress={() => {
              setEditing(false);
              setValue("");
            }}
            style={{
              alignItems: "center",
              borderColor: palette.border,
              borderRadius: 8,
              borderWidth: 1,
              paddingHorizontal: 16,
              paddingVertical: 9,
            }}
          >
            <Text
              style={{ color: palette.muted, fontSize: 13, fontWeight: "600" }}
            >
              Cancel
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function FontSizeStepper({
  max,
  min,
  onChange,
  palette,
  value,
}: {
  max: number;
  min: number;
  onChange: (v: number) => void;
  palette: ReturnType<typeof useAppPalette>;
  value: number;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        borderColor: palette.border,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: "row",
        overflow: "hidden",
      }}
    >
      <Pressable
        disabled={value <= min}
        hitSlop={4}
        onPress={() => onChange(Math.max(min, value - 1))}
        style={({ pressed }) => ({
          backgroundColor: pressed ? palette.secondary : "transparent",
          paddingHorizontal: 12,
          paddingVertical: 6,
        })}
      >
        <Text
          style={{
            color: value <= min ? palette.muted : palette.accent,
            fontSize: 17,
            fontWeight: "700",
            lineHeight: 20,
          }}
        >
          −
        </Text>
      </Pressable>
      <View
        style={{
          borderLeftColor: palette.border,
          borderLeftWidth: 1,
          borderRightColor: palette.border,
          borderRightWidth: 1,
          minWidth: 32,
          paddingVertical: 6,
        }}
      >
        <Text
          style={{
            color: palette.text,
            fontSize: 14,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {value}
        </Text>
      </View>
      <Pressable
        disabled={value >= max}
        hitSlop={4}
        onPress={() => onChange(Math.min(max, value + 1))}
        style={({ pressed }) => ({
          backgroundColor: pressed ? palette.secondary : "transparent",
          paddingHorizontal: 12,
          paddingVertical: 6,
        })}
      >
        <Text
          style={{
            color: value >= max ? palette.muted : palette.accent,
            fontSize: 17,
            fontWeight: "700",
            lineHeight: 20,
          }}
        >
          +
        </Text>
      </Pressable>
    </View>
  );
}

function AccentSwatch({
  color,
  label,
  onPress,
  palette,
  selected,
}: {
  color: string;
  label: string;
  onPress: () => void;
  palette: ReturnType<typeof useAppPalette>;
  selected: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        borderColor: selected ? color : palette.border,
        borderRadius: 10,
        borderWidth: selected ? 2 : 1,
        gap: 6,
        opacity: pressed ? 0.75 : 1,
        padding: 10,
        flex: 1,
      })}
    >
      <View
        style={{
          backgroundColor: color,
          borderRadius: 14,
          height: 28,
          width: 28,
          ...(selected
            ? {
                shadowColor: color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 6,
              }
            : {}),
        }}
      />
      <Text
        style={{
          color: selected ? palette.text : palette.muted,
          fontSize: 11,
          fontWeight: selected ? "700" : "400",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const palette = useAppPalette();
  const { appPreferences, preference, setAppPreference, setPreference } =
    useThemePreference();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={{
        gap: 20,
        minHeight: "100%",
        padding: 16,
        paddingBottom: 40,
      }}
    >
      <AppHeader
        palette={palette}
        subtitle="Appearance, API access, and reader defaults."
        title="Settings"
      />

      {/* ── GitHub API ────────────────────────────────────────────────────── */}
      <Section palette={palette} title="GitHub API">
        <InfoCallout
          icon="info-outline"
          palette={palette}
          title="Rate limits"
          text="Unauthenticated searches are capped at 10 requests/min. A Personal Access Token raises this to 5,000/hr and makes Discover much more reliable."
          variant="warning"
        />
        <SectionDivider palette={palette} />
        <TokenField palette={palette} />
      </Section>

      {/* ── Downloads ─────────────────────────────────────────────────────── */}
      <Section palette={palette} title="Downloads & sync">
        <InfoCallout
          icon="cloud-download"
          palette={palette}
          title="Large repositories"
          text="Cloning downloads a ZIP from GitHub and extracts every file on-device. Large repos can take several minutes on slow connections. Keep the app open until the progress bar completes."
        />
        <SectionDivider palette={palette} />
        <SettingRow
          detail="Re-download repositories older than 24 hours at most once every 6 hours."
          icon="sync"
          label="Auto-sync"
          last
          palette={palette}
        >
          <Switch
            onValueChange={(v) => setAppPreference("autoSync", v)}
            trackColor={{ false: palette.secondary, true: palette.accent }}
            value={appPreferences.autoSync}
          />
        </SettingRow>
      </Section>

      {/* ── Appearance ────────────────────────────────────────────────────── */}
      <Section palette={palette} title="Appearance">
        {/* Theme picker */}
        <View
          style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.md }}
        >
          {themes.map((theme) => (
            <Chip
              key={theme.value}
              onPress={() => setPreference(theme.value)}
              palette={palette}
              selected={preference === theme.value}
            >
              {theme.label}
            </Chip>
          ))}
        </View>

        <SectionDivider palette={palette} />

        {/* Accent swatches */}
        <View style={{ gap: 8, padding: spacing.md }}>
          <Text
            style={{
              color: palette.muted,
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            Accent colour
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {accentOptions.map((opt) => (
              <AccentSwatch
                color={opt.color}
                key={opt.value}
                label={opt.label}
                onPress={() => setAppPreference("accentColor", opt.value)}
                palette={palette}
                selected={appPreferences.accentColor === opt.value}
              />
            ))}
          </View>
        </View>
      </Section>

      {/* ── Code display ──────────────────────────────────────────────────── */}
      <Section palette={palette} title="Code display">
        <SettingRow
          detail="Wrap long lines instead of scrolling horizontally."
          icon="wrap-text"
          label="Wrap lines"
          palette={palette}
        >
          <Switch
            onValueChange={(v) => setAppPreference("wrapCodeByDefault", v)}
            trackColor={{ false: palette.secondary, true: palette.accent }}
            value={appPreferences.wrapCodeByDefault}
          />
        </SettingRow>
        <SettingRow
          detail="Show gutter line numbers in code files."
          icon="format-list-numbered"
          label="Line numbers"
          palette={palette}
        >
          <Switch
            onValueChange={(v) => setAppPreference("showLineNumbers", v)}
            trackColor={{ false: palette.secondary, true: palette.accent }}
            value={appPreferences.showLineNumbers}
          />
        </SettingRow>
        <SettingRow
          detail="Starting font size for the code reader (11–18pt)."
          icon="text-fields"
          label="Default font size"
          last
          palette={palette}
        >
          <FontSizeStepper
            max={18}
            min={11}
            onChange={(v) => setAppPreference("defaultCodeFontSize", v)}
            palette={palette}
            value={appPreferences.defaultCodeFontSize}
          />
        </SettingRow>
      </Section>

      {/* ── File explorer ─────────────────────────────────────────────────── */}
      <Section palette={palette} title="File explorer">
        <SettingRow
          detail="Use tighter rows in the repository file tree."
          icon="density-small"
          label="Compact tree"
          palette={palette}
        >
          <Switch
            onValueChange={(v) => setAppPreference("compactExplorer", v)}
            trackColor={{ false: palette.secondary, true: palette.accent }}
            value={appPreferences.compactExplorer}
          />
        </SettingRow>
        <SettingRow
          detail="Show file sizes next to each file in the tree."
          icon="storage"
          label="File sizes"
          last
          palette={palette}
        >
          <Switch
            onValueChange={(v) => setAppPreference("showFileSizes", v)}
            trackColor={{ false: palette.secondary, true: palette.accent }}
            value={appPreferences.showFileSizes}
          />
        </SettingRow>
      </Section>

      {/* ── Reader ────────────────────────────────────────────────────────── */}
      <Section palette={palette} title="Reader">
        <SettingRow
          detail="Open README and docs in rendered preview by default."
          icon="article"
          label="Markdown preview default"
          palette={palette}
        >
          <Switch
            onValueChange={(v) => setAppPreference("markdownPreviewDefault", v)}
            trackColor={{ false: palette.secondary, true: palette.accent }}
            value={appPreferences.markdownPreviewDefault}
          />
        </SettingRow>
        <SettingRow
          detail="Jump straight to README when opening a repository."
          icon="auto-stories"
          label="Auto-open README"
          last
          palette={palette}
        >
          <Switch
            onValueChange={(v) => setAppPreference("autoOpenReadme", v)}
            trackColor={{ false: palette.secondary, true: palette.accent }}
            value={appPreferences.autoOpenReadme}
          />
        </SettingRow>
      </Section>

      {/* ── About ─────────────────────────────────────────────────────────── */}
      <Section palette={palette} title={`About ${APP_NAME}`}>
        <View
          style={{
            alignItems: "center",
            gap: spacing.md,
            padding: spacing.lg,
          }}
        >
          <AppLogo size={64} />
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text
              style={{
                color: palette.text,
                fontSize: 20,
                fontWeight: "900",
                letterSpacing: -0.5,
              }}
            >
              {APP_NAME}
            </Text>
            <Text
              style={{
                backgroundColor: palette.border,
                borderRadius: 6,
                color: palette.muted,
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 0.5,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              v{APP_VERSION} ({APP_BUILD})
            </Text>
          </View>
          <Text
            style={{
              color: palette.muted,
              fontSize: 12,
              lineHeight: 19,
              textAlign: "center",
            }}
          >
            Offline code viewer for public GitHub repositories. Clone, browse,
            and read source files with syntax highlighting and Markdown preview.
          </Text>
          <Text
            style={{
              color: palette.muted,
              fontSize: 11,
              lineHeight: 16,
              textAlign: "center",
            }}
          >
            Not affiliated with GitHub, Inc.
          </Text>
          <Pressable
            onPress={() =>
              WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL).catch(
                () => undefined,
              )
            }
            style={({ pressed }) => ({
              borderColor: palette.border,
              borderRadius: 8,
              borderWidth: 1,
              opacity: pressed ? 0.7 : 1,
              paddingHorizontal: 16,
              paddingVertical: 10,
            })}
          >
            <Text
              style={{
                color: palette.accent,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              Privacy Policy
            </Text>
          </Pressable>
        </View>
      </Section>
    </ScrollView>
  );
}
