import assert from "node:assert/strict";
import test from "node:test";

import {
  claimFilterSnapshot,
  isNonRetryableClaimFailureReason,
  taskMatchesClaimFilters
} from "../src/agentops/claimTargeting.js";
import type { AsyncTask, AsyncWorkflow } from "../src/asyncWorkflowStore.js";

function workflow(context_json: Record<string, unknown> = {}): AsyncWorkflow {
  return {
    id: "awf_target",
    name: "Target workflow",
    source: "chatgpt",
    status: "running",
    current_task_id: "atask_target",
    context_json,
    created_at: "2026-07-09T00:00:00.000Z",
    updated_at: "2026-07-09T00:00:00.000Z"
  };
}

function task(overrides: Partial<AsyncTask> = {}): AsyncTask {
  return {
    id: "atask_target",
    workflow_id: "awf_target",
    type: "analyze_repo",
    status: "queued",
    payload_json: {},
    retry_count: 0,
    max_retries: 3,
    created_at: "2026-07-09T00:00:00.000Z",
    updated_at: "2026-07-09T00:00:00.000Z",
    ...overrides
  };
}

test("matches exact task, workflow, repo, branch, and PR filters", () => {
  const candidateWorkflow = workflow({
    repo_owner: "dw18031988",
    repo_name: "ds_mcp_server",
    work_branch: "feature/mvp7",
    pr_number: 26
  });

  assert.equal(
    taskMatchesClaimFilters(task(), candidateWorkflow, {
      agent_id: "codex-desktop",
      capabilities: ["analyze_repo"],
      task_id: "atask_target",
      workflow_id: "awf_target",
      repo_owner: "dw18031988",
      repo_name: "ds_mcp_server",
      repo_branch: "feature/mvp7",
      pr_number: 26
    }),
    true
  );
});

test("does not match a different task or workflow", () => {
  const candidateWorkflow = workflow({ repo: "dw18031988/ds_mcp_server" });

  assert.equal(
    taskMatchesClaimFilters(task(), candidateWorkflow, {
      agent_id: "codex-desktop",
      capabilities: ["analyze_repo"],
      task_id: "atask_other"
    }),
    false
  );

  assert.equal(
    taskMatchesClaimFilters(task(), candidateWorkflow, {
      agent_id: "codex-desktop",
      capabilities: ["analyze_repo"],
      workflow_id: "awf_other"
    }),
    false
  );
});

test("parses owner and repo name from full repo context", () => {
  const candidateWorkflow = workflow({
    repo: "dw18031988/ds_mcp_server",
    branch: "feature/mvp7",
    pull_number: "26"
  });

  assert.equal(
    taskMatchesClaimFilters(task(), candidateWorkflow, {
      agent_id: "codex-desktop",
      capabilities: ["analyze_repo"],
      repo_owner: "dw18031988",
      repo_name: "ds_mcp_server",
      branch: "feature/mvp7",
      pr_number: 26
    }),
    true
  );
});

test("task payload overrides workflow context for targeting", () => {
  const candidateWorkflow = workflow({
    repo: "dw18031988/ds_mcp_server",
    branch: "main",
    pr_number: 1
  });

  const candidateTask = task({
    payload_json: {
      repo_branch: "feature/mvp7",
      pr_number: 26
    }
  });

  assert.equal(
    taskMatchesClaimFilters(candidateTask, candidateWorkflow, {
      agent_id: "codex-desktop",
      capabilities: ["analyze_repo"],
      repo: "dw18031988/ds_mcp_server",
      repo_branch: "feature/mvp7",
      pr_number: 26
    }),
    true
  );
});

test("does not relax repo, branch, or PR filters", () => {
  const candidateWorkflow = workflow({
    repo: "dw18031988/ds_mcp_server",
    repo_branch: "feature/mvp7",
    pr_number: 26
  });

  assert.equal(
    taskMatchesClaimFilters(task(), candidateWorkflow, {
      agent_id: "codex-desktop",
      capabilities: ["analyze_repo"],
      repo: "dw18031988/other_repo"
    }),
    false
  );

  assert.equal(
    taskMatchesClaimFilters(task(), candidateWorkflow, {
      agent_id: "codex-desktop",
      capabilities: ["analyze_repo"],
      repo_branch: "feature/other"
    }),
    false
  );

  assert.equal(
    taskMatchesClaimFilters(task(), candidateWorkflow, {
      agent_id: "codex-desktop",
      capabilities: ["analyze_repo"],
      pr_number: 27
    }),
    false
  );
});

test("classifies wrong-claim failures as non-retryable", () => {
  assert.equal(isNonRetryableClaimFailureReason("wrong_task_claimed"), true);
  assert.equal(isNonRetryableClaimFailureReason("claim_filter_mismatch"), true);
  assert.equal(isNonRetryableClaimFailureReason("claim_target_mismatch"), true);
  assert.equal(isNonRetryableClaimFailureReason("network_error"), false);
  assert.equal(isNonRetryableClaimFailureReason(undefined), false);
});

test("captures claim filters for audit events", () => {
  assert.deepEqual(
    claimFilterSnapshot({
      agent_id: "codex-desktop",
      capabilities: ["analyze_repo"],
      task_id: "atask_target",
      workflow_id: "awf_target",
      repo: "dw18031988/ds_mcp_server",
      repo_owner: "dw18031988",
      repo_name: "ds_mcp_server",
      branch: "feature/mvp7",
      repo_branch: "feature/mvp7",
      pr_number: 26
    }),
    {
      task_id: "atask_target",
      workflow_id: "awf_target",
      repo: "dw18031988/ds_mcp_server",
      repo_owner: "dw18031988",
      repo_name: "ds_mcp_server",
      branch: "feature/mvp7",
      repo_branch: "feature/mvp7",
      pr_number: 26
    }
  );
});
