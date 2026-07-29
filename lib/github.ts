// ─── Types ─────────────────────────────────────────────────────────────────────

export type ParsedGitHubRepository = {
  owner: string;
  repo: string;
};

export type GitHubRepositoryDetails = ParsedGitHubRepository & {
  defaultBranch: string;
  description: string | null;
  fullName: string;
  htmlUrl: string;
  language: string | null;
  ownerAvatarUrl: string;
  pushedAt: string | null;
  sizeBytes: number;
  stars: number;
  zipUrl: string;
};

export type GitHubCommit = {
  author: string | null;
  date: string | null;
  message: string;
  sha: string;
  url: string;
};

export type GitHubBranch = {
  commitSha: string;
  name: string;
  protected: boolean;
};

export type GitHubRepositorySearchResult = Omit<
  GitHubRepositoryDetails,
  "sizeBytes" | "zipUrl"
> & {
  forks: number;
  openIssues: number;
  updatedAt: string | null;
  sizeBytes?: number;
};

export type RateLimitInfo = {
  limit: number;
  remaining: number;
  resetAt: Date;
  isExceeded: boolean;
};

// ─── Internal API types ────────────────────────────────────────────────────────

type GitHubRepositoryResponse = {
  default_branch?: string;
  description?: string | null;
  full_name?: string;
  html_url?: string;
  language?: string | null;
  name?: string;
  owner?: { avatar_url?: string; login?: string };
  pushed_at?: string | null;
  size?: number;
  stargazers_count?: number;
  zipball_url?: string;
  message?: string;
  forks_count?: number;
  open_issues_count?: number;
  updated_at?: string | null;
};

type GitHubSearchResponse = {
  items?: GitHubRepositoryResponse[];
  message?: string;
  documentation_url?: string;
};

type GitHubCommitResponse = {
  commit?: { author?: { date?: string; name?: string }; message?: string };
  html_url?: string;
  sha?: string;
};

type GitHubBranchResponse = {
  commit?: { sha?: string };
  name?: string;
  protected?: boolean;
};

type GitHubApiOptions = {
  signal?: AbortSignal;
  cacheDurationMs?: number;
};

// ─── Rate limit error ──────────────────────────────────────────────────────────

export class GitHubRateLimitError extends Error {
  constructor(
    public readonly info: RateLimitInfo,
    message: string,
  ) {
    super(message);
    this.name = "GitHubRateLimitError";
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const GITHUB_API_URL = "https://api.github.com";
const SEARCH_PAGE_SIZE = 30;
const CACHE_DURATION_MS = 1000 * 60 * 15; // 15 min
const SEARCH_CACHE_DURATION_MS = 1000 * 60 * 10; // 10 min
const REQUEST_TIMEOUT_MS = 20_000;

// ─── PAT storage ───────────────────────────────────────────────────────────────
// Token is stored in-memory only for this session. The caller (settings screen)
// is responsible for persisting it to SecureStore and calling setGitHubToken on
// app start. We deliberately avoid AsyncStorage/SecureStore here to keep this
// library free of React Native dependencies.

let _token: string | null = null;

export function setGitHubToken(token: string | null) {
  _token = token ? token.trim() : null;
  // Bust the cache whenever auth changes so stale unauthed results disappear.
  cache.clear();
}

export function getGitHubToken(): string | null {
  return _token;
}

export function hasGitHubToken(): boolean {
  return Boolean(_token);
}

// ─── In-memory cache ───────────────────────────────────────────────────────────

const cache = new Map<string, { expires: number; data: unknown }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data as T;
  return null;
}

function setCached(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { expires: Date.now() + ttlMs, data });
}

// ─── Rate limit tracker ────────────────────────────────────────────────────────

let _lastRateLimit: RateLimitInfo | null = null;

export function getLastRateLimitInfo(): RateLimitInfo | null {
  return _lastRateLimit;
}

function parseRateLimitHeaders(headers: Headers): RateLimitInfo | null {
  const limit = parseInt(headers.get("x-ratelimit-limit") ?? "", 10);
  const remaining = parseInt(headers.get("x-ratelimit-remaining") ?? "", 10);
  const reset = parseInt(headers.get("x-ratelimit-reset") ?? "", 10);

  if (isNaN(limit) || isNaN(remaining) || isNaN(reset)) return null;

  return {
    limit,
    remaining,
    resetAt: new Date(reset * 1000),
    isExceeded: remaining === 0,
  };
}

function formatResetTime(info: RateLimitInfo): string {
  const secsUntilReset = Math.max(
    0,
    Math.ceil((info.resetAt.getTime() - Date.now()) / 1000),
  );
  if (secsUntilReset < 60) return `${secsUntilReset}s`;
  return `${Math.ceil(secsUntilReset / 60)}m`;
}

// ─── Headers ───────────────────────────────────────────────────────────────────

function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (_token) {
    headers["Authorization"] = `Bearer ${_token}`;
  }
  return headers;
}

// ─── Core fetch ────────────────────────────────────────────────────────────────

async function githubFetch<T>(
  path: string,
  options: GitHubApiOptions = {},
): Promise<T> {
  const { signal, cacheDurationMs = CACHE_DURATION_MS } = options;
  const cacheKey =
    cacheDurationMs === 0 ? null : `${_token ? "auth" : "anon"}:${path}`;

  if (cacheKey) {
    const cached = getCached<T>(cacheKey);
    if (cached !== null) return cached;
  }

  const requestController = new AbortController();
  let timedOut = false;
  const handleExternalAbort = () => requestController.abort();
  signal?.addEventListener("abort", handleExternalAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${GITHUB_API_URL}${path}`, {
      headers: getGitHubHeaders(),
      signal: requestController.signal,
    });
  } catch (caught) {
    if (timedOut) {
      throw new Error("GitHub took too long to respond. Check your connection and try again.");
    }
    throw caught;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", handleExternalAbort);
  }

  // Track rate limit info from every response
  const rateInfo = parseRateLimitHeaders(response.headers);
  if (rateInfo) _lastRateLimit = rateInfo;

  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    documentation_url?: string;
  };

  if (!response.ok) {
    const msg = (data as { message?: string }).message ?? "";

    // Surface a typed rate-limit error with reset time
    const rateLimited =
      response.status === 429 ||
      rateInfo?.remaining === 0 ||
      /rate limit|secondary rate/i.test(msg);
    if (rateLimited) {
      const retryAfter = response.headers.get("retry-after");
      const resetSecs = response.headers.get("x-ratelimit-reset");

      let resetAt: Date;
      if (retryAfter) {
        resetAt = new Date(Date.now() + parseInt(retryAfter, 10) * 1000);
      } else if (resetSecs) {
        resetAt = new Date(parseInt(resetSecs, 10) * 1000);
      } else {
        resetAt = new Date(Date.now() + 60 * 1000);
      }

      const info: RateLimitInfo = {
        limit: rateInfo?.limit ?? 10,
        remaining: 0,
        resetAt,
        isExceeded: true,
      };
      _lastRateLimit = info;

      const tip = _token
        ? `Rate limit resets in ${formatResetTime(info)}.`
        : `Rate limit resets in ${formatResetTime(info)}. Adding a GitHub token in Settings raises it to 5,000 req/hr.`;

      throw new GitHubRateLimitError(info, tip);
    }

    throw new Error(msg || `GitHub returned ${response.status}.`);
  }

  if (cacheKey) {
    setCached(cacheKey, data, cacheDurationMs);
  }

  return data;
}

// ─── Repository parsing ────────────────────────────────────────────────────────

export function parseGitHubRepository(
  input: string,
): ParsedGitHubRepository | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const shorthand = trimmed.match(
    /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/,
  );
  if (shorthand) return { owner: shorthand[1], repo: shorthand[2] };

  try {
    const normalized = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(normalized);
    const isGitHub = url.hostname.toLowerCase() === "github.com";
    const [owner, repoSegment] = url.pathname.split("/").filter(Boolean);
    if (!isGitHub || !owner || !repoSegment) return null;
    return { owner, repo: repoSegment.replace(/\.git$/i, "") };
  } catch {
    return null;
  }
}

export function ownerAvatarUrl(owner: string, size = 128): string {
  return `https://github.com/${encodeURIComponent(owner)}.png?size=${size}`;
}

export async function resolveGitHubRepository(
  input: string,
  options: GitHubApiOptions = {},
): Promise<GitHubRepositoryDetails> {
  const parsed = parseGitHubRepository(input);
  if (!parsed) throw new Error("Enter a public GitHub repo URL or owner/repo.");

  const data = await githubFetch<GitHubRepositoryResponse>(
    `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`,
    options,
  ).catch((err: unknown) => {
    if (err instanceof GitHubRateLimitError) throw err;
    const msg =
      err instanceof Error ? err.message : "GitHub returned an error.";
    throw new Error(
      msg === "Not Found" ? "Repository not found or not public." : msg,
    );
  });

  const owner = data.owner?.login ?? parsed.owner;
  const repo = data.name ?? parsed.repo;
  const defaultBranch = data.default_branch ?? "main";

  return {
    owner,
    repo,
    defaultBranch,
    description: data.description ?? null,
    fullName: data.full_name ?? `${owner}/${repo}`,
    htmlUrl: data.html_url ?? `https://github.com/${owner}/${repo}`,
    language: data.language ?? null,
    ownerAvatarUrl: data.owner?.avatar_url ?? ownerAvatarUrl(owner),
    pushedAt: data.pushed_at ?? null,
    sizeBytes: Math.max(0, Math.floor((data.size ?? 0) * 1024)),
    stars: data.stargazers_count ?? 0,
    zipUrl:
      data.zipball_url ??
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball/${encodeURIComponent(defaultBranch)}`,
  };
}

// ─── Search helpers ────────────────────────────────────────────────────────────

function mapSearchItem(
  item: GitHubRepositoryResponse,
): GitHubRepositorySearchResult | null {
  const owner = item.owner?.login;
  const repo = item.name;
  if (!owner || !repo) return null;
  const defaultBranch = item.default_branch ?? "main";

  return {
    owner,
    repo,
    defaultBranch,
    description: item.description ?? null,
    fullName: item.full_name ?? `${owner}/${repo}`,
    htmlUrl: item.html_url ?? `https://github.com/${owner}/${repo}`,
    language: item.language ?? null,
    ownerAvatarUrl: item.owner?.avatar_url ?? ownerAvatarUrl(owner),
    pushedAt: item.pushed_at ?? null,
    stars: item.stargazers_count ?? 0,
    forks: item.forks_count ?? 0,
    openIssues: item.open_issues_count ?? 0,
    updatedAt: item.updated_at ?? null,
    sizeBytes:
      item.size != null ? Math.max(0, Math.floor(item.size * 1024)) : undefined,
  };
}

export function uniqueRepositories(
  items: GitHubRepositorySearchResult[],
): GitHubRepositorySearchResult[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.fullName.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchRaw(
  query: string,
  sort?: "stars" | "updated",
  options: GitHubApiOptions = {},
): Promise<GitHubRepositorySearchResult[]> {
  const normalized = query.trim().replace(/["']/g, "").replace(/\s+/g, " ");
  const cacheDurationMs = options.cacheDurationMs ?? SEARCH_CACHE_DURATION_MS;

  const params = new URLSearchParams({
    per_page: String(SEARCH_PAGE_SIZE),
    q: normalized,
  });
  if (sort) params.set("sort", sort);

  const path = `/search/repositories?${params.toString()}`;
  const cacheKey = `search:${_token ? "auth" : "anon"}:${normalized}:${sort ?? "default"}`;

  if (cacheDurationMs !== 0) {
    const cached = getCached<GitHubRepositorySearchResult[]>(cacheKey);
    if (cached !== null) return cached;
  }

  const data = await githubFetch<GitHubSearchResponse>(path, {
    signal: options.signal,
    cacheDurationMs: 0, // caching done manually above
  });

  const results = uniqueRepositories(
    (data.items ?? [])
      .map(mapSearchItem)
      .filter((item): item is GitHubRepositorySearchResult => Boolean(item)),
  );

  if (cacheDurationMs !== 0) {
    setCached(cacheKey, results, cacheDurationMs);
  }

  return results;
}

// ─── Trending scoring ──────────────────────────────────────────────────────────

function calculateTrendingScore(repo: GitHubRepositorySearchResult): number {
  const starsWeight = Math.log10(repo.stars + 1) * 25;
  const forksWeight = Math.log10(repo.forks + 1) * 15;
  const issuesPenalty = Math.min(repo.openIssues * 0.15, 15);
  const updatedAt = repo.updatedAt ? new Date(repo.updatedAt).getTime() : 0;
  const pushedAt = repo.pushedAt ? new Date(repo.pushedAt).getTime() : 0;
  const daysSinceUpdate = (Date.now() - updatedAt) / (1000 * 60 * 60 * 24);
  const daysSincePush = (Date.now() - pushedAt) / (1000 * 60 * 60 * 24);
  return (
    starsWeight +
    forksWeight +
    Math.max(0, 35 - daysSinceUpdate) +
    Math.max(0, 25 - daysSincePush) -
    issuesPenalty
  );
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function searchGitHubRepositories(
  query: string,
  options: {
    sort?: "stars" | "updated" | "best-match";
    signal?: AbortSignal;
  } = {},
): Promise<GitHubRepositorySearchResult[]> {
  const normalized = query.trim().replace(/[:"']/g, "").replace(/\s+/g, " ");
  if (normalized.length < 2) return [];
  return searchRaw(
    normalized,
    options.sort === "best-match" ? undefined : options.sort,
    {
      signal: options.signal,
    },
  );
}

export async function fetchTrendingRepositories(
  signal?: AbortSignal,
): Promise<GitHubRepositorySearchResult[]> {
  const query = [
    "stars:>100",
    `pushed:>${daysAgo(14)}`,
    `created:>${daysAgo(365)}`,
  ].join(" ");

  const repositories = await searchRaw(query, "updated", { signal });

  return repositories
    .filter((repo) => {
      if (repo.stars < 100) return false;
      if (!repo.pushedAt) return false;
      const daysSincePush =
        (Date.now() - new Date(repo.pushedAt).getTime()) /
        (1000 * 60 * 60 * 24);
      return daysSincePush <= 30;
    })
    .sort((a, b) => calculateTrendingScore(b) - calculateTrendingScore(a));
}

export async function fetchRepositoryCommits(
  owner: string,
  repo: string,
  branch?: string,
  signal?: AbortSignal,
): Promise<GitHubCommit[]> {
  const params = new URLSearchParams({ per_page: "40" });
  if (branch) params.set("sha", branch);

  const data = await githubFetch<GitHubCommitResponse[]>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${params.toString()}`,
    { signal },
  );

  return data
    .map((item) => ({
      sha: item.sha?.slice(0, 7) ?? "unknown",
      message: (item.commit?.message ?? "No message").split("\n")[0].trim(),
      author: item.commit?.author?.name ?? null,
      date: item.commit?.author?.date ?? null,
      url: item.html_url ?? "",
    }))
    .filter((item) => item.sha !== "unknown");
}

export async function fetchRepositoryBranches(
  owner: string,
  repo: string,
  signal?: AbortSignal,
): Promise<GitHubBranch[]> {
  const data = await githubFetch<GitHubBranchResponse[]>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
    { signal },
  );

  return data
    .map((item) => ({
      name: item.name ?? "unknown",
      commitSha: item.commit?.sha?.slice(0, 7) ?? "unknown",
      protected: Boolean(item.protected),
    }))
    .filter((item) => item.name !== "unknown")
    .sort((a, b) => {
      const priority = (b: GitHubBranch) => {
        if (b.name === "main") return 0;
        if (b.name === "master") return 1;
        if (b.protected) return 2;
        return 3;
      };
      const diff = priority(a) - priority(b);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
}

// ─── Image helpers ─────────────────────────────────────────────────────────────

export const imageExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
]);

export function isImageExtension(extension: string | null): boolean {
  return extension !== null && imageExtensions.has(extension.toLowerCase());
}
