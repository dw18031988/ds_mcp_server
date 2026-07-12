import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";

import { loadConfig, type AppConfig } from "../src/config.js";
import { createAsyncWorkflow, submitAsyncTaskResult } from "../src/asyncWorkflowStore.js";
import { handleAgentOpsRestApi } from "../src/agentops/router.js";
import { getWorkflowStatus, projectWorkflowStatus, type WorkflowStatusResponse } from "../src/agentops/workflowStatusService.js";

function baseConfig(): AppConfig {
  return {
    ...loadConfig(),
    securityEnforcement: "relaxed",
    rateLimitWindowMs: 1_000,
    rateLimitMaxRequests: 1,
    restApiBearerToken: "rest-token",
    mcpBearerToken: "mcp-token",
    workspaceAgentCallbackToken: undefined,
    corsAllowedOrigins: ["https://chatgpt.com"]
  };
}

function mockRequest(): IncomingMessage {
  return {
    method: "GET",
    headers: {},
    socket: { remoteAddress: "127.0.0.1" }
  } as IncomingMessage;
}

test("projects compact workflow status with progress and attention metadata", () => {
  const status = projectWorkflowStatus({
    workflow: {
      id: "awf_status",
      status: "running",
      current_task_id: "atask_current",
      context_json: { paused: false },
      created_at: "2026-07-10T00:00:00.000Z",
      updated_at: "2026-07-10T00:05:00.000Z"
    },
    tasks: [
      {
        id: "atask_done",
        type: "analyze_repo",
        status: "succeeded"
      },
      {
        id: "atask_current",
        type: "wait_github_ci",
        status: "leased",
        lease_expires_at: "2026-07-10T00:01:00.000Z"
      },
      {
        id: "atask_wait",
        type: "wait_github_ci",
        status: "waiting_external"
      }
    ],
    events: [
      {
        event_type: "github_ci_match_ambiguous",
        data_json: { reason: "ambiguous_ci_match" }
      }
    ]
  });

  assert.deepEqual(status.progress, { done: 1, total: 3 });
  assert.equal(status.current_task?.id, "atask_current");
  assert.equal(status.current_task?.needs_attention, true);
  assert.equal(status.needs_attention, true);
  assert.equal(status.attention_reasons?.includes("expired_lease"), true);
  assert.equal(status.attention_reasons?.includes("unresolved_external_wait"), true);
  assert.equal(status.attention_reasons?.includes("ambiguous_ci_match"), true);
  assert.equal("tasks" in status, false);
  assert.equal("events" in status, false);
});

test("returns compact workflow status from in-memory workflow state", async () => {
  const config = baseConfig();
  const created = await createAsyncWorkflow(config, {
    name: "Status workflow",
    source: "chatgpt",
    input: { repo: "dw18031988/ds_mcp_server" }
  });

  await submitAsyncTaskResult(config, created.task.id, {
    status: "succeeded",
    summary: "Created plan"
  });

  const status = await getWorkflowStatus(config, created.workflow.id);
  assert.ok(status);
  if (!status) return;

  assert.equal(status.workflow_id, created.workflow.id);
  assert.equal(status.progress.done, 1);
  assert.equal(status.progress.total, 2);
  assert.equal(status.current_task?.needs_attention, false);
  assert.equal(status.needs_attention, false);
  assert.equal("tasks" in status, false);
  assert.equal("events" in status, false);
});

test("returns workflow status through the agentops router", async () => {
  const config = baseConfig();
  const created = await createAsyncWorkflow(config, {
    name: "Router status workflow",
    source: "system",
    input: { repo: "dw18031988/ds_mcp_server" }
  });

  let responseStatus: number | undefined;
  let responseBody: unknown;

  const handled = await handleAgentOpsRestApi(
    mockRequest(),
    {} as ServerResponse,
    new URL(`https://example.com/api/workflows/${created.workflow.id}/status`),
    {
      config,
      sendJson: (_res, statusCode, body) => {
        responseStatus = statusCode;
        responseBody = body;
      },
      setCorsHeaders: () => undefined,
      readJsonBody: async () => ({}),
      readRawBody: async () => Buffer.alloc(0)
    }
  );

  assert.equal(handled, true);
  assert.equal(responseStatus, 200);

  const body = responseBody as { ok: boolean; workflow_status: WorkflowStatusResponse };
  assert.equal(body.ok, true);
  assert.equal(body.workflow_status.workflow_id, created.workflow.id);
  assert.equal(body.workflow_status.status, "running");
  assert.equal(body.workflow_status.current_task?.id, created.task.id);
  assert.equal(body.workflow_status.current_task?.type, "analyze_repo");
  assert.equal(body.workflow_status.current_task?.status, "queued");
  assert.equal(body.workflow_status.current_task?.lease_expires_at, undefined);
  assert.equal(body.workflow_status.current_task?.needs_attention, false);
  assert.deepEqual(body.workflow_status.progress, { done: 0, total: 1 });
  assert.equal(body.workflow_status.needs_attention, false);
  assert.equal(body.workflow_status.attention_reasons, undefined);
  assert.equal(typeof body.workflow_status.updated_at, "string");
});
