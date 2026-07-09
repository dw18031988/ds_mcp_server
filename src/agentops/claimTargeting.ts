import type { AsyncTask, AsyncTaskClaimInput, AsyncWorkflow } from "../asyncWorkflowStore.js";

type JsonRecord = Record<string, unknown>;

export const NON_RETRYABLE_CLAIM_FAILURE_REASONS = [
  "wrong_task_claimed",
  "claim_filter_mismatch",
  "claim_target_mismatch"
] as const;

export type NonRetryableClaimFailureReason = (typeof NON_RETRYABLE_CLAIM_FAILURE_REASONS)[number];

export function isNonRetryableClaimFailureReason(reason: unknown): reason is NonRetryableClaimFailureReason {
  return typeof reason === "string" && NON_RETRYABLE_CLAIM_FAILURE_REASONS.includes(reason as NonRetryableClaimFailureReason);
}

export function claimFilterSnapshot(input: AsyncTaskClaimInput): Record<string, unknown> {
  return {
    task_id: input.task_id,
    workflow_id: input.workflow_id,
    repo: input.repo,
    repo_owner: input.repo_owner,
    repo_name: input.repo_name,
    branch: input.branch,
    repo_branch: input.repo_branch,
    pr_number: input.pr_number
  };
}

function contextString(context: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = context[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function contextNumber(context: JsonRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = context[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function splitRepoFullName(repo?: string): { owner?: string; name?: string } {
  if (!repo) return {};
  const [owner, name] = repo.split("/");
  if (!owner || !name) return {};
  return { owner, name };
}

function repoFullName(context: JsonRecord): string | undefined {
  const explicit = contextString(context, ["repo", "repository", "repo_full_name"]);
  if (explicit) return explicit;
  const owner = contextString(context, ["repo_owner", "owner"]);
  const name = contextString(context, ["repo_name", "repository_name"]);
  return owner && name ? `${owner}/${name}` : undefined;
}

function repoOwner(context: JsonRecord, repo?: string): string | undefined {
  return contextString(context, ["repo_owner", "owner"]) ?? splitRepoFullName(repo).owner;
}

function repoName(context: JsonRecord, repo?: string): string | undefined {
  return contextString(context, ["repo_name", "repository_name"]) ?? splitRepoFullName(repo).name;
}

export function mergedClaimContext(task: AsyncTask, workflow?: AsyncWorkflow): JsonRecord {
  return {
    ...(workflow?.context_json ?? {}),
    ...(task.payload_json ?? {})
  };
}

export function taskMatchesClaimFilters(task: AsyncTask, workflow: AsyncWorkflow | undefined, input: AsyncTaskClaimInput): boolean {
  if (input.task_id && task.id !== input.task_id) return false;
  if (input.workflow_id && task.workflow_id !== input.workflow_id) return false;

  const context = mergedClaimContext(task, workflow);
  const repo = repoFullName(context);
  const owner = repoOwner(context, repo);
  const name = repoName(context, repo);
  const branch = contextString(context, ["repo_branch", "work_branch", "branch"]);
  const prNumber = contextNumber(context, ["pr_number", "pull_number", "pull_request_number"]);

  if (input.repo && repo !== input.repo) return false;
  if (input.repo_owner && owner !== input.repo_owner) return false;
  if (input.repo_name && name !== input.repo_name) return false;
  const expectedBranch = input.repo_branch ?? input.branch;
  if (expectedBranch && branch !== expectedBranch) return false;
  if (input.pr_number && prNumber !== input.pr_number) return false;

  return true;
}
