import * as FileSystem from "expo-file-system/legacy";
import JSZip from "jszip";

import type { GitHubRepositoryDetails } from "@/lib/github";

const APP_DIRECTORY = `${FileSystem.documentDirectory ?? ""}kodeview/`;
const REPOSITORY_DIRECTORY = `${APP_DIRECTORY}repositories/`;
const DOWNLOAD_DIRECTORY = `${APP_DIRECTORY}downloads/`;
const MANIFEST_FILE = ".kodeview.json";
const MAX_TEXT_FILE_BYTES = 1.5 * 1024 * 1024;
export const MAX_IMPORT_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_REPOSITORY_FILES = 50_000;
const MIN_FREE_SPACE_BYTES = 64 * 1024 * 1024;
const STAGING_SUFFIX = ".staging";
const BACKUP_SUFFIX = ".backup";

export type SavedRepository = {
  defaultBranch: string;
  description: string | null;
  downloadedAt: string;
  fileCount: number;
  fullName: string;
  htmlUrl: string;
  id: string;
  language: string | null;
  owner: string;
  ownerAvatarUrl?: string;
  pushedAt: string | null;
  repo: string;
  rootName: string;
  rootUri: string;
  sizeBytes: number;
  stars: number;
};

export type RepositoryTreeNode = {
  children?: RepositoryTreeNode[];
  extension: string | null;
  name: string;
  path: string;
  size: number;
  type: "directory" | "file";
  uri: string;
};

export type ImportProgress = {
  message: string;
  phase: "download" | "extract" | "index";
  progress: number;
  downloadedBytes?: number;
  totalBytes?: number;
};

// ImportController removed: pause/resume/cancel features are no longer supported.

const textExtensions = new Set([
  "",
  "bat",
  "c",
  "config",
  "cpp",
  "cs",
  "css",
  "csv",
  "dart",
  "env",
  "go",
  "gradle",
  "graphql",
  "h",
  "hpp",
  "html",
  "java",
  "js",
  "json",
  "jsx",
  "kt",
  "lock",
  "log",
  "lua",
  "m",
  "md",
  "mdx",
  "mm",
  "php",
  "plist",
  "properties",
  "py",
  "rb",
  "rs",
  "sass",
  "scss",
  "sh",
  "sql",
  "swift",
  "toml",
  "ts",
  "tsx",
  "txt",
  "wast",
  "wat",
  "vue",
  "xml",
  "yaml",
  "yml",
]);

function assertDocumentDirectory() {
  if (!FileSystem.documentDirectory) {
    throw new Error("Document storage is unavailable on this device.");
  }
}

function hasDocumentDirectory() {
  return Boolean(FileSystem.documentDirectory);
}

function sanitizeId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dirname(path: string) {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index + 1);
}

function extensionFor(name: string) {
  const clean = name.toLowerCase();
  const index = clean.lastIndexOf(".");
  return index === -1 ? "" : clean.slice(index + 1);
}

function hasUnsafePath(path: string) {
  return (
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").some((part) => part === ".." || part === ".")
  );
}

async function ensureDirectory(uri: string) {
  await FileSystem.makeDirectoryAsync(uri, { intermediates: true }).catch(
    () => undefined,
  );
}

async function readManifest(repoUri: string) {
  const manifest = await FileSystem.readAsStringAsync(
    `${repoUri}${MANIFEST_FILE}`,
  );
  return JSON.parse(manifest) as SavedRepository;
}

async function recoverRepositoryBackup(id: string) {
  const repositoryUri = `${REPOSITORY_DIRECTORY}${id}/`;
  const backupUri = `${REPOSITORY_DIRECTORY}${id}${BACKUP_SUFFIX}/`;
  const [repositoryInfo, backupInfo] = await Promise.all([
    FileSystem.getInfoAsync(repositoryUri),
    FileSystem.getInfoAsync(backupUri),
  ]);

  if (!backupInfo.exists) {
    return;
  }

  if (repositoryInfo.exists) {
    await FileSystem.deleteAsync(backupUri, { idempotent: true });
    return;
  }

  await FileSystem.moveAsync({ from: backupUri, to: repositoryUri });
}

export async function listSavedRepositories(): Promise<SavedRepository[]> {
  if (!hasDocumentDirectory()) {
    return [];
  }

  await ensureDirectory(REPOSITORY_DIRECTORY);

  let ids = await FileSystem.readDirectoryAsync(REPOSITORY_DIRECTORY).catch(
    () => [],
  );
  const backups = ids.filter((id) => id.endsWith(BACKUP_SUFFIX));
  await Promise.all(
    backups.map((backup) =>
      recoverRepositoryBackup(backup.slice(0, -BACKUP_SUFFIX.length)).catch(() => undefined),
    ),
  );
  ids = await FileSystem.readDirectoryAsync(REPOSITORY_DIRECTORY).catch(() => []);
  const repositories = await Promise.all(
    ids
      .filter((id) => !id.endsWith(STAGING_SUFFIX) && !id.endsWith(BACKUP_SUFFIX))
      .map(async (id) => {
      try {
        return await readManifest(`${REPOSITORY_DIRECTORY}${id}/`);
      } catch {
        return null;
      }
      }),
  );

  return repositories
    .filter((repo): repo is SavedRepository => Boolean(repo))
    .sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt));
}

const repositoryTreeCache = new Map<string, RepositoryTreeNode[]>();

export function clearRepositoryTreeCache(repositoryId?: string) {
  if (repositoryId) {
    repositoryTreeCache.delete(repositoryId);
    return;
  }

  repositoryTreeCache.clear();
}

export async function importRepository(
  details: GitHubRepositoryDetails,
  onProgress?: (progress: ImportProgress) => void,
): Promise<SavedRepository> {
  assertDocumentDirectory();
  await ensureDirectory(REPOSITORY_DIRECTORY);
  await ensureDirectory(DOWNLOAD_DIRECTORY);

  const id = sanitizeId(
    `${details.owner}-${details.repo}-${details.defaultBranch}`,
  );
  const repoUri = `${REPOSITORY_DIRECTORY}${id}/`;
  const stagingUri = `${REPOSITORY_DIRECTORY}${id}${STAGING_SUFFIX}/`;
  const backupUri = `${REPOSITORY_DIRECTORY}${id}${BACKUP_SUFFIX}/`;
  const zipUri = `${DOWNLOAD_DIRECTORY}${id}.zip`;

  if (details.sizeBytes > MAX_IMPORT_SIZE_BYTES) {
    throw new Error(
      `This repository is about ${formatBytes(details.sizeBytes)}. KodeView limits imports to ${formatBytes(MAX_IMPORT_SIZE_BYTES)} to prevent mobile memory crashes.`,
    );
  }

  const freeSpace = await FileSystem.getFreeDiskStorageAsync().catch(() => Number.POSITIVE_INFINITY);
  const estimatedRequired = Math.max(MIN_FREE_SPACE_BYTES, details.sizeBytes * 3);
  if (freeSpace < estimatedRequired) {
    throw new Error(
      `Not enough free space. Free at least ${formatBytes(estimatedRequired - freeSpace)} and try again.`,
    );
  }

  onProgress?.({
    phase: "download",
    progress: 0,
    message: "Preparing download",
  });
  await recoverRepositoryBackup(id);
  await FileSystem.deleteAsync(stagingUri, { idempotent: true });
  await FileSystem.deleteAsync(zipUri, { idempotent: true }).catch(
    () => undefined,
  );
  await ensureDirectory(stagingUri);

  try {
    const download = FileSystem.createDownloadResumable(
    details.zipUrl,
    zipUri,
    {},
    (event) => {
      const expected = event.totalBytesExpectedToWrite ?? 0;
      const written = event.totalBytesWritten ?? 0;
      const progress = expected > 0 ? written / expected : 0;
      onProgress?.({
        phase: "download",
        progress: Math.min(progress, 0.98),
        message: "Downloading ZIP from GitHub",
        downloadedBytes: written,
        totalBytes: expected > 0 ? expected : undefined,
      });
    },
    );

    const result = await download.downloadAsync();

  // Report final downloaded size if possible
    try {
      const info = await FileSystem.getInfoAsync(zipUri);
      if (info.exists) {
        onProgress?.({
          phase: "download",
          progress: 1,
          message: "Download complete",
          downloadedBytes: info.size ?? undefined,
          totalBytes: info.size ?? undefined,
        });
      }
    } catch {
      // Progress metadata is optional.
    }

    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error(
        `Download failed with status ${result?.status ?? "unknown"}.`,
      );
    }

  onProgress?.({
    phase: "extract",
    progress: 0,
    message: "Reading ZIP archive",
  });
    const zipBase64 = await FileSystem.readAsStringAsync(zipUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const zip = await JSZip.loadAsync(zipBase64, { base64: true });
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    if (entries.length > MAX_REPOSITORY_FILES) {
      throw new Error(
        `This archive contains more than ${MAX_REPOSITORY_FILES.toLocaleString()} files, which is too large for a reliable mobile import.`,
      );
    }
    const rootName = entries[0]?.name.split("/")[0] ?? details.repo;

    let fileCount = 0;
    let sizeBytes = 0;

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const rootPrefix = `${rootName}/`;
      const relativePath = entry.name.startsWith(rootPrefix)
        ? entry.name.slice(rootPrefix.length)
        : entry.name;

      if (!relativePath || hasUnsafePath(relativePath)) {
        continue;
      }

      const parent = dirname(relativePath);

      if (parent) {
        await ensureDirectory(`${stagingUri}${parent}`);
      }

      const base64 = await entry.async("base64");
      await FileSystem.writeAsStringAsync(`${stagingUri}${relativePath}`, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      fileCount += 1;
      sizeBytes += Math.ceil((base64.length * 3) / 4);
      if (sizeBytes > MAX_IMPORT_SIZE_BYTES) {
        throw new Error(
          `The extracted repository exceeds KodeView's ${formatBytes(MAX_IMPORT_SIZE_BYTES)} mobile safety limit.`,
        );
      }

      if (index % 12 === 0 || index === entries.length - 1) {
        onProgress?.({
          phase: "extract",
          progress: entries.length > 0 ? (index + 1) / entries.length : 1,
          message: `Extracting ${fileCount.toLocaleString()} files`,
        });
      }
    }

    const manifest: SavedRepository = {
    id,
    owner: details.owner,
    ownerAvatarUrl: details.ownerAvatarUrl,
    repo: details.repo,
    fullName: details.fullName,
    description: details.description,
    defaultBranch: details.defaultBranch,
    language: details.language,
    stars: details.stars,
    pushedAt: details.pushedAt,
    htmlUrl: details.htmlUrl,
    downloadedAt: new Date().toISOString(),
    rootName,
    rootUri: repoUri,
    fileCount,
    sizeBytes,
    };

    onProgress?.({
      phase: "index",
      progress: 0.9,
      message: "Saving local index",
    });
    await FileSystem.writeAsStringAsync(
      `${stagingUri}${MANIFEST_FILE}`,
      JSON.stringify(manifest),
    );

    const existing = await FileSystem.getInfoAsync(repoUri);
    if (existing.exists) {
      await FileSystem.moveAsync({ from: repoUri, to: backupUri });
    }

    try {
      await FileSystem.moveAsync({ from: stagingUri, to: repoUri });
    } catch (caught) {
      const backup = await FileSystem.getInfoAsync(backupUri);
      if (backup.exists) {
        await FileSystem.moveAsync({ from: backupUri, to: repoUri });
      }
      throw caught;
    }

    await FileSystem.deleteAsync(backupUri, { idempotent: true }).catch(() => undefined);
    onProgress?.({ phase: "index", progress: 1, message: "Ready offline" });
    clearRepositoryTreeCache(manifest.id);
    return manifest;
  } finally {
    await Promise.all([
      FileSystem.deleteAsync(zipUri, { idempotent: true }).catch(() => undefined),
      FileSystem.deleteAsync(stagingUri, { idempotent: true }).catch(() => undefined),
    ]);
  }
}

export async function deleteRepository(repository: SavedRepository) {
  clearRepositoryTreeCache(repository.id);
  await FileSystem.deleteAsync(repository.rootUri, { idempotent: true });
}

export async function loadRepositoryTree(
  repository: SavedRepository,
  options?: { refresh?: boolean },
): Promise<RepositoryTreeNode[]> {
  if (!options?.refresh) {
    const cached = repositoryTreeCache.get(repository.id);
    if (cached) {
      return cached;
    }
  }

  const tree = await readDirectory(repository.rootUri, "");
  repositoryTreeCache.set(repository.id, tree);
  return tree;
}

export async function findRepositoryNode(
  repository: SavedRepository,
  path: string,
): Promise<RepositoryTreeNode | null> {
  const tree = await loadRepositoryTree(repository);
  const queue = [...tree];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) continue;
    if (node.path === path) return node;
    if (node.children) queue.push(...node.children);
  }

  return null;
}

async function readDirectory(
  baseUri: string,
  relativePath: string,
): Promise<RepositoryTreeNode[]> {
  const directoryUri = `${baseUri}${relativePath}`;
  const names = await FileSystem.readDirectoryAsync(directoryUri).catch(
    () => [],
  );
  const nodes = await Promise.all(
    names
      .filter((name) => name !== MANIFEST_FILE)
      .map(async (name) => {
        const path = `${relativePath}${name}`;
        const uri = `${directoryUri}${name}`;
        const info = await FileSystem.getInfoAsync(uri);

        if (info.exists && info.isDirectory) {
          return {
            name,
            path,
            uri: `${uri}/`,
            type: "directory" as const,
            extension: null,
            size: 0,
            children: await readDirectory(baseUri, `${path}/`),
          };
        }

        return {
          name,
          path,
          uri,
          type: "file" as const,
          extension: extensionFor(name),
          size: info.exists && !info.isDirectory ? (info.size ?? 0) : 0,
        };
      }),
  );

  return nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });
}

export async function readRepositoryFile(node: RepositoryTreeNode) {
  if (node.type !== "file") {
    throw new Error("Select a file to open it.");
  }

  if (node.size > MAX_TEXT_FILE_BYTES) {
    throw new Error("This file is too large for the mobile text viewer.");
  }

  if (!textExtensions.has(node.extension ?? "")) {
    throw new Error(
      "Binary or unsupported file type. The repository is saved locally.",
    );
  }

  return FileSystem.readAsStringAsync(node.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
