import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppHeader, InlineError } from "@/components/app/shared";
import { OwnerAvatar } from "@/components/repository/owner-avatar";
import { useAppPalette } from "@/hooks/use-theme-preference";
import {
  GitHubRateLimitError,
  fetchTrendingRepositories,
  hasGitHubToken,
  resolveGitHubRepository,
  searchGitHubRepositories,
  type GitHubRepositorySearchResult,
  type RateLimitInfo,
} from "@/lib/github";
import { spacing } from "@/lib/palette";
import {
  formatBytes,
  importRepository,
  MAX_IMPORT_SIZE_BYTES,
  type ImportProgress,
} from "@/lib/repository-storage";

const USE_NATIVE_DRIVER = process.env.EXPO_OS !== "web";

// ─── Language colour map ───────────────────────────────────────────────────────

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#CE422B",
  Swift: "#FA7343",
  Kotlin: "#A97BFF",
  Java: "#B07219",
  "C++": "#F34B7D",
  C: "#555555",
  Ruby: "#CC342D",
  PHP: "#4F5D95",
  Dart: "#00B4AB",
  Shell: "#89E051",
  Vue: "#41B883",
  CSS: "#563D7C",
};

const SEARCH_DEBOUNCE_MS = 550;

function languageColor(lang: string | null): string {
  if (!lang) return "#8B949E";
  return LANGUAGE_COLORS[lang] ?? "#8B949E";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatResetCountdown(resetAt: Date): string {
  const secs = Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
  if (secs < 60) return `${secs}s`;
  return `${Math.ceil(secs / 60)}m`;
}

// ─── Rate limit banner ─────────────────────────────────────────────────────────

function RateLimitBanner({
  info,
  palette,
}: {
  info: RateLimitInfo;
  palette: ReturnType<typeof useAppPalette>;
}) {
  const [countdown, setCountdown] = useState(
    formatResetCountdown(info.resetAt),
  );
  const isAuthenticated = hasGitHubToken();

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown(formatResetCountdown(info.resetAt));
    }, 1000);
    return () => clearInterval(iv);
  }, [info.resetAt]);

  return (
    <View
      style={{
        backgroundColor: "#7C3AED18",
        borderColor: "#7C3AED60",
        borderRadius: 10,
        borderWidth: 1,
        gap: 6,
        padding: 12,
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialIcons color="#7C3AED" name="timer" size={16} />
        <Text style={{ color: "#7C3AED", fontSize: 13, fontWeight: "700" }}>
          GitHub rate limit reached — resets in {countdown}
        </Text>
      </View>
      {!isAuthenticated ? (
        <Text style={{ color: palette.muted, fontSize: 12, lineHeight: 17 }}>
          Unauthenticated requests are limited to 10/min. Add a GitHub Personal
          Access Token in{" "}
          <Text
            style={{ color: palette.accent, textDecorationLine: "underline" }}
            onPress={() => router.push("/settings")}
          >
            Settings
          </Text>{" "}
          to raise the limit to 5,000/hr.
        </Text>
      ) : (
        <Text style={{ color: palette.muted, fontSize: 12 }}>
          Authenticated search limit reached. Results will resume in {countdown}
          .
        </Text>
      )}
    </View>
  );
}

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard({
  palette,
  delay = 0,
}: {
  palette: ReturnType<typeof useAppPalette>;
  delay?: number;
}) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 850,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ).start();
  }, [shimmer, delay]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.7],
  });

  return (
    <Animated.View
      style={{
        backgroundColor: palette.fill,
        borderColor: palette.border,
        borderRadius: 12,
        borderWidth: 1,
        gap: 10,
        opacity,
        padding: 14,
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <View
          style={{
            backgroundColor: palette.border,
            borderRadius: 18,
            height: 36,
            width: 36,
          }}
        />
        <View style={{ flex: 1, gap: 7 }}>
          <View
            style={{
              backgroundColor: palette.border,
              borderRadius: 4,
              height: 13,
              width: "55%",
            }}
          />
          <View
            style={{
              backgroundColor: palette.border,
              borderRadius: 4,
              height: 10,
              width: "88%",
            }}
          />
          <View
            style={{
              backgroundColor: palette.border,
              borderRadius: 4,
              height: 10,
              width: "65%",
            }}
          />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 14, marginTop: 2 }}>
        {[38, 50, 44].map((w, i) => (
          <View
            key={i}
            style={{
              backgroundColor: palette.border,
              borderRadius: 4,
              height: 9,
              width: w,
            }}
          />
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Result card ───────────────────────────────────────────────────────────────

const ResultCard = memo(function ResultCard({
  cloning,
  index,
  onClone,
  repository,
  progress,
  sizeBytes,
  controller,
}: {
  cloning: string | null;
  index: number;
  onClone: (fullName: string) => void;
  repository: GitHubRepositorySearchResult;
  progress?: ImportProgress | null;
  sizeBytes?: number | null;
  controller?: never;
}) {
  const palette = useAppPalette();
  const busy = cloning === repository.fullName;
  const tooLarge = sizeBytes != null && sizeBytes > MAX_IMPORT_SIZE_BYTES;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 260,
        delay: Math.min(index * 35, 350),
        easing: Easing.out(Easing.ease),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        delay: Math.min(index * 35, 350),
        easing: Easing.out(Easing.ease),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  function handlePressIn() {
    Animated.spring(scaleAnim, {
      toValue: 0.975,
      useNativeDriver: USE_NATIVE_DRIVER,
      speed: 40,
      bounciness: 2,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: USE_NATIVE_DRIVER,
      speed: 40,
      bounciness: 2,
    }).start();
  }

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
      }}
    >
      <Pressable
        accessibilityHint={
          tooLarge
            ? `This repository exceeds the ${formatBytes(MAX_IMPORT_SIZE_BYTES)} mobile import limit.`
            : "Downloads this repository for offline reading."
        }
        accessibilityLabel={`Download ${repository.fullName}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(cloning) || tooLarge }}
        disabled={Boolean(cloning)}
        onPress={() => {
          if (!tooLarge) {
            onClone(repository.fullName);
          }
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          backgroundColor: busy ? `${palette.accent}12` : palette.fill,
          borderColor: busy ? palette.accent : palette.border,
          borderRadius: 12,
          borderWidth: busy ? 1.5 : 1,
          opacity: cloning && !busy ? 0.45 : 1,
          overflow: "hidden",
          padding: 14,
        }}
      >
        {/* Top row */}
        <View
          style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}
        >
          <OwnerAvatar
            owner={repository.owner}
            palette={palette}
            uri={repository.ownerAvatarUrl}
            size={36}
          />
          <View style={{ flex: 1, gap: 2 }}>
            {/* Name + action icon */}
            <View
              style={{ alignItems: "center", flexDirection: "row", gap: 6 }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: palette.text,
                  flex: 1,
                  fontSize: 14,
                  fontWeight: "700",
                  letterSpacing: -0.3,
                }}
              >
                {repository.fullName}
              </Text>

              <View
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                <Pressable
                  accessibilityLabel={`Download ${repository.fullName}`}
                  disabled={Boolean(cloning) || tooLarge}
                  hitSlop={8}
                  onPress={() => onClone(repository.fullName)}
                >
                  {busy ? (
                    <ActivityIndicator color={palette.accent} size="small" />
                  ) : (
                    <MaterialIcons
                      color={cloning || tooLarge ? palette.muted : palette.accent}
                      name={tooLarge ? "block" : "download"}
                      size={18}
                    />
                  )}
                </Pressable>

                <Pressable
                  hitSlop={8}
                  onPress={async () => {
                    try {
                      await Linking.openURL(repository.htmlUrl);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  <MaterialIcons
                    color={palette.muted}
                    name="open-in-new"
                    size={18}
                  />
                </Pressable>
              </View>
            </View>

            {/* Description */}
            {repository.description ? (
              <Text
                numberOfLines={2}
                style={{
                  color: palette.muted,
                  fontSize: 12,
                  lineHeight: 18,
                  marginTop: 2,
                }}
              >
                {repository.description}
              </Text>
            ) : (
              <Text
                style={{
                  color: `${palette.muted}60`,
                  fontSize: 12,
                  fontStyle: "italic",
                  marginTop: 2,
                }}
              >
                No description
              </Text>
            )}
          </View>
        </View>
        {/* Progress / size row */}
        {progress ? (
          <View style={{ marginTop: 10 }}>
            <Text
              style={{ color: palette.muted, fontSize: 11, marginBottom: 6 }}
            >
              {progress.phase === "download"
                ? "Downloading"
                : progress.phase === "extract"
                  ? "Extracting"
                  : "Indexing"}{" "}
              — {progress.message}
            </Text>
            <View
              style={{
                height: 6,
                backgroundColor: palette.border,
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: 6,
                  backgroundColor: palette.accent,
                  width: `${Math.round((progress.progress ?? 0) * 100)}%`,
                }}
              />
            </View>
          </View>
        ) : null}
        {progress ? (
          <View style={{ marginTop: 8 }}>
            <Text style={{ color: palette.muted, fontSize: 11 }}>
              {(() => {
                const downloaded = progress.downloadedBytes ?? 0;
                const total = progress.totalBytes ?? undefined;
                const percent = total
                  ? Math.round((downloaded / total) * 100)
                  : Math.round((progress.progress ?? 0) * 100);
                if (total)
                  return `${formatBytes(downloaded)} of ${formatBytes(total)} (${percent}%)`;
                return `${percent}%`;
              })()}
            </Text>
          </View>
        ) : null}
        {sizeBytes != null ? (
          <View style={{ marginTop: 10 }}>
            <Text style={{ color: tooLarge ? palette.danger : palette.muted, fontSize: 11 }}>
              {formatBytes(sizeBytes)}
              {tooLarge ? ` · over ${formatBytes(MAX_IMPORT_SIZE_BYTES)} mobile limit` : ""}
            </Text>
          </View>
        ) : null}
        {/* Stats row */}
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 10,
          }}
        >
          {repository.language ? (
            <View
              style={{ alignItems: "center", flexDirection: "row", gap: 5 }}
            >
              <View
                style={{
                  backgroundColor: languageColor(repository.language),
                  borderRadius: 5,
                  height: 9,
                  width: 9,
                }}
              />
              <Text style={{ color: palette.muted, fontSize: 11 }}>
                {repository.language}
              </Text>
            </View>
          ) : null}

          <View style={{ alignItems: "center", flexDirection: "row", gap: 3 }}>
            <MaterialIcons color={palette.muted} name="star-border" size={12} />
            <Text style={{ color: palette.muted, fontSize: 11 }}>
              {formatCount(repository.stars)}
            </Text>
          </View>

          <View style={{ alignItems: "center", flexDirection: "row", gap: 3 }}>
            <MaterialIcons color={palette.muted} name="call-split" size={12} />
            <Text style={{ color: palette.muted, fontSize: 11 }}>
              {formatCount(repository.forks)}
            </Text>
          </View>

          {repository.openIssues > 0 ? (
            <View
              style={{ alignItems: "center", flexDirection: "row", gap: 3 }}
            >
              <MaterialIcons
                color={palette.muted}
                name="bug-report"
                size={12}
              />
              <Text style={{ color: palette.muted, fontSize: 11 }}>
                {formatCount(repository.openIssues)}
              </Text>
            </View>
          ) : null}

          {repository.pushedAt ? (
            <Text
              style={{
                color: palette.muted,
                fontSize: 11,
                marginLeft: "auto",
              }}
            >
              {relativeTime(repository.pushedAt)}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
});

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({
  count,
  label,
  palette,
}: {
  count?: number;
  label: string;
  palette: ReturnType<typeof useAppPalette>;
}) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
      <Text
        style={{
          color: palette.muted,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.9,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      {count != null && count > 0 ? (
        <View
          style={{
            backgroundColor: palette.border,
            borderRadius: 10,
            paddingHorizontal: 6,
            paddingVertical: 1,
          }}
        >
          <Text
            style={{ color: palette.muted, fontSize: 10, fontWeight: "600" }}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Token prompt banner ───────────────────────────────────────────────────────

function TokenPromptBanner({
  palette,
}: {
  palette: ReturnType<typeof useAppPalette>;
}) {
  if (hasGitHubToken()) return null;

  return (
    <Pressable
      onPress={() => router.push("/settings")}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? palette.secondary : palette.fill,
        borderColor: palette.border,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: "row",
        gap: 10,
        padding: 12,
      })}
    >
      <MaterialIcons color={palette.muted} name="vpn-key" size={16} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.text, fontSize: 13, fontWeight: "600" }}>
          Add a GitHub token for better results
        </Text>
        <Text style={{ color: palette.muted, fontSize: 11, marginTop: 1 }}>
          Unauthenticated searches are limited to 10/min. Tap to add a PAT in
          Settings.
        </Text>
      </View>
      <MaterialIcons color={palette.muted} name="chevron-right" size={18} />
    </Pressable>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const palette = useAppPalette();

  const [query, setQuery] = useState("");
  const [trending, setTrending] = useState<GitHubRepositorySearchResult[]>([]);
  const [searchResults, setSearchResults] = useState<
    GitHubRepositorySearchResult[]
  >([]);
  const [mode, setMode] = useState<"browse" | "search">("browse");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cloning, setCloning] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<
    Record<string, ImportProgress | null>
  >({});
  const [repoSizes, setRepoSizes] = useState<Record<string, number | null>>({});
  // controllers removed — pause/resume/cancel not supported anymore
  const [error, setError] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(
    null,
  );

  const searchAbortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<TextInput>(null);

  // ── Load trending ────────────────────────────────────────────────────────────

  const loadTrending = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    setRateLimitInfo(null);
    try {
      const results = await fetchTrendingRepositories(signal);
      if (signal?.aborted) return;
      setTrending(results);
    } catch (caught) {
      if ((caught as Error)?.name === "AbortError") return;
      if (caught instanceof GitHubRateLimitError) {
        setRateLimitInfo(caught.info);
        setError(null);
        return;
      }
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load trending repositories.",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    loadTrending(controller.signal);
    return () => controller.abort();
  }, [loadTrending]);

  // ── Search with debounce + abort ─────────────────────────────────────────────

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      searchAbortRef.current?.abort();
      setSearchResults([]);
      setMode("browse");
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setMode("search");
      setSearching(true);
      setError(null);
      setRateLimitInfo(null);

      try {
        const results = await searchGitHubRepositories(trimmed, {
          sort: "best-match",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setSearchResults(results);
      } catch (caught) {
        if ((caught as Error)?.name === "AbortError") return;
        if (caught instanceof GitHubRateLimitError) {
          setRateLimitInfo(caught.info);
          return;
        }
        setError(
          caught instanceof Error ? caught.message : "GitHub search failed.",
        );
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  // ── Clone ────────────────────────────────────────────────────────────────────

  const clone = useCallback(async (fullName: string) => {
    setCloning(fullName);
    setError(null);
    setImportProgress((p) => ({
      ...p,
      [fullName]: {
        phase: "download",
        progress: 0,
        message: "Preparing download",
      },
    }));

    // no controller is created; importRepository is called without controller

    try {
      const details = await resolveGitHubRepository(fullName);
      const saved = await importRepository(details, (prog) =>
        setImportProgress((p) => ({ ...p, [fullName]: prog })),
      );

      setRepoSizes((s) => ({ ...s, [fullName]: saved.sizeBytes }));
      router.replace({
        pathname: "/repository/[id]",
        params: { id: saved.id },
      });
    } catch (caught) {
      if (caught instanceof GitHubRateLimitError) {
        setRateLimitInfo(caught.info);
        return;
      }
      // pause/cancel no longer supported; handle errors normally
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not clone this repository.",
      );
    } finally {
      setCloning(null);
      setImportProgress((p) => ({ ...p, [fullName]: null }));
      // no controllers to clean up
    }
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const visibleItems = mode === "search" ? searchResults : trending;
  const isIdle = !loading && !searching;
  const isEmpty = isIdle && visibleItems.length === 0 && !rateLimitInfo;
  const refreshTrending = useCallback(async () => {
    setRefreshing(true);
    setRateLimitInfo(null);
    await loadTrending();
    setRefreshing(false);
  }, [loadTrending]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="none"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        mode === "browse" ? (
          <RefreshControl
            refreshing={refreshing}
            tintColor={palette.accent}
            onRefresh={refreshTrending}
          />
        ) : undefined
      }
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={{
        gap: 14,
        flexGrow: 1,
        minHeight: "100%",
        padding: 16,
        paddingBottom: 48,
      }}
    >
      {/* Header */}
      <AppHeader
        palette={palette}
        subtitle="Browse trending repositories or search GitHub to save for offline reading."
        title="Discover"
      />

      {/* Token prompt (only shown when no token is set and user hasn't searched) */}
      {mode === "browse" ? <TokenPromptBanner palette={palette} /> : null}

      {/* Search bar */}
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.fill,
          borderColor: query.length >= 2 ? palette.accent : palette.border,
          borderRadius: 11,
          borderWidth: 1,
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: 12,
        }}
      >
        <MaterialIcons
          color={query.length >= 2 ? palette.accent : palette.muted}
          name="search"
          size={18}
        />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => inputRef.current?.blur()}
          onChangeText={setQuery}
          placeholder="Search repositories, topics, owners…"
          placeholderTextColor={palette.muted}
          ref={inputRef}
          returnKeyType="search"
          style={{
            color: palette.text,
            flex: 1,
            fontSize: 14,
            minHeight: 44,
          }}
          value={query}
        />
        {searching ? (
          <ActivityIndicator color={palette.accent} size="small" />
        ) : query.length > 0 ? (
          <Pressable
            hitSlop={10}
            onPress={() => {
              setQuery("");
              setMode("browse");
              setSearchResults([]);
              setRateLimitInfo(null);
              setError(null);
            }}
          >
            <MaterialIcons color={palette.muted} name="close" size={18} />
          </Pressable>
        ) : null}
      </View>

      {/* Rate limit banner */}
      {rateLimitInfo ? (
        <RateLimitBanner info={rateLimitInfo} palette={palette} />
      ) : null}

      {/* Generic error */}
      {error && !rateLimitInfo ? (
        <InlineError message={error} palette={palette} />
      ) : null}

      {/* List */}
      <View style={{ gap: 10 }}>
        <SectionLabel
          count={
            isIdle && visibleItems.length > 0 ? visibleItems.length : undefined
          }
          label={mode === "search" ? "Search results" : "Trending this month"}
          palette={palette}
        />

        {/* Skeletons while loading */}
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <SkeletonCard delay={i * 80} key={i} palette={palette} />
            ))
          : null}

        {/* Empty state */}
        {isEmpty ? (
          <View
            style={{
              alignItems: "center",
              gap: 10,
              paddingVertical: spacing.lg ?? 28,
            }}
          >
            <MaterialIcons
              color={palette.muted}
              name={mode === "search" ? "search-off" : "wifi-off"}
              size={36}
            />
            <Text
              style={{
                color: palette.muted,
                fontSize: 14,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              {mode === "search"
                ? "No repositories matched your search."
                : "Could not load trending repositories.\nPull down to try again."}
            </Text>
          </View>
        ) : null}

        {/* Cards */}
        {!loading
          ? visibleItems.map((repository, index) => (
              <ResultCard
                cloning={cloning}
                index={index}
                key={repository.fullName}
                onClone={clone}
                repository={repository}
                progress={importProgress[repository.fullName]}
                sizeBytes={
                  repository.sizeBytes ?? repoSizes[repository.fullName]
                }
                // pause/cancel controllers removed
              />
            ))
          : null}
      </View>
    </ScrollView>
  );
}
