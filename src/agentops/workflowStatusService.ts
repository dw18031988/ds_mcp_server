import type { AppConfig } from "../config.js";
import { isSupabaseConfigured } from "../db/supabaseClient.js";
import {
  getAsyncWorkflow,
  type AsyncTask,
  type AsyncTaskEvent,
  type AsyncTaskStatus,
  type AsyncTaskType,
  type AsyncWorkflow,
  type AsyncWorkflowStatus
} from "../asyncWorkflowStore.js";
import { getWorkflowStatusRecord } from "../repositories/orchestrationRepository.js";

export type WorkflowStatusResponse = {
  workflow_id: string;
  status: AsyncWorkflowStatus | "paused";
  current_task?: {
    id: string;
    type: AsyncTaskType;
    status: AsyncTaskStatus;
    lease_expires_at?: string;
    needs_attention?: boolean;
  };
  progress: {
    done: number;
    total: number;
  };
  needs_attention: boolean;
  attention_reasons?: string[];
  updated_at: string;
};

type WorkflowLike = Pick<AsyncWorkflow, "id" | "status" | "current_task_id" | "updated_at" | "context_json">;
type TaskLike = Pick<AsyncTask, "id" | "type" | "status" | "lease_expires_at">;
type EventLike = Pick<AsyncTaskEvent, "event_type" | "data_json">;

type WorkflowStatusSource = {
  workflow: WorkflowLike;
  tasks: TaskLike[];
  events?: EventLike[];
};

function isPausedWorkflow(workflow: WorkflowLike): boolean {
  return workflow.status === "paused" || workflow.context_json.paused === true;
}

function isSuccessfulTask(task: TaskLike): boolean {
  return task.status === "succeeded";
}

function isExpiredLease(task: TaskLike, nowMs: number): boolean {
  if (!task.lease_expires_at) return false;
  if (task.status !== "leased" && task.status !== "running") return false;
  const expiresAt = Date.parse(task.lease_expires_at);
  return Number.isFinite(expiresAt) && expiresAt <= nowMs;
}

function taskAttentionReasons(task: TaskLike, nowMs: number): string[] {
  const reasons: string[] = [];

  if (task.status === "failed") {
    reasons.push("failed_task");
  }

  if (task.status === "dead_letter") {
    reasons.push("dead_letter_task");
  }

  if (task.status === "cancelled") {
    reasons.push("cancelled_task");
  }

  if (task.status === "waiting_external") {
    reasons.push("unresolved_external_wait");
  }

  if (isExpiredLease(task, nowMs)) {
    reasons.push("expired_lease");
  }

  return reasons;
}

function eventAttentionReasons(event: EventLike): string[] {
  const reasons: string[] = [];
  const eventType = event.event_type.toLowerCase();
  const data = event.data_json;
  const status = String(data.status ?? "").toLowerCase();
  const reason = String(data.reason ?? data.message ?? "").toLowerCase();

  if (eventType.includes("ambiguous") || status === "ambiguous" || reason.includes("ambiguous")) {
    reasons.push("ambiguous_ci_match");
  }

  if (eventType.includes("attention") || status === "needs_attention" || reason.includes("attention")) {
    reasons.push("needs_attention");
  }

  return reasons;
}

export function projectWorkflowStatus(
  source: WorkflowStatusSource,
  nowMs = Date.now()
): WorkflowStatusResponse {
  const attentionReasons = new Set<string>();
  const currentTask = source.workflow.current_task_id
    ? source.tasks.find((task) => task.id === source.workflow.current_task_id)
    : undefined;

  if (source.workflow.status === "failed") {
    attentionReasons.add("workflow_failed");
  }

  if (source.workflow.status === "cancelled") {
    attentionReasons.add("workflow_cancelled");
  }

  if (isPausedWorkflow(source.workflow)) {
    attentionReasons.add("workflow_paused");
  }

  if (source.workflow.current_task_id && !currentTask) {
    attentionReasons.add("current_task_missing");
  }

  if (currentTask) {
    for (const reason of taskAttentionReasons(currentTask, nowMs)) {
      attentionReasons.add(reason);
    }
  }

  for (const task of source.tasks) {
    for (const reason of taskAttentionReasons(task, nowMs)) {
      attentionReasons.add(reason);
    }
  }

  for (const event of source.events ?? []) {
    for (const reason of eventAttentionReasons(event)) {
      attentionReasons.add(reason);
    }
  }

  const currentTaskReasons = currentTask ? taskAttentionReasons(currentTask, nowMs) : [];

  return {
    workflow_id: source.workflow.id,
    status: isPausedWorkflow(source.workflow) ? "paused" : source.workflow.status,
    current_task: currentTask
      ? {
          id: currentTask.id,
          type: currentTask.type,
          status: currentTask.status,
          lease_expires_at: currentTask.lease_expires_at,
          needs_attention: currentTaskReasons.length > 0
        }
      : undefined,
    progress: {
      done: source.tasks.filter(isSuccessfulTask).length,
      total: source.tasks.length
    },
    needs_attention: attentionReasons.size > 0,
    attention_reasons: attentionReasons.size > 0 ? [...attentionReasons].sort() : undefined,
    updated_at: source.workflow.updated_at
  };
}

export async function getWorkflowStatus(
  config: AppConfig,
  workflowId: string
): Promise<WorkflowStatusResponse | undefined> {
  if (isSupabaseConfigured(config)) {
    const record = await getWorkflowStatusRecord(config, workflowId);
    return record ? projectWorkflowStatus(record) : undefined;
  }

  const record = await getAsyncWorkflow(config, workflowId);
  if (!record) return undefined;
  return projectWorkflowStatus(record);
}
