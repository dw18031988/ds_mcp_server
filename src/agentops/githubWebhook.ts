import { createHmac, timingSafeEqual } from "node:crypto";

export type NormalizedGithubCiEvent = {
  delivery_id: string;
  repo?: string;
  pr_number?: number;
  head_sha?: string;
  conclusion: "success" | "failure";
};

export type NormalizeGithubWebhookResult =
  | { ignored: false; event: NormalizedGithubCiEvent }
  | { ignored: true; reason: string };

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function firstPullRequestNumber(value: unknown): number | undefined {
  const pullRequests = asArray(value);
  for (const item of pullRequests) {
    const pr = asObject(item);
    const number = asPositiveInteger(pr?.number);
    if (number) return number;
  }
  return undefined;
}

function normalizeConclusion(raw: unknown, eventName?: string): "success" | "failure" | undefined {
  const value = asString(raw)?.toLowerCase();

  if (!value) return undefined;

  if (eventName === "status") {
    if (value === "success") return "success";
    if (value === "failure" || value === "error") return "failure";
    return undefined;
  }

  if (value === "success" || value === "neutral" || value === "skipped") return "success";
  if (["failure", "cancelled", "timed_out", "action_required", "startup_failure"].includes(value)) {
    return "failure";
  }

  return undefined;
}

export function parseGithubWebhookBody(rawBody: Buffer): JsonObject {
  const rawText = rawBody.toString("utf8");
  if (!rawText.trim()) return {};
  const parsed = JSON.parse(rawText) as unknown;
  const object = asObject(parsed);
  if (!object) throw new Error("GitHub webhook payload must be a JSON object");
  return object;
}

export function verifyGithubWebhookSignature(
  secret: string,
  rawBody: Buffer,
  signatureHeader: string | undefined
): boolean {
  const signature = asString(signatureHeader);
  if (!signature?.startsWith("sha256=")) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function normalizeGithubCiWebhook(input: {
  eventName?: string;
  deliveryId?: string;
  payload: JsonObject;
}): NormalizeGithubWebhookResult {
  const eventName = asString(input.eventName)?.toLowerCase();
  const deliveryId = asString(input.deliveryId) ?? asString(input.payload.delivery_id);

  if (!deliveryId) {
    return { ignored: true, reason: "missing_delivery_id" };
  }

  if (eventName === "ping") {
    return { ignored: true, reason: "github_ping" };
  }

  const repository = asObject(input.payload.repository);
  const repo = asString(input.payload.repo) ?? asString(repository?.full_name);
  const directConclusion = normalizeConclusion(input.payload.conclusion, eventName);

  if (!eventName || eventName === "manual" || eventName === "ci_status") {
    const conclusion = directConclusion;
    if (!conclusion) return { ignored: true, reason: "non_final_ci_conclusion" };
    return {
      ignored: false,
      event: {
        delivery_id: deliveryId,
        repo,
        pr_number: asPositiveInteger(input.payload.pr_number),
        head_sha: asString(input.payload.head_sha),
        conclusion
      }
    };
  }

  if (eventName === "workflow_run") {
    const workflowRun = asObject(input.payload.workflow_run);
    const action = asString(input.payload.action)?.toLowerCase();
    const conclusion = normalizeConclusion(workflowRun?.conclusion, eventName);

    if (action && action !== "completed") {
      return { ignored: true, reason: `workflow_run_${action}` };
    }

    if (!conclusion) return { ignored: true, reason: "non_final_workflow_run" };

    return {
      ignored: false,
      event: {
        delivery_id: deliveryId,
        repo,
        pr_number: firstPullRequestNumber(workflowRun?.pull_requests),
        head_sha: asString(workflowRun?.head_sha),
        conclusion
      }
    };
  }

  if (eventName === "check_run") {
    const checkRun = asObject(input.payload.check_run);
    const action = asString(input.payload.action)?.toLowerCase();
    const conclusion = normalizeConclusion(checkRun?.conclusion, eventName);

    if (action && action !== "completed") {
      return { ignored: true, reason: `check_run_${action}` };
    }

    if (!conclusion) return { ignored: true, reason: "non_final_check_run" };

    return {
      ignored: false,
      event: {
        delivery_id: deliveryId,
        repo,
        pr_number: firstPullRequestNumber(checkRun?.pull_requests),
        head_sha: asString(checkRun?.head_sha),
        conclusion
      }
    };
  }

  if (eventName === "check_suite") {
    const checkSuite = asObject(input.payload.check_suite);
    const action = asString(input.payload.action)?.toLowerCase();
    const conclusion = normalizeConclusion(checkSuite?.conclusion, eventName);

    if (action && action !== "completed") {
      return { ignored: true, reason: `check_suite_${action}` };
    }

    if (!conclusion) return { ignored: true, reason: "non_final_check_suite" };

    return {
      ignored: false,
      event: {
        delivery_id: deliveryId,
        repo,
        pr_number: firstPullRequestNumber(checkSuite?.pull_requests),
        head_sha: asString(checkSuite?.head_sha),
        conclusion
      }
    };
  }

  if (eventName === "status") {
    const conclusion = normalizeConclusion(input.payload.state, eventName);
    if (!conclusion) return { ignored: true, reason: "non_final_status" };

    return {
      ignored: false,
      event: {
        delivery_id: deliveryId,
        repo,
        head_sha: asString(input.payload.sha),
        conclusion
      }
    };
  }

  return { ignored: true, reason: `unsupported_event_${eventName}` };
}
