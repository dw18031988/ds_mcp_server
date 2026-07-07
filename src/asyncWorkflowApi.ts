import type { IncomingMessage, ServerResponse } from "node:http";
import { ZodError } from "zod";
import { claimAsyncTaskSchema, createAsyncWorkflowSchema, submitAsyncTaskResultSchema } from "./asyncWorkflowSchemas.js";
import { claimAsyncTask, createAsyncWorkflow, getAsyncWorkflow, submitAsyncTaskResult } from "./asyncWorkflowStore.js";

export type AsyncWorkflowApiDeps = {
  sendJson: (res: ServerResponse, statusCode: number, body: unknown) => void;
  setCorsHeaders: (res: ServerResponse) => void;
  readJsonBody: (req: IncomingMessage) => Promise<unknown>;
};

function decodePathValue(value: string | undefined): string {
  return decodeURIComponent(value ?? "");
}

export async function handleAsyncWorkflowApi(req: IncomingMessage, res: ServerResponse, url: URL, deps: AsyncWorkflowApiDeps): Promise<boolean> {
  const { sendJson, setCorsHeaders, readJsonBody } = deps;
  if (!url.pathname.startsWith("/api/workflows") && !url.pathname.startsWith("/api/async-tasks")) return false;
  setCorsHeaders(res);

  try {
    if (req.method === "POST" && url.pathname === "/api/workflows") {
      const body = createAsyncWorkflowSchema.parse(await readJsonBody(req));
      const output = createAsyncWorkflow(body);
      sendJson(res, 202, { ok: true, workflow: output.workflow, current_task: output.task });
      return true;
    }

    const workflowMatch = url.pathname.match(/^\/api\/workflows\/([^/]+)$/);
    if (req.method === "GET" && workflowMatch) {
      const output = getAsyncWorkflow(decodePathValue(workflowMatch[1]));
      if (!output) {
        sendJson(res, 404, { error: "Workflow not found" });
        return true;
      }
      sendJson(res, 200, { ok: true, ...output });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/async-tasks/claim") {
      const body = claimAsyncTaskSchema.parse(await readJsonBody(req));
      sendJson(res, 200, { ok: true, task: claimAsyncTask(body) ?? null });
      return true;
    }

    const resultMatch = url.pathname.match(/^\/api\/async-tasks\/([^/]+)\/result$/);
    if (req.method === "POST" && resultMatch) {
      const body = submitAsyncTaskResultSchema.parse(await readJsonBody(req));
      const output = submitAsyncTaskResult(decodePathValue(resultMatch[1]), body);
      if (!output) {
        sendJson(res, 404, { error: "Task not found" });
        return true;
      }
      sendJson(res, 200, { ok: true, ...output });
      return true;
    }

    sendJson(res, 404, { error: "Async workflow route not found" });
    return true;
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return true;
    }
    if (error instanceof ZodError) {
      sendJson(res, 400, { error: "Invalid async workflow payload", details: error.flatten() });
      return true;
    }
    const message = error instanceof Error ? error.message : "Async workflow API failed";
    sendJson(res, 500, { error: message });
    return true;
  }
}
