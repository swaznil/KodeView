import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import { Pill } from "@/components/app/shared";
import { OwnerAvatar } from "@/components/repository/owner-avatar";
import { useAppPalette } from "@/hooks/use-theme-preference";
import { formatBytes, type SavedRepository } from "@/lib/repository-storage";

function formatDate(value: string | null) {
  if (!value) {
    return "No recent push";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export const RepositoryRow = memo(function RepositoryRow({
  onOpenMenu,
  pinned,
  repository,
}: {
  onOpenMenu: (repository: SavedRepository) => void;
  pinned: boolean;
  repository: SavedRepository;
}) {
  const palette = useAppPalette();

  return (
    <View
      style={{
        backgroundColor: palette.fill,
        borderColor: pinned ? palette.accent : palette.border,
        borderRadius: 8,
        borderWidth: 1,
      }}
    >
      <Pressable
        accessibilityHint="Opens the offline file browser. Long press for repository actions."
        accessibilityLabel={`${repository.fullName}, ${repository.fileCount} files`}
        accessibilityRole="button"
        onLongPress={() => onOpenMenu(repository)}
        onPress={() =>
          router.push({
            pathname: "/repository/[id]",
            params: { id: repository.id },
          })
        }
        style={({ pressed }) => ({
          gap: 8,
          opacity: pressed ? 0.92 : 1,
          padding: 12,
          paddingRight: 44,
        })}
      >
        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
          <OwnerAvatar
            owner={repository.owner}
            palette={palette}
            uri={repository.ownerAvatarUrl}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <View
              style={{ alignItems: "center", flexDirection: "row", gap: 6 }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: palette.text,
                  flex: 1,
                  fontSize: 15,
                  fontWeight: "800",
                }}
              >
                {repository.fullName}
              </Text>
              {pinned ? (
                <MaterialIcons
                  color={palette.accent}
                  name="push-pin"
                  size={16}
                />
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              style={{ color: palette.muted, fontSize: 12 }}
            >
              {repository.language ?? repository.defaultBranch} ·{" "}
              {formatBytes(repository.sizeBytes)}
            </Text>
          </View>
          {/* chevron removed per user request */}
        </View>
        {repository.description ? (
          <Text
            numberOfLines={2}
            style={{ color: palette.muted, fontSize: 12, lineHeight: 17 }}
          >
            {repository.description}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Pill icon="star" palette={palette}>
            {repository.stars.toLocaleString()}
          </Pill>
          <Pill icon="description" palette={palette}>
            {repository.fileCount.toLocaleString()}
          </Pill>
          <Pill palette={palette}>{formatDate(repository.pushedAt)}</Pill>
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel="Repository options"
        hitSlop={8}
        onPress={() => onOpenMenu(repository)}
        style={({ pressed }) => ({
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.7 : 1,
          position: "absolute",
          right: 4,
          top: 4,
          height: 40,
          width: 40,
        })}
      >
        <MaterialIcons color={palette.muted} name="more-vert" size={22} />
      </Pressable>
    </View>
  );
});
