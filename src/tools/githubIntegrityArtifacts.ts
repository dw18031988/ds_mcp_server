import { createHash } from "node:crypto";
import type { AppConfig } from "../config.js";

export type GitHubIntegrityArtifactsInput = {
  owner: string;
  repo: string;
  ref?: string;
  exclude_paths?: string[];
};

export type GitHubIntegrityArtifactsResult = {
  owner: string;
  repo: string;
  ref: string;
  commit_sha: string;
  tree_sha: string;
  tree_truncated: boolean;
  excluded_paths: string[];
  included_files: number;
  skipped_entries: Array<{
    path: string;
    type: string;
    reason: string;
    sha?: string;
  }>;
  tree_txt: string;
  sha256sums_txt: string;
};

type GitHubErrorBody = {
  message?: string;
};

type GitHubRepoCommitResponse = {
  sha: string;
};

type GitHubCommitResponse = {
  sha: string;
  tree: {
    sha: string;
    url?: string;
  };
};

type GitHubTreeEntry = {
  path?: string;
  mode?: string;
  type?: string;
  sha?: string;
  size?: number;
  url?: string;
};

type GitHubTreeResponse = {
  sha: string;
  truncated?: boolean;
  tree: GitHubTreeEntry[];
};

type SafeGitHubTreeEntry = GitHubTreeEntry & {
  path: string;
  type: string;
};

type GitHubBlobResponse = {
  sha?: string;
  encoding?: string;
  content?: string;
  size?: number;
};

const DEFAULT_EXCLUDED_PATHS = ["SHA256SUMS.txt", "TREE.txt"];

function requireGitHubToken(config: AppConfig): string {
  if (!config.githubToken) {
    throw new Error("GITHUB_TOKEN is not configured");
  }
  return config.githubToken;
}

function fullRepoName(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

function assertAllowedRepo(config: AppConfig, owner: string, repo: string): void {
  const fullName = fullRepoName(owner, repo);

  if (config.githubAllowedRepos.length === 0) {
    throw new Error("GITHUB_ALLOWED_REPOS is not configured");
  }

  if (!config.githubAllowedRepos.includes(fullName)) {
    throw new Error(`Repository is not allowlisted: ${fullName}`);
  }
}

function assertSafePath(path: string): void {
  if (!path || path.startsWith("/") || path.includes("..") || path.includes("\\")) {
    throw new Error(`Unsafe repository path: ${path}`);
  }
}

function assertCommitSha(value: string, name = "sha"): void {
  if (!/^[0-9a-f]{40}$/i.test(value)) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
}

function normalizeExcludePaths(paths: string[] | undefined): string[] {
  const normalized = [...DEFAULT_EXCLUDED_PATHS, ...(paths ?? [])]
    .map((path) => path.trim())
    .filter(Boolean);

  for (const path of normalized) {
    assertSafePath(path);
  }

  return [...new Set(normalized)].sort((a, b) => a.localeCompare(b));
}

function isExcluded(path: string, excludedPaths: Set<string>): boolean {
  return excludedPaths.has(path);
}

function treeEntryLine(entry: SafeGitHubTreeEntry): string {
  const mode = entry.mode ?? "000000";
  const type = entry.type ?? "unknown";
  const sha = entry.sha ?? "";
  const path = entry.path ?? "";
  const size = entry.size === undefined ? "" : ` ${entry.size}`;
  return `${mode} ${type} ${sha}${size}\t${path}`.trimEnd();
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function githubFetchJson<T>(
  config: AppConfig,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = requireGitHubToken(config);
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    let message = `GitHub API failed: ${response.status}`;

    try {
      const body = (await response.json()) as GitHubErrorBody;
      if (body.message) message = `${message} ${body.message}`;
    } catch {
      // Keep generic message.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

async function resolveCommitAndTree(
  config: AppConfig,
  input: GitHubIntegrityArtifactsInput
): Promise<{ ref: string; commitSha: string; treeSha: string }> {
  const ref = input.ref || config.githubDefaultBaseBranch;
  const commitSha = /^[0-9a-f]{40}$/i.test(ref)
    ? ref
    : (await githubFetchJson<GitHubRepoCommitResponse>(
        config,
        `/repos/${input.owner}/${input.repo}/commits/${encodeURIComponent(ref)}`
      )).sha;

  assertCommitSha(commitSha, "commit_sha");

  const commit = await githubFetchJson<GitHubCommitResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/git/commits/${commitSha}`
  );

  assertCommitSha(commit.sha, "resolved_commit_sha");
  assertCommitSha(commit.tree.sha, "tree_sha");

  return { ref, commitSha: commit.sha, treeSha: commit.tree.sha };
}

async function readBlobBytes(
  config: AppConfig,
  owner: string,
  repo: string,
  sha: string,
  path: string,
  size?: number
): Promise<Buffer> {
  assertCommitSha(sha, "blob_sha");

  if (size !== undefined && size > config.githubMaxFileBytes) {
    throw new Error(
      `Blob exceeds GITHUB_MAX_FILE_BYTES: ${path} is ${size} bytes, limit is ${config.githubMaxFileBytes}`
    );
  }

  const blob = await githubFetchJson<GitHubBlobResponse>(
    config,
    `/repos/${owner}/${repo}/git/blobs/${sha}`
  );

  if (blob.encoding !== "base64" || !blob.content) {
    throw new Error(`Blob is not base64 encoded: ${path}`);
  }

  const buffer = Buffer.from(blob.content.replace(/\n/g, ""), "base64");

  if (buffer.byteLength > config.githubMaxFileBytes) {
    throw new Error(
      `Blob exceeds GITHUB_MAX_FILE_BYTES after decode: ${path} is ${buffer.byteLength} bytes, limit is ${config.githubMaxFileBytes}`
    );
  }

  return buffer;
}

export async function githubGenerateIntegrityArtifacts(
  config: AppConfig,
  input: GitHubIntegrityArtifactsInput
): Promise<GitHubIntegrityArtifactsResult> {
  assertAllowedRepo(config, input.owner, input.repo);

  const excludedPaths = normalizeExcludePaths(input.exclude_paths);
  const excludedPathSet = new Set(excludedPaths);
  const { ref, commitSha, treeSha } = await resolveCommitAndTree(config, input);

  const tree = await githubFetchJson<GitHubTreeResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/git/trees/${treeSha}?recursive=1`
  );

  if (tree.truncated) {
    throw new Error("GitHub tree response was truncated; refusing to generate incomplete integrity artifacts");
  }

  const entries = tree.tree
    .filter((entry): entry is SafeGitHubTreeEntry => Boolean(entry.path && entry.type))
    .sort((a, b) => a.path.localeCompare(b.path));

  const treeLines: string[] = [];
  const shaLines: string[] = [];
  const skippedEntries: GitHubIntegrityArtifactsResult["skipped_entries"] = [];

  for (const entry of entries) {
    assertSafePath(entry.path);
    treeLines.push(treeEntryLine(entry));

    if (entry.type !== "blob") {
      skippedEntries.push({
        path: entry.path,
        type: entry.type,
        reason: entry.type === "commit" ? "submodule-entry" : "non-blob-entry",
        sha: entry.sha
      });
      continue;
    }

    if (isExcluded(entry.path, excludedPathSet)) {
      skippedEntries.push({
        path: entry.path,
        type: entry.type,
        reason: "excluded-path",
        sha: entry.sha
      });
      continue;
    }

    if (!entry.sha) {
      skippedEntries.push({ path: entry.path, type: entry.type, reason: "missing-blob-sha" });
      continue;
    }

    const bytes = await readBlobBytes(
      config,
      input.owner,
      input.repo,
      entry.sha,
      entry.path,
      entry.size
    );
    shaLines.push(`${sha256(bytes)}  ${entry.path}`);
  }

  return {
    owner: input.owner,
    repo: input.repo,
    ref,
    commit_sha: commitSha,
    tree_sha: treeSha,
    tree_truncated: false,
    excluded_paths: excludedPaths,
    included_files: shaLines.length,
    skipped_entries: skippedEntries,
    tree_txt: `${treeLines.join("\n")}\n`,
    sha256sums_txt: `${shaLines.join("\n")}\n`
  };
}
