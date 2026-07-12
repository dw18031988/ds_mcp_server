import assert from "node:assert/strict";
import test from "node:test";

import type { AppConfig } from "../src/config.js";
import { githubGenerateIntegrityArtifacts } from "../src/tools/githubIntegrityArtifacts.js";

const owner = "dw18031988";
const repo = "ds_mcp_server";
const commitSha = "a".repeat(40);
const treeSha = "b".repeat(40);
const readmeBlobSha = "c".repeat(40);
const treeTxtBlobSha = "d".repeat(40);
const submoduleSha = "e".repeat(40);

function testConfig(): AppConfig {
  return {
    githubToken: "test-token",
    githubAllowedRepos: [`${owner}/${repo}`],
    githubDefaultBaseBranch: "main",
    githubMaxFileBytes: 1_048_576
  } as unknown as AppConfig;
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function installMockFetch(): Array<string> {
  const calls: Array<string> = [];

  globalThis.fetch = async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const pathname = new URL(url).pathname;
    calls.push(pathname);

    if (pathname === `/repos/${owner}/${repo}/commits/main`) {
      return jsonResponse({ sha: commitSha });
    }

    if (pathname === `/repos/${owner}/${repo}/git/commits/${commitSha}`) {
      return jsonResponse({ sha: commitSha, tree: { sha: treeSha } });
    }

    if (pathname === `/repos/${owner}/${repo}/git/trees/${treeSha}`) {
      return jsonResponse({
        sha: treeSha,
        truncated: false,
        tree: [
          { path: "README.md", mode: "100644", type: "blob", sha: readmeBlobSha, size: 5 },
          { path: "TREE.txt", mode: "100644", type: "blob", sha: treeTxtBlobSha, size: 4 },
          { path: "vendor/tool", mode: "160000", type: "commit", sha: submoduleSha }
        ]
      });
    }

    if (pathname === `/repos/${owner}/${repo}/git/blobs/${readmeBlobSha}`) {
      return jsonResponse({ sha: readmeBlobSha, encoding: "base64", content: Buffer.from("hello").toString("base64") });
    }

    if (pathname === `/repos/${owner}/${repo}/git/blobs/${treeTxtBlobSha}`) {
      return jsonResponse({ sha: treeTxtBlobSha, encoding: "base64", content: Buffer.from("tree").toString("base64") });
    }

    return jsonResponse({ message: `unexpected path: ${pathname}` }, 404);
  };

  return calls;
}

test("generates deterministic TREE and SHA256SUMS without exposing raw archives", async () => {
  const calls = installMockFetch();

  const output = await githubGenerateIntegrityArtifacts(testConfig(), { owner, repo, ref: "main" });

  assert.equal(output.owner, owner);
  assert.equal(output.repo, repo);
  assert.equal(output.ref, "main");
  assert.equal(output.commit_sha, commitSha);
  assert.equal(output.tree_sha, treeSha);
  assert.equal(output.included_files, 1);
  assert.match(output.tree_txt, /100644 blob c{40} 5\tREADME\.md/);
  assert.match(output.tree_txt, /160000 commit e{40}\tvendor\/tool/);
  assert.equal(output.sha256sums_txt, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824  README.md\n");
  assert.deepEqual(output.excluded_paths, ["SHA256SUMS.txt", "TREE.txt"]);
  assert.equal(output.skipped_entries.some((entry) => entry.path === "TREE.txt" && entry.reason === "excluded-path"), true);
  assert.equal(output.skipped_entries.some((entry) => entry.path === "vendor/tool" && entry.reason === "submodule-entry"), true);
  assert.equal(JSON.stringify(output).includes("content_base64"), false);
  assert.equal(JSON.stringify(output).includes("file_name"), false);
  assert.equal(calls.some((path) => path.includes("zipball")), false);
});

test("rejects unallowlisted repositories before calling GitHub", async () => {
  const calls = installMockFetch();

  await assert.rejects(
    () => githubGenerateIntegrityArtifacts({ ...testConfig(), githubAllowedRepos: [] }, { owner, repo }),
    /GITHUB_ALLOWED_REPOS is not configured/
  );

  assert.equal(calls.length, 0);
});

test("rejects unsafe excluded paths", async () => {
  installMockFetch();

  await assert.rejects(
    () => githubGenerateIntegrityArtifacts(testConfig(), { owner, repo, exclude_paths: ["../secret"] }),
    /Unsafe repository path/
  );
});

test("refuses truncated tree responses", async () => {
  globalThis.fetch = async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const pathname = new URL(url).pathname;

    if (pathname === `/repos/${owner}/${repo}/commits/main`) {
      return jsonResponse({ sha: commitSha });
    }

    if (pathname === `/repos/${owner}/${repo}/git/commits/${commitSha}`) {
      return jsonResponse({ sha: commitSha, tree: { sha: treeSha } });
    }

    if (pathname === `/repos/${owner}/${repo}/git/trees/${treeSha}`) {
      return jsonResponse({ sha: treeSha, truncated: true, tree: [] });
    }

    return jsonResponse({ message: `unexpected path: ${pathname}` }, 404);
  };

  await assert.rejects(
    () => githubGenerateIntegrityArtifacts(testConfig(), { owner, repo }),
    /tree response was truncated/
  );
});
