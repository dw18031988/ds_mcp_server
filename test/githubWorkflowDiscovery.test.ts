import assert from "node:assert/strict";
import test from "node:test";

import type { AppConfig } from "../src/config.js";
import {
  GitHubApiError,
  githubGetWorkflowRun,
  githubListCheckRunsForRef,
  githubListWorkflowRunArtifacts,
  githubListWorkflowRunJobs,
  githubListWorkflowRuns,
  githubStructuredError
} from "../src/tools/githubClient.js";

const owner = "dw18031988";
const repo = "ds_mcp_server";
const headSha = "a".repeat(40);
const otherSha = "b".repeat(40);

function config(): AppConfig {
  return {
    githubToken: "test-token",
    githubAllowedRepos: [`${owner}/${repo}`],
    githubDefaultBaseBranch: "main"
  } as unknown as AppConfig;
}

function jsonResponse(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

function requestUrl(input: string | URL | Request): URL {
  const value = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  return new URL(value);
}

test("discovers exact push workflow runs with filters and pagination", async () => {
  let captured: URL | undefined;
  globalThis.fetch = async (input: string | URL | Request) => {
    captured = requestUrl(input);
    return jsonResponse({
      total_count: 51,
      workflow_runs: [
        { id: 101, event: "push", head_branch: "main", head_sha: headSha, status: "completed" },
        { id: 102, event: "push", head_branch: "main", head_sha: otherSha, status: "completed" }
      ]
    });
  };

  const output = await githubListWorkflowRuns(config(), {
    owner,
    repo,
    event: "push",
    branch: "main",
    head_sha: headSha,
    status: "completed",
    check_suite_id: 77,
    page: 2,
    per_page: 25
  });

  assert.equal(captured?.pathname, `/repos/${owner}/${repo}/actions/runs`);
  assert.equal(captured?.searchParams.get("event"), "push");
  assert.equal(captured?.searchParams.get("branch"), "main");
  assert.equal(captured?.searchParams.get("head_sha"), headSha);
  assert.equal(captured?.searchParams.get("status"), "completed");
  assert.equal(captured?.searchParams.get("check_suite_id"), "77");
  assert.equal(captured?.searchParams.get("page"), "2");
  assert.equal(captured?.searchParams.get("per_page"), "25");
  assert.equal(output.workflow_runs.length, 1);
  assert.equal(output.workflow_runs[0]?.id, 101);
  assert.equal(output.matched_count, 1);
  assert.equal(output.has_next_page, true);
});

test("supports workflow-specific run collection", async () => {
  let captured: URL | undefined;
  globalThis.fetch = async (input: string | URL | Request) => {
    captured = requestUrl(input);
    return jsonResponse({ total_count: 0, workflow_runs: [] });
  };

  await githubListWorkflowRuns(config(), {
    owner,
    repo,
    workflow_id: "ci.yml",
    page: 3,
    per_page: 10
  });

  assert.equal(captured?.pathname, `/repos/${owner}/${repo}/actions/workflows/ci.yml/runs`);
  assert.equal(captured?.searchParams.get("page"), "3");
});

test("direct run lookup rejects a stale head SHA", async () => {
  globalThis.fetch = async () => jsonResponse({ id: 201, head_sha: otherSha, status: "completed" });

  await assert.rejects(
    () => githubGetWorkflowRun(config(), { owner, repo, run_id: 201, expected_head_sha: headSha }),
    (error: unknown) => {
      assert.equal(error instanceof GitHubApiError, true);
      const structured = githubStructuredError(error);
      assert.equal(structured.error.code, "GITHUB_VALIDATION_FAILED");
      assert.equal(structured.error.status, 409);
      assert.equal(structured.error.retryable, false);
      return true;
    }
  );
});

test("paginates workflow jobs and artifacts", async () => {
  const calls: URL[] = [];
  globalThis.fetch = async (input: string | URL | Request) => {
    const url = requestUrl(input);
    calls.push(url);
    if (url.pathname.endsWith("/jobs")) {
      return jsonResponse({ total_count: 101, jobs: [{ id: 1, run_id: 301, name: "test" }] });
    }
    return jsonResponse({ total_count: 31, artifacts: [{ id: 2, name: "evidence" }] });
  };

  const jobs = await githubListWorkflowRunJobs(config(), {
    owner,
    repo,
    run_id: 301,
    filter: "all",
    page: 2,
    per_page: 50
  });
  const artifacts = await githubListWorkflowRunArtifacts(config(), {
    owner,
    repo,
    run_id: 301,
    page: 2,
    per_page: 20
  });

  assert.equal(calls[0]?.searchParams.get("filter"), "all");
  assert.equal(calls[0]?.searchParams.get("page"), "2");
  assert.equal(jobs.has_next_page, true);
  assert.equal(calls[1]?.searchParams.get("page"), "2");
  assert.equal(artifacts.has_next_page, false);
});

test("check-run fallback filters exact commit evidence", async () => {
  let captured: URL | undefined;
  globalThis.fetch = async (input: string | URL | Request) => {
    captured = requestUrl(input);
    return jsonResponse({
      total_count: 2,
      check_runs: [
        { id: 401, name: "CI", head_sha: headSha, status: "completed", conclusion: "success" },
        { id: 402, name: "CI", head_sha: otherSha, status: "completed", conclusion: "success" }
      ]
    });
  };

  const output = await githubListCheckRunsForRef(config(), {
    owner,
    repo,
    ref: headSha,
    status: "completed",
    filter: "all",
    page: 1,
    per_page: 100
  });

  assert.equal(captured?.pathname, `/repos/${owner}/${repo}/commits/${headSha}/check-runs`);
  assert.equal(captured?.searchParams.get("status"), "completed");
  assert.equal(output.check_runs.length, 1);
  assert.equal(output.check_runs[0]?.id, 401);
  assert.equal(output.matched_count, 1);
});

test("GitHub failures preserve status and request ID without exposing tokens", async () => {
  globalThis.fetch = async () =>
    jsonResponse(
      { message: "rate limit exceeded", documentation_url: "https://docs.github.com/rest" },
      429,
      { "x-github-request-id": "REQ-123" }
    );

  await assert.rejects(
    () => githubListWorkflowRuns(config(), { owner, repo }),
    (error: unknown) => {
      const structured = githubStructuredError(error);
      const serialized = JSON.stringify(structured);
      assert.equal(structured.error.code, "GITHUB_RATE_LIMITED");
      assert.equal(structured.error.status, 429);
      assert.equal(structured.error.retryable, true);
      assert.equal(structured.error.request_id, "REQ-123");
      assert.equal(serialized.includes("test-token"), false);
      return true;
    }
  );
});
