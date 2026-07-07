import type { AppConfig } from "../config.js";
import { getSupabaseClient, isSupabaseConfigured } from "../db/supabaseClient.js";
import {
  appendTaskEvent,
  createTaskRecord,
  createWorkflowRecord
} from "../repositories/orchestrationRepository.js";
import type { AsyncTaskType } from "../asyncWorkflowStore.js";

export type SchedulerTickResult = {
  ok: true;
  scheduler_id: string;
  supabase_configured: boolean;
  expired_leases: number;
  requeued_tasks: number;
  cron_workflows_created: number;
};

function now(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nextRunOneMinuteFromNow(): string {
  return new Date(Date.now() + 60_000).toISOString();
}

export async function runSchedulerTick(
  config: AppConfig,
  schedulerId = "default"
): Promise<SchedulerTickResult> {
  if (!isSupabaseConfigured(config)) {
    return {
      ok: true,
      scheduler_id: schedulerId,
      supabase_configured: false,
      expired_leases: 0,
      requeued_tasks: 0,
      cron_workflows_created: 0
    };
  }

  const supabase = getSupabaseClient(config);
  const startedAt = now();
  const runId = createId("schrun");
  await supabase.from("scheduler_runs").insert({
    id: runId,
    scheduler_id: schedulerId,
    started_at: startedAt,
    status: "running",
    summary_json: {}
  });

  let expiredLeases = 0;
  let requeuedTasks = 0;
  let cronWorkflowsCreated = 0;

  const { data: leases, error: leaseError } = await supabase
    .from("task_leases")
    .select("*")
    .eq("status", "active")
    .lte("expires_at", startedAt)
    .limit(100);
  if (leaseError) throw new Error(`Failed to load expired leases: ${leaseError.message}`);

  for (const lease of (leases ?? []) as Array<{ id: string; task_id: string; agent_id: string }>) {
    expiredLeases += 1;
    await supabase
      .from("task_leases")
      .update({ status: "expired", released_at: now() })
      .eq("id", lease.id);

    const { data: taskRows, error: taskError } = await supabase
      .from("tasks")
      .update({ status: "queued", lease_owner: null, lease_token: null, lease_expires_at: null, updated_at: now() })
      .eq("id", lease.task_id)
      .eq("status", "leased")
      .select("id,workflow_id");
    if (taskError) throw new Error(`Failed to requeue expired lease task: ${taskError.message}`);

    const task = (taskRows ?? [])[0] as { id: string; workflow_id: string } | undefined;
    if (task) {
      requeuedTasks += 1;
      await appendTaskEvent(config, {
        workflow_id: task.workflow_id,
        task_id: task.id,
        event_type: "lease_expired_task_requeued",
        actor: "system",
        data_json: { lease_id: lease.id, agent_id: lease.agent_id }
      });
    }
  }

  const { data: schedules, error: scheduleError } = await supabase
    .from("cron_schedules")
    .select("*")
    .eq("enabled", true)
    .lte("next_run_at", startedAt)
    .limit(20);
  if (scheduleError) throw new Error(`Failed to load due cron schedules: ${scheduleError.message}`);

  for (const schedule of (schedules ?? []) as Array<{ id: string; workflow_type: string; payload_json?: Record<string, unknown> }>) {
    const workflow = await createWorkflowRecord(config, {
      name: `cron:${schedule.workflow_type}`,
      source: "system",
      context_json: schedule.payload_json ?? {}
    });
    await createTaskRecord(config, {
      workflow_id: workflow.id,
      type: "analyze_repo" satisfies AsyncTaskType,
      payload_json: schedule.payload_json ?? {}
    });
    await supabase
      .from("cron_schedules")
      .update({ last_run_at: startedAt, next_run_at: nextRunOneMinuteFromNow() })
      .eq("id", schedule.id);
    cronWorkflowsCreated += 1;
  }

  const summary = {
    expired_leases: expiredLeases,
    requeued_tasks: requeuedTasks,
    cron_workflows_created: cronWorkflowsCreated
  };

  await supabase
    .from("scheduler_runs")
    .update({ status: "completed", completed_at: now(), summary_json: summary })
    .eq("id", runId);

  return {
    ok: true,
    scheduler_id: schedulerId,
    supabase_configured: true,
    ...summary
  };
}
