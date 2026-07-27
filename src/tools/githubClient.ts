import type { AppConfig } from "../config.js";

export type GitHubRepoRef = {
  owner: string;
  repo: string;
};

export type GitHubFileResult = {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
  sha?: string;
  content: string;
  encoding: "utf-8";
  html_url?: string;
};

export type GitHubBinaryFileResult = {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
  sha?: string;
  size?: number;
  encoding: "base64";
  content_base64: string;
  html_url?: string;
};

export type GitHubBranchResult = {
  owner: string;
  repo: string;
  branch: string;
  sha: string;
};

export type GitHubUpsertFileInput = GitHubRepoRef & {
  path: string;
  content: string;
  branch: string;
  message: string;
};

export type GitHubApplyTextPatchInput = GitHubRepoRef & {
  path: string;
  branch: string;
  message: string;
  old_text: string;
  new_text: string;
  expected_replacements?: number;
  replace_all?: boolean;
};

export type GitHubCommitFilesInput = GitHubRepoRef & {
  branch: string;
  message: string;
  files?: Array<{ path: string; content: string }>;
  deletions?: string[];
  expected_base_sha?: string;
};

export type GitHubDeleteFileInput = GitHubRepoRef & {
  path: string;
  branch: string;
  message: string;
};

export type GitHubPullRequestInput = GitHubRepoRef & {
  title: string;
  head: string;
  base?: string;
  body?: string;
  draft?: boolean;
};

export type GitHubMergePullRequestInput = GitHubRepoRef & {
  pr_number: number;
  commit_title?: string;
  commit_message?: string;
  merge_method?: "merge" | "squash" | "rebase";
};

export type GitHubMarkPullRequestReadyInput = GitHubRepoRef & {
  pr_number: number;
  expected_head_sha: string;
};

export type GitHubClosePullRequestInput = GitHubRepoRef & {
  pr_number: number;
};

export type GitHubForceUpdateBranchInput = GitHubRepoRef & {
  branch: string;
  sha: string;
  expected_current_sha?: string;
};

export type GitHubWorkflowDispatchInput = GitHubRepoRef & {
  workflow_id: string | number;
  ref: string;
  inputs?: Record<string, string | number | boolean>;
};

export type GitHubBinaryResult = {
  owner: string;
  repo: string;
  file_name: string;
  content_type: string;
  content: Buffer;
};

type GitHubErrorBody = {
  message?: string;
  documentation_url?: string;
  status?: string;
};

export type GitHubApiErrorCode =
  | "GITHUB_UNAUTHORIZED"
  | "GITHUB_FORBIDDEN"
  | "GITHUB_NOT_FOUND"
  | "GITHUB_VALIDATION_FAILED"
  | "GITHUB_RATE_LIMITED"
  | "GITHUB_UPSTREAM_ERROR";

export type GitHubStructuredError = {
  ok: false;
  error: {
    code: GitHubApiErrorCode;
    status: number;
    message: string;
    retryable: boolean;
    documentation_url?: string;
    request_id?: string;
  };
};

export class GitHubApiError extends Error {
  readonly code: GitHubApiErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly documentationUrl?: string;
  readonly requestId?: string;

  constructor(input: {
    code: GitHubApiErrorCode;
    status: number;
    message: string;
    retryable: boolean;
    documentationUrl?: string;
    requestId?: string;
  }) {
    super(input.message);
    this.name = "GitHubApiError";
    this.code = input.code;
    this.status = input.status;
    this.retryable = input.retryable;
    this.documentationUrl = input.documentationUrl;
    this.requestId = input.requestId;
  }
}

function githubErrorCode(status: number, rateLimited = false): GitHubApiErrorCode {
  if (status === 401) return "GITHUB_UNAUTHORIZED";
  if (status === 403 && rateLimited) return "GITHUB_RATE_LIMITED";
  if (status === 403) return "GITHUB_FORBIDDEN";
  if (status === 404) return "GITHUB_NOT_FOUND";
  if (status === 422) return "GITHUB_VALIDATION_FAILED";
  if (status === 429) return "GITHUB_RATE_LIMITED";
  return "GITHUB_UPSTREAM_ERROR";
}

export function githubStructuredError(error: unknown): GitHubStructuredError {
  if (error instanceof GitHubApiError) {
    return {
      ok: false,
      error: {
        code: error.code,
        status: error.status,
        message: error.message,
        retryable: error.retryable,
        ...(error.documentationUrl ? { documentation_url: error.documentationUrl } : {}),
        ...(error.requestId ? { request_id: error.requestId } : {})
      }
    };
  }

  return {
    ok: false,
    error: {
      code: "GITHUB_UPSTREAM_ERROR",
      status: 502,
      message: error instanceof Error ? error.message : "GitHub API failed",
      retryable: true
    }
  };
}

async function githubApiError(response: Response, prefix = "GitHub API failed"): Promise<GitHubApiError> {
  let body: GitHubErrorBody = {};
  try {
    body = (await response.json()) as GitHubErrorBody;
  } catch {
    // Keep a stable error even when GitHub returns a non-JSON body.
  }

  const requestId = response.headers.get("x-github-request-id") || undefined;
  const rateLimited =
    response.status === 429 ||
    response.headers.get("x-ratelimit-remaining") === "0" ||
    /rate limit/i.test(body.message ?? "");
  const message = body.message ? `${prefix}: ${response.status} ${body.message}` : `${prefix}: ${response.status}`;
  return new GitHubApiError({
    code: githubErrorCode(response.status, rateLimited),
    status: response.status,
    message,
    retryable: rateLimited || response.status >= 500,
    documentationUrl: body.documentation_url,
    requestId
  });
}

type GitHubContentResponse = {
  type: string;
  encoding?: string;
  content?: string;
  sha?: string;
  path?: string;
  html_url?: string;
  size?: number;
};

type GitHubRefResponse = {
  ref: string;
  object: {
    sha: string;
    type: string;
    url: string;
  };
};

type GitHubCommitResponse = {
  sha: string;
  html_url?: string;
  tree: {
    sha: string;
    url: string;
  };
};

type GitHubBlobResponse = {
  sha: string;
  url: string;
};

type GitHubTreeResponse = {
  sha: string;
  url: string;
  truncated?: boolean;
  tree: Array<{
    path?: string;
    mode?: string;
    type?: string;
    sha?: string;
    size?: number;
    url?: string;
  }>;
};

type GitHubTreeCreateResponse = {
  sha: string;
  url: string;
  tree: Array<{
    path?: string;
    mode?: string;
    type?: string;
    sha?: string;
    size?: number;
    url?: string;
  }>;
};

type GitHubUpsertResponse = {
  content?: {
    path?: string;
    sha?: string;
    html_url?: string;
  };
  commit?: {
    sha?: string;
    html_url?: string;
  };
};

type GitHubPullResponse = {
  number: number;
  node_id?: string;
  html_url: string;
  state: string;
  title: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  draft?: boolean;
  merged?: boolean;
  mergeable?: boolean | null;
};

type GitHubMergePullResponse = {
  sha: string;
  merged: boolean;
  message: string;
};

type GitHubRepoResponse = {
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  permissions?: Record<string, boolean>;
};

export type GitHubWorkflowRun = {
  id: number;
  workflow_id?: number;
  check_suite_id?: number;
  run_number?: number;
  run_attempt?: number;
  name?: string;
  display_title?: string;
  event?: string;
  head_branch?: string;
  head_sha?: string;
  status?: string;
  conclusion?: string | null;
  html_url?: string;
  jobs_url?: string;
  artifacts_url?: string;
  created_at?: string;
  updated_at?: string;
};

type GitHubWorkflowRunsResponse = {
  total_count: number;
  workflow_runs: GitHubWorkflowRun[];
};

type GitHubWorkflowJobsResponse = {
  total_count: number;
  jobs: Array<{
    id: number;
    run_id: number;
    head_sha?: string;
    html_url?: string | null;
    status?: string;
    conclusion?: string | null;
    created_at?: string;
    started_at?: string;
    completed_at?: string | null;
    name: string;
    steps?: Array<{
      name: string;
      status: string;
      conclusion: string | null;
      number: number;
      started_at?: string | null;
      completed_at?: string | null;
    }>;
    labels?: string[];
    runner_id?: number | null;
    runner_name?: string | null;
  }>;
};

type GitHubCheckRunsResponse = {
  total_count: number;
  check_runs: Array<{
    id: number;
    node_id?: string;
    name: string;
    head_sha: string;
    status: string;
    conclusion: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    html_url?: string | null;
    details_url?: string | null;
    external_id?: string | null;
    app?: { id?: number; slug?: string; name?: string } | null;
    output?: {
      title?: string | null;
      summary?: string | null;
      text?: string | null;
      annotations_count?: number;
    };
  }>;
};

type GitHubArtifactsResponse = {
  total_count: number;
  artifacts: Array<{
    id: number;
    node_id?: string;
    name: string;
    size_in_bytes?: number;
    url?: string;
    archive_download_url?: string;
    expired?: boolean;
    created_at?: string;
    updated_at?: string;
    expires_at?: string;
    workflow_run?: {
      id?: number;
      head_branch?: string;
      head_sha?: string;
    };
  }>;
};

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

function toGitHubContentPath(path: string): string {
  assertSafePath(path);
  return path.split("/").map(encodeURIComponent).join("/");
}

function toGitHubRefPath(branch: string): string {
  return encodeURIComponent(branch);
}

function assertWritableBranch(config: AppConfig, branch: string): void {
  const protectedBranches = new Set(["main", "master", "production", "prod"]);

  if (protectedBranches.has(branch)) {
    throw new Error(`Direct writes to protected branch are blocked: ${branch}`);
  }

  const allowed = config.githubAllowedBranchPrefixes.some((prefix) => branch.startsWith(prefix));

  if (!allowed) {
    throw new Error(
      `Branch must start with one of: ${config.githubAllowedBranchPrefixes.join(", ")}`
    );
  }
}

function assertCommitSha(value: string, name = "sha"): void {
  if (!/^[0-9a-f]{40}$/i.test(value)) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
}

function assertTextByteLimit(config: AppConfig, content: string, path: string): void {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > config.githubMaxFileBytes) {
    throw new Error(
      `File exceeds GITHUB_MAX_FILE_BYTES: ${path} is ${bytes} bytes, limit is ${config.githubMaxFileBytes}`
    );
  }
}

function countOccurrences(text: string, needle: string): number {
  if (!needle) return 0;
  return text.split(needle).length - 1;
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

async function githubFetch<T>(
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
    throw await githubApiError(response);
  }

  return (await response.json()) as T;
}

async function githubGraphqlFetch<T>(
  config: AppConfig,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const token = requireGitHubToken(config);
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL API failed: ${response.status}`);
  }

  const payload = (await response.json()) as { data?: T; errors?: Array<{ message?: string }> };
  if (payload.errors?.length) {
    throw new Error(`GitHub GraphQL API failed: ${payload.errors.map((error) => error.message).join("; ")}`);
  }
  if (!payload.data) {
    throw new Error("GitHub GraphQL API returned no data");
  }

  return payload.data;
}

async function githubFetchNoContent(
  config: AppConfig,
  path: string,
  init: RequestInit = {}
): Promise<void> {
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
    throw await githubApiError(response);
  }
}

async function githubFetchBinary(
  config: AppConfig,
  path: string,
  fileName: string
): Promise<{ content: Buffer; content_type: string; file_name: string }> {
  const token = requireGitHubToken(config);
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    },
    redirect: "follow"
  });

  if (!response.ok) {
    throw await githubApiError(response, "GitHub binary download failed");
  }

  return {
    content: Buffer.from(await response.arrayBuffer()),
    content_type: response.headers.get("content-type") || "application/zip",
    file_name: safeFileName(fileName)
  };
}

async function getBranchRef(
  config: AppConfig,
  owner: string,
  repo: string,
  branch: string
): Promise<GitHubRefResponse> {
  return githubFetch<GitHubRefResponse>(
    config,
    `/repos/${owner}/${repo}/git/ref/heads/${toGitHubRefPath(branch)}`
  );
}

async function getBranchHeadSha(
  config: AppConfig,
  owner: string,
  repo: string,
  branch: string
): Promise<string> {
  const ref = await getBranchRef(config, owner, repo, branch);
  return ref.object.sha;
}

async function resolveCommitSha(
  config: AppConfig,
  owner: string,
  repo: string,
  ref: string
): Promise<string> {
  if (/^[0-9a-f]{40}$/i.test(ref)) return ref;
  return getBranchHeadSha(config, owner, repo, ref);
}

async function tryGetFileSha(
  config: AppConfig,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | undefined> {
  try {
    const file = await githubFetch<GitHubContentResponse>(
      config,
      `/repos/${owner}/${repo}/contents/${toGitHubContentPath(path)}?ref=${encodeURIComponent(ref)}`
    );
    return file.sha;
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return undefined;
    }
    throw error;
  }
}

export async function githubGetRepo(config: AppConfig, input: GitHubRepoRef) {
  assertAllowedRepo(config, input.owner, input.repo);

  const repo = await githubFetch<GitHubRepoResponse>(
    config,
    `/repos/${input.owner}/${input.repo}`
  );

  return {
    full_name: repo.full_name,
    private: repo.private,
    default_branch: repo.default_branch,
    html_url: repo.html_url,
    permissions: repo.permissions ?? {}
  };
}

export async function githubReadFile(
  config: AppConfig,
  input: GitHubRepoRef & { path: string; ref?: string }
): Promise<GitHubFileResult> {
  assertAllowedRepo(config, input.owner, input.repo);
  assertSafePath(input.path);

  const query = input.ref ? `?ref=${encodeURIComponent(input.ref)}` : "";
  const file = await githubFetch<GitHubContentResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/contents/${toGitHubContentPath(input.path)}${query}`
  );

  if (file.type !== "file" || file.encoding !== "base64" || !file.content) {
    throw new Error(`Path is not a UTF-8 file: ${input.path}`);
  }

  return {
    owner: input.owner,
    repo: input.repo,
    path: file.path ?? input.path,
    ref: input.ref,
    sha: file.sha,
    content: Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8"),
    encoding: "utf-8",
    html_url: file.html_url
  };
}

export async function githubReadBinaryFile(
  config: AppConfig,
  input: GitHubRepoRef & { path: string; ref?: string }
): Promise<GitHubBinaryFileResult> {
  assertAllowedRepo(config, input.owner, input.repo);
  assertSafePath(input.path);

  const query = input.ref ? `?ref=${encodeURIComponent(input.ref)}` : "";
  const file = await githubFetch<GitHubContentResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/contents/${toGitHubContentPath(input.path)}${query}`
  );

  if (file.type !== "file" || file.encoding !== "base64" || !file.content) {
    throw new Error(`Path is not a base64 file response: ${input.path}`);
  }

  return {
    owner: input.owner,
    repo: input.repo,
    path: file.path ?? input.path,
    ref: input.ref,
    sha: file.sha,
    size: file.size,
    encoding: "base64",
    content_base64: file.content.replace(/\n/g, ""),
    html_url: file.html_url
  };
}

export async function githubListTree(
  config: AppConfig,
  input: GitHubRepoRef & { ref?: string; recursive?: boolean }
) {
  assertAllowedRepo(config, input.owner, input.repo);

  const ref = input.ref || config.githubDefaultBaseBranch;
  const commitSha = await resolveCommitSha(config, input.owner, input.repo, ref);
  const commit = await githubFetch<GitHubCommitResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/git/commits/${commitSha}`
  );

  const params = new URLSearchParams();
  if (input.recursive ?? true) params.set("recursive", "1");

  const tree = await githubFetch<GitHubTreeResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/git/trees/${commit.tree.sha}?${params.toString()}`
  );

  return {
    owner: input.owner,
    repo: input.repo,
    ref,
    commit_sha: commitSha,
    tree_sha: tree.sha,
    truncated: tree.truncated ?? false,
    tree: tree.tree.map((item) => ({
      path: item.path,
      mode: item.mode,
      type: item.type,
      sha: item.sha,
      size: item.size,
      url: item.url
    }))
  };
}

export async function githubCreateBranch(
  config: AppConfig,
  input: GitHubRepoRef & { branch: string; from_branch?: string }
): Promise<GitHubBranchResult> {
  assertAllowedRepo(config, input.owner, input.repo);
  assertWritableBranch(config, input.branch);

  const fromBranch = input.from_branch || config.githubDefaultBaseBranch;
  const baseRef = await getBranchRef(config, input.owner, input.repo, fromBranch);

  await githubFetch<GitHubRefResponse>(config, `/repos/${input.owner}/${input.repo}/git/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ref: `refs/heads/${input.branch}`,
      sha: baseRef.object.sha
    })
  });

  return {
    owner: input.owner,
    repo: input.repo,
    branch: input.branch,
    sha: baseRef.object.sha
  };
}

export async function githubUpsertFile(
  config: AppConfig,
  input: GitHubUpsertFileInput
) {
  assertAllowedRepo(config, input.owner, input.repo);
  assertSafePath(input.path);
  assertWritableBranch(config, input.branch);
  assertTextByteLimit(config, input.content, input.path);

  const existingSha = await tryGetFileSha(
    config,
    input.owner,
    input.repo,
    input.path,
    input.branch
  );

  const payload: Record<string, unknown> = {
    message: input.message,
    content: Buffer.from(input.content, "utf8").toString("base64"),
    branch: input.branch
  };

  if (existingSha) payload.sha = existingSha;

  const result = await githubFetch<GitHubUpsertResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/contents/${toGitHubContentPath(input.path)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  return {
    owner: input.owner,
    repo: input.repo,
    path: input.path,
    branch: input.branch,
    content_sha: result.content?.sha,
    commit_sha: result.commit?.sha,
    html_url: result.content?.html_url
  };
}

export async function githubApplyTextPatch(
  config: AppConfig,
  input: GitHubApplyTextPatchInput
) {
  assertAllowedRepo(config, input.owner, input.repo);
  assertSafePath(input.path);
  assertWritableBranch(config, input.branch);

  if (!input.old_text) {
    throw new Error("old_text must not be empty");
  }

  const current = await githubReadFile(config, {
    owner: input.owner,
    repo: input.repo,
    path: input.path,
    ref: input.branch
  });

  const actual = countOccurrences(current.content, input.old_text);
  const expected = input.expected_replacements ?? 1;

  if (actual !== expected) {
    throw new Error(
      `Patch guard failed for ${input.path}: expected ${expected} occurrence(s), found ${actual}`
    );
  }

  const nextContent = input.replace_all
    ? current.content.split(input.old_text).join(input.new_text)
    : current.content.replace(input.old_text, input.new_text);

  assertTextByteLimit(config, nextContent, input.path);

  const output = await githubUpsertFile(config, {
    owner: input.owner,
    repo: input.repo,
    path: input.path,
    content: nextContent,
    branch: input.branch,
    message: input.message
  });

  return {
    ...output,
    previous_sha: current.sha,
    replacements: actual
  };
}

export async function githubCommitFiles(config: AppConfig, input: GitHubCommitFilesInput) {
  assertAllowedRepo(config, input.owner, input.repo);
  assertWritableBranch(config, input.branch);

  const files = input.files ?? [];
  const deletions = input.deletions ?? [];

  if (files.length === 0 && deletions.length === 0) {
    throw new Error("At least one file or deletion is required");
  }

  for (const file of files) {
    assertSafePath(file.path);
    assertTextByteLimit(config, file.content, file.path);
  }

  for (const path of deletions) {
    assertSafePath(path);
  }

  const baseRef = await getBranchRef(config, input.owner, input.repo, input.branch);
  const baseSha = baseRef.object.sha;

  if (input.expected_base_sha && input.expected_base_sha !== baseSha) {
    throw new Error(
      `Branch moved: expected base ${input.expected_base_sha}, current base is ${baseSha}`
    );
  }

  const baseCommit = await githubFetch<GitHubCommitResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/git/commits/${baseSha}`
  );

  const treeEntries: Array<{
    path: string;
    mode: "100644";
    type: "blob";
    sha: string | null;
  }> = [];

  for (const file of files) {
    const blob = await githubFetch<GitHubBlobResponse>(
      config,
      `/repos/${input.owner}/${input.repo}/git/blobs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: Buffer.from(file.content, "utf8").toString("base64"),
          encoding: "base64"
        })
      }
    );

    treeEntries.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha
    });
  }

  for (const path of deletions) {
    treeEntries.push({
      path,
      mode: "100644",
      type: "blob",
      sha: null
    });
  }

  const newTree = await githubFetch<GitHubTreeCreateResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/git/trees`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_tree: baseCommit.tree.sha,
        tree: treeEntries
      })
    }
  );

  const newCommit = await githubFetch<GitHubCommitResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/git/commits`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.message,
        tree: newTree.sha,
        parents: [baseSha]
      })
    }
  );

  await githubFetch<GitHubRefResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/git/refs/heads/${toGitHubRefPath(input.branch)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sha: newCommit.sha,
        force: false
      })
    }
  );

  return {
    owner: input.owner,
    repo: input.repo,
    branch: input.branch,
    base_sha: baseSha,
    commit_sha: newCommit.sha,
    tree_sha: newTree.sha,
    files: files.map((file) => file.path),
    deletions,
    html_url: newCommit.html_url
  };
}

export async function githubDeleteFile(config: AppConfig, input: GitHubDeleteFileInput) {
  assertAllowedRepo(config, input.owner, input.repo);
  assertSafePath(input.path);
  assertWritableBranch(config, input.branch);

  const existingSha = await tryGetFileSha(
    config,
    input.owner,
    input.repo,
    input.path,
    input.branch
  );

  if (!existingSha) {
    throw new Error(`File does not exist on ${input.branch}: ${input.path}`);
  }

  const result = await githubFetch<GitHubUpsertResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/contents/${toGitHubContentPath(input.path)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.message,
        sha: existingSha,
        branch: input.branch
      })
    }
  );

  return {
    owner: input.owner,
    repo: input.repo,
    path: input.path,
    branch: input.branch,
    deleted_sha: existingSha,
    commit_sha: result.commit?.sha,
    html_url: result.commit?.html_url
  };
}

export async function githubCreatePullRequest(config: AppConfig, input: GitHubPullRequestInput) {
  assertAllowedRepo(config, input.owner, input.repo);
  assertWritableBranch(config, input.head);

  const pr = await githubFetch<GitHubPullResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/pulls`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        head: input.head,
        base: input.base || config.githubDefaultBaseBranch,
        body: input.body || "",
        draft: input.draft ?? false,
        maintainer_can_modify: true
      })
    }
  );

  return {
    number: pr.number,
    html_url: pr.html_url,
    state: pr.state,
    title: pr.title,
    head: pr.head,
    base: pr.base
  };
}

export async function githubMergePullRequest(config: AppConfig, input: GitHubMergePullRequestInput) {
  assertAllowedRepo(config, input.owner, input.repo);

  const merge = await githubFetch<GitHubMergePullResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/pulls/${input.pr_number}/merge`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commit_title: input.commit_title,
        commit_message: input.commit_message,
        merge_method: input.merge_method || "squash"
      })
    }
  );

  return {
    owner: input.owner,
    repo: input.repo,
    pr_number: input.pr_number,
    ...merge
  };
}

export async function githubMarkPullRequestReadyForReview(
  config: AppConfig,
  input: GitHubMarkPullRequestReadyInput
) {
  assertAllowedRepo(config, input.owner, input.repo);
  assertCommitSha(input.expected_head_sha, "expected_head_sha");

  const pr = await githubFetch<GitHubPullResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/pulls/${input.pr_number}`
  );

  const pullRequestRef = `${input.owner}/${input.repo}#${input.pr_number}`;

  if (pr.state !== "open") {
    throw new Error(`Pull request must be open: ${pullRequestRef} is ${pr.state}`);
  }

  if (pr.merged) {
    throw new Error(`Pull request is already merged: ${pullRequestRef}`);
  }

  if (pr.draft !== true) {
    throw new Error(`Pull request is not a draft: ${pullRequestRef}`);
  }

  if (pr.head.sha !== input.expected_head_sha) {
    throw new Error(
      `Pull request head moved: expected ${input.expected_head_sha}, actual ${pr.head.sha}`
    );
  }

  if (!pr.node_id) {
    throw new Error(`Pull request node_id is missing: ${pullRequestRef}`);
  }

  type MarkReadyResult = {
    markPullRequestReadyForReview: {
      pullRequest: {
        number: number;
        isDraft: boolean;
        url: string;
      };
    };
  };

  const data = await githubGraphqlFetch<MarkReadyResult>(
    config,
    `mutation MarkPullRequestReadyForReview($pullRequestId: ID!) {
      markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
        pullRequest { number isDraft url }
      }
    }`,
    { pullRequestId: pr.node_id }
  );

  return {
    ok: true,
    owner: input.owner,
    repo: input.repo,
    pr_number: data.markPullRequestReadyForReview.pullRequest.number,
    head_sha: pr.head.sha,
    html_url: data.markPullRequestReadyForReview.pullRequest.url,
    ready_for_review: !data.markPullRequestReadyForReview.pullRequest.isDraft
  };
}

export async function githubClosePullRequest(config: AppConfig, input: GitHubClosePullRequestInput) {
  assertAllowedRepo(config, input.owner, input.repo);

  const pr = await githubFetch<GitHubPullResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/pulls/${input.pr_number}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: "closed" })
    }
  );

  return {
    number: pr.number,
    html_url: pr.html_url,
    state: pr.state,
    title: pr.title,
    head: pr.head,
    base: pr.base
  };
}

export async function githubForceUpdateBranch(config: AppConfig, input: GitHubForceUpdateBranchInput) {
  assertAllowedRepo(config, input.owner, input.repo);
  assertWritableBranch(config, input.branch);
  assertCommitSha(input.sha);

  if (input.expected_current_sha) {
    assertCommitSha(input.expected_current_sha, "expected_current_sha");
  }

  const currentRef = await getBranchRef(config, input.owner, input.repo, input.branch);
  const currentSha = currentRef.object.sha;

  if (input.expected_current_sha && input.expected_current_sha !== currentSha) {
    throw new Error(
      `Branch moved: expected current ${input.expected_current_sha}, actual current is ${currentSha}`
    );
  }

  const nextRef = await githubFetch<GitHubRefResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/git/refs/heads/${toGitHubRefPath(input.branch)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sha: input.sha,
        force: true
      })
    }
  );

  return {
    owner: input.owner,
    repo: input.repo,
    branch: input.branch,
    previous_sha: currentSha,
    sha: nextRef.object.sha,
    forced: true
  };
}

export async function githubDispatchWorkflow(config: AppConfig, input: GitHubWorkflowDispatchInput) {
  assertAllowedRepo(config, input.owner, input.repo);

  await githubFetchNoContent(
    config,
    `/repos/${input.owner}/${input.repo}/actions/workflows/${encodeURIComponent(
      String(input.workflow_id)
    )}/dispatches`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: input.ref,
        inputs: input.inputs ?? {}
      })
    }
  );

  return {
    ok: true,
    owner: input.owner,
    repo: input.repo,
    workflow_id: input.workflow_id,
    ref: input.ref,
    dispatched: true
  };
}

function boundedPage(value: number | undefined): number {
  return Math.max(value ?? 1, 1);
}

function boundedPerPage(value: number | undefined, fallback: number, maximum: number): number {
  return Math.min(Math.max(value ?? fallback, 1), maximum);
}

function paginationMetadata(totalCount: number, page: number, perPage: number) {
  return {
    page,
    per_page: perPage,
    has_next_page: page * perPage < totalCount
  };
}

export type GitHubWorkflowRunsInput = GitHubRepoRef & {
  workflow_id?: string | number;
  branch?: string;
  event?: string;
  status?: string;
  head_sha?: string;
  check_suite_id?: number;
  page?: number;
  per_page?: number;
};

export async function githubListWorkflowRuns(
  config: AppConfig,
  input: GitHubWorkflowRunsInput
) {
  assertAllowedRepo(config, input.owner, input.repo);

  const page = boundedPage(input.page);
  const perPage = boundedPerPage(input.per_page, 30, 100);
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (input.branch) params.set("branch", input.branch);
  if (input.event) params.set("event", input.event);
  if (input.status) params.set("status", input.status);
  if (input.head_sha) params.set("head_sha", input.head_sha);
  if (input.check_suite_id !== undefined) params.set("check_suite_id", String(input.check_suite_id));

  const workflowPath = input.workflow_id === undefined
    ? "actions/runs"
    : `actions/workflows/${encodeURIComponent(String(input.workflow_id))}/runs`;
  const response = await githubFetch<GitHubWorkflowRunsResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/${workflowPath}?${params.toString()}`
  );
  const workflowRuns = input.head_sha
    ? response.workflow_runs.filter((run) => run.head_sha === input.head_sha)
    : response.workflow_runs;

  return {
    ...response,
    workflow_runs: workflowRuns,
    matched_count: workflowRuns.length,
    filters: {
      workflow_id: input.workflow_id,
      branch: input.branch,
      event: input.event,
      status: input.status,
      head_sha: input.head_sha,
      check_suite_id: input.check_suite_id
    },
    ...paginationMetadata(response.total_count, page, perPage)
  };
}

export async function githubGetWorkflowRuns(
  config: AppConfig,
  input: GitHubWorkflowRunsInput
) {
  return githubListWorkflowRuns(config, input);
}

export async function githubGetWorkflowRun(
  config: AppConfig,
  input: GitHubRepoRef & { run_id: number; expected_head_sha?: string }
) {
  assertAllowedRepo(config, input.owner, input.repo);

  const run = await githubFetch<GitHubWorkflowRun>(
    config,
    `/repos/${input.owner}/${input.repo}/actions/runs/${input.run_id}`
  );

  if (input.expected_head_sha && run.head_sha !== input.expected_head_sha) {
    throw new GitHubApiError({
      code: "GITHUB_VALIDATION_FAILED",
      status: 409,
      message: `Workflow run head SHA mismatch: expected ${input.expected_head_sha}, actual ${run.head_sha ?? "missing"}`,
      retryable: false
    });
  }

  return run;
}

export async function githubListWorkflowRunJobs(
  config: AppConfig,
  input: GitHubRepoRef & {
    run_id: number;
    filter?: "latest" | "all";
    page?: number;
    per_page?: number;
  }
) {
  assertAllowedRepo(config, input.owner, input.repo);

  const page = boundedPage(input.page);
  const perPage = boundedPerPage(input.per_page, 30, 100);
  const params = new URLSearchParams({
    filter: input.filter ?? "latest",
    page: String(page),
    per_page: String(perPage)
  });
  const response = await githubFetch<GitHubWorkflowJobsResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/actions/runs/${input.run_id}/jobs?${params.toString()}`
  );

  return {
    ...response,
    ...paginationMetadata(response.total_count, page, perPage)
  };
}

export async function githubListWorkflowRunArtifacts(
  config: AppConfig,
  input: GitHubRepoRef & { run_id: number; page?: number; per_page?: number }
) {
  assertAllowedRepo(config, input.owner, input.repo);

  const page = boundedPage(input.page);
  const perPage = boundedPerPage(input.per_page, 30, 100);
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  const response = await githubFetch<GitHubArtifactsResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/actions/runs/${input.run_id}/artifacts?${params.toString()}`
  );

  return {
    ...response,
    ...paginationMetadata(response.total_count, page, perPage)
  };
}

export async function githubListCheckRunsForRef(
  config: AppConfig,
  input: GitHubRepoRef & {
    ref: string;
    check_name?: string;
    status?: "queued" | "in_progress" | "completed";
    filter?: "latest" | "all";
    app_id?: number;
    page?: number;
    per_page?: number;
  }
) {
  assertAllowedRepo(config, input.owner, input.repo);

  const page = boundedPage(input.page);
  const perPage = boundedPerPage(input.per_page, 30, 100);
  const params = new URLSearchParams({
    filter: input.filter ?? "latest",
    page: String(page),
    per_page: String(perPage)
  });
  if (input.check_name) params.set("check_name", input.check_name);
  if (input.status) params.set("status", input.status);
  if (input.app_id !== undefined) params.set("app_id", String(input.app_id));

  const response = await githubFetch<GitHubCheckRunsResponse>(
    config,
    `/repos/${input.owner}/${input.repo}/commits/${encodeURIComponent(input.ref)}/check-runs?${params.toString()}`
  );
  const isExactSha = /^[0-9a-f]{40}$/i.test(input.ref);
  const checkRuns = isExactSha
    ? response.check_runs.filter((run) => run.head_sha.toLowerCase() === input.ref.toLowerCase())
    : response.check_runs;

  return {
    ...response,
    check_runs: checkRuns,
    matched_count: checkRuns.length,
    ref: input.ref,
    ...paginationMetadata(response.total_count, page, perPage)
  };
}

export async function githubDownloadWorkflowArtifactZip(
  config: AppConfig,
  input: GitHubRepoRef & { artifact_id: number }
): Promise<GitHubBinaryResult> {
  assertAllowedRepo(config, input.owner, input.repo);

  const result = await githubFetchBinary(
    config,
    `/repos/${input.owner}/${input.repo}/actions/artifacts/${input.artifact_id}/zip`,
    `${input.repo}-artifact-${input.artifact_id}.zip`
  );

  return {
    owner: input.owner,
    repo: input.repo,
    ...result
  };
}

export async function githubDownloadArchiveZip(
  config: AppConfig,
  input: GitHubRepoRef & { ref?: string }
): Promise<GitHubBinaryResult> {
  assertAllowedRepo(config, input.owner, input.repo);

  const ref = input.ref || config.githubDefaultBaseBranch;
  const result = await githubFetchBinary(
    config,
    `/repos/${input.owner}/${input.repo}/zipball/${encodeURIComponent(ref)}`,
    `${input.repo}-${safeFileName(ref)}.zip`
  );

  return {
    owner: input.owner,
    repo: input.repo,
    ...result
  };
}

export async function githubCommentPullRequest(
  config: AppConfig,
  input: GitHubRepoRef & { pr_number: number; body: string }
) {
  assertAllowedRepo(config, input.owner, input.repo);

  const comment = await githubFetch<{ id: number; html_url: string; body: string }>(
    config,
    `/repos/${input.owner}/${input.repo}/issues/${input.pr_number}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: input.body })
    }
  );

  return {
    id: comment.id,
    html_url: comment.html_url,
    body: comment.body
  };
}
