import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { AppConfig } from "../src/config.js";
import { githubMarkPullRequestReadyForReview } from "../src/tools/githubClient.js";

const clientSource = readFileSync(new URL("../src/tools/githubClient.ts", import.meta.url), "utf8");
const mcpSource = readFileSync(new URL("../src/mcp.ts", import.meta.url), "utf8");

const owner = "acme";
const repo = "widgets";
const expectedHeadSha = "a".repeat(40);

type FetchCall = {
  url: string;
  init?: RequestInit;
};

function config(allowedRepos = [`${owner}/${repo}`]): AppConfig {
  return {
    githubToken: "test-token",
    githubAllowedRepos: allowedRepos
  } as AppConfig;
}

function pullRequest(overrides: Record<string, unknown> = {}) {
  return {
    number: 7,
    node_id: "PR_node_7",
    html_url: "https://github.com/acme/widgets/pull/7",
    state: "open",
    title: "Ready review guard",
    head: { ref: "feature/example", sha: expectedHeadSha },
    base: { ref: "main" },
    draft: true,
    merged: false,
    ...overrides
  };
}

async function withMockedFetch(
  responses: unknown[],
  run: (calls: FetchCall[]) => Promise<void>
): Promise<void> {
  const originalFetch = globalThis.fetch;
  const queue = [...responses];
  const calls: FetchCall[] = [];

  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), init });
    const body = queue.shift();
    if (body === undefined) {
      throw new Error("Unexpected fetch call");
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("GitHub mark PR ready client calls GraphQL only after all guards pass", async () => {
  await withMockedFetch(
    [
      pullRequest(),
      {
        data: {
          markPullRequestReadyForReview: {
            pullRequest: {
              number: 7,
              isDraft: false,
              url: "https://github.com/acme/widgets/pull/7"
            }
          }
        }
      }
    ],
    async (calls) => {
      const output = await githubMarkPullRequestReadyForReview(config(), {
        owner,
        repo,
        pr_number: 7,
        expected_head_sha: expectedHeadSha
      });

      assert.equal(output.ready_for_review, true);
      assert.equal(output.head_sha, expectedHeadSha);
      assert.equal(calls.length, 2);
      assert.match(calls[0]?.url ?? "", /\/repos\/acme\/widgets\/pulls\/7$/);
      assert.equal(calls[1]?.url, "https://api.github.com/graphql");

      const graphQlBody = JSON.parse(String(calls[1]?.init?.body));
      assert.deepEqual(graphQlBody.variables, { pullRequestId: "PR_node_7" });
    }
  );
});

test("GitHub mark PR ready rejects a stale expected head without mutation", async () => {
  await withMockedFetch([pullRequest()], async (calls) => {
    await assert.rejects(
      githubMarkPullRequestReadyForReview(config(), {
        owner,
        repo,
        pr_number: 7,
        expected_head_sha: "b".repeat(40)
      }),
      /Pull request head moved/
    );
    assert.equal(calls.length, 1);
  });
});

test("GitHub mark PR ready rejects a non-draft PR without mutation", async () => {
  await withMockedFetch([pullRequest({ draft: false })], async (calls) => {
    await assert.rejects(
      githubMarkPullRequestReadyForReview(config(), {
        owner,
        repo,
        pr_number: 7,
        expected_head_sha: expectedHeadSha
      }),
      /Pull request is not a draft/
    );
    assert.equal(calls.length, 1);
  });
});

test("GitHub mark PR ready rejects a closed PR without mutation", async () => {
  await withMockedFetch([pullRequest({ state: "closed" })], async (calls) => {
    await assert.rejects(
      githubMarkPullRequestReadyForReview(config(), {
        owner,
        repo,
        pr_number: 7,
        expected_head_sha: expectedHeadSha
      }),
      /Pull request must be open/
    );
    assert.equal(calls.length, 1);
  });
});

test("GitHub mark PR ready rejects a merged PR without mutation", async () => {
  await withMockedFetch([pullRequest({ merged: true })], async (calls) => {
    await assert.rejects(
      githubMarkPullRequestReadyForReview(config(), {
        owner,
        repo,
        pr_number: 7,
        expected_head_sha: expectedHeadSha
      }),
      /Pull request is already merged/
    );
    assert.equal(calls.length, 1);
  });
});

test("GitHub mark PR ready rejects a repository outside the allowlist before fetch", async () => {
  await withMockedFetch([], async (calls) => {
    await assert.rejects(
      githubMarkPullRequestReadyForReview(config(), {
        owner: "other",
        repo,
        pr_number: 7,
        expected_head_sha: expectedHeadSha
      }),
      /Repository is not allowlisted/
    );
    assert.equal(calls.length, 0);
  });
});

test("GitHub mark PR ready MCP tool exposes expected_head_sha as a write action", () => {
  const start = mcpSource.indexOf('"github_mark_pr_ready_for_review"');
  assert.notEqual(start, -1, "github_mark_pr_ready_for_review should be registered");

  const block = mcpSource.slice(start, start + 3000);
  assert.match(block, /githubMarkPullRequestReadyForReview/);
  assert.match(block, /readOnlyHint:\s*false/);
  assert.match(block, /pr_number/);
  assert.match(block, /expected_head_sha/);
  assert.match(block, /G3 pass validation/);
});

test("GitHub mark PR ready client keeps the GraphQL mutation contract", () => {
  assert.match(clientSource, /markPullRequestReadyForReview/);
  assert.match(clientSource, /pullRequestId/);
  assert.match(clientSource, /ready_for_review:\s*!/);
});
