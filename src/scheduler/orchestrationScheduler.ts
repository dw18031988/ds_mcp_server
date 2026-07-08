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
  scheduler_run_id?: string;
  supabase_configured: boolean;
  lock_acquired?: boolean;
  expired_leases: number;
  requeued_tasks: number;
  stale_agents: number;
  cron_workflows_created: number;
};

export type CronSchedule = {
  id: string;
  workflow_type: string;
  cron_expression: string;
  timezone: string;
  payload_json: Record<string, unknown>;
  enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
  created_at?: string;
};

export type RetryPolicyConfig = {
  id: string;
  task_type: string;
  max_attempts: number;
  base_delay_seconds: number;
  max_delay_seconds: number;
  backoff_multiplier: number;
  created_at?: string;
  updated_at?: string;
};

export type SchedulerRun = {
  id: string;
  scheduler_id: string;
  started_at: string;
  completed_at?: string;
  status: string;
  summary_json: Record<string, unknown>;
};

const memoryCronSchedules = new Map<string, CronSchedule>();
const memoryRetryPolicies = new Map<string, RetryPolicyConfig>();
const memorySchedulerRuns: SchedulerRun[] = [];

function now(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nextRunOneMinuteFromNow(): string {
  return new Date(Date.now() + 60_000).toISOString();
}

function asCronSchedule(row: Record<string, unknown>): CronSchedule {
  return {
    id: String(row.id),
    workflow_type: String(row.workflow_type),
    cron_expression: String(row.cron_expression),
    timezone: String(row.timezone ?? "UTC"),
    payload_json: (row.payload_json as Record<string, unknown>) ?? {},
    enabled: Boolean(row.enabled ?? true),
    last_run_at: row.last_run_at ? String(row.last_run_at) : undefined,
    next_run_at: row.next_run_at ? String(row.next_run_at) : undefined,
    created_at: row.created_at ? String(row.created_at) : undefined
  };
}

function asRetryPolicy(row: Record<string, unknown>): RetryPolicyConfig {
  return {
    id: String(row.id),
    task_type: String(row.task_type),
    max_attempts: Number(row.max_attempts ?? 3),
    base_delay_seconds: Number(row.base_delay_seconds ?? 30),
    max_delay_seconds: Number(row.max_delay_seconds ?? 3600),
    backoff_multiplier: Number(row.backoff_multiplier ?? 2),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined
  };
}

function asSchedulerRun(row: Record<string, unknown>): SchedulerRun {
  return {
    id: String(row.id),
    scheduler_id: String(row.scheduler_id),
    started_at: String(row.started_at),
    completed_at: row.completed_at ? String(row.completed_at) : undefined,
    status: String(row.status),
    summary_json: (row.summary_json as Record<string, unknown>) ?? {}
  };
}

async function acquireSchedulerLock(config: AppConfig, schedulerId: string, startedAt: string): Promise<string | undefined> {
  const supabase = getSupabaseClient(config);
  const ownerId = `${schedulerId}:${createId("owner")}`;
  const expiresAt = new Date(Date.now() + 120_000).toISOString();

  await supabase.from("task_locks").delete().eq("lock_key", "scheduler_tick").lte("expires_at", startedAt);
  const { error } = await supabase.from("task_locks").insert({
    lock_key: "scheduler_tick",
    owner_id: ownerId,
    expires_at: expiresAt
  });

  if (!error) return ownerId;
  if (error.code === "23505") return undefined;
  throw new Error(`Failed to acquire scheduler lock: ${error.message}`);
}

async function releaseSchedulerLock(config: AppConfig, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient(config);
  await supabase.from("task_locks").delete().eq("lock_key", "scheduler_tick").eq("owner_id", ownerId);
}

export async function listCronSchedules(config: AppConfig, limit = 50): Promise<CronSchedule[]> {
  if (!isSupabaseConfigured(config)) {
    return [...memoryCronSchedules.values()].slice(0, limit);
  }

  const supabase = getSupabaseClient(config);
  const { data, error } = await supabase
    .from("cron_schedules")
    .select("*")
    .order("next_run_at", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`Failed to list cron schedules: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map(asCronSchedule);
}

export async function upsertCronSchedule(config: AppConfig, input: {
  id?: string;
  workflow_type: string;
  cron_expression: string;
  timezone?: string;
  payload_json?: Record<string, unknown>;
  enabled?: boolean;
  next_run_at?: string;
}): Promise<CronSchedule> {
  const timestamp = now();
  const id = input.id ?? createId("cron");
  const record = {
    id,
    workflow_type: input.workflow_type,
    cron_expression: input.cron_expression,
    timezone: input.timezone ?? "UTC",
    payload_json: input.payload_json ?? {},
    enabled: input.enabled ?? true,
    next_run_at: input.next_run_at ?? timestamp
  };

  if (!isSupabaseConfigured(config)) {
    const schedule = asCronSchedule({ ...record, created_at: timestamp });
    memoryCronSchedules.set(id, schedule);
    return schedule;
  }

  const supabase = getSupabaseClient(config);
  const { data, error } = await supabase.from("cron_schedules").upsert(record).select("*").single();
  if (error) throw new Error(`Failed to upsert cron schedule: ${error.message}`);
  return asCronSchedule(data as Record<string, unknown>);
}

export async function listRetryPolicies(config: AppConfig, limit = 50): Promise<RetryPolicyConfig[]> {
  if (!isSupabaseConfigured(config)) {
    return [...memoryRetryPolicies.values()].slice(0, limit);
  }

  const supabase = getSupabaseClient(config);
  const { data, error } = await supabase
    .from("retry_policies")
    .select("*")
    .order("task_type", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Failed to list retry policies: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map(asRetryPolicy);
}

export async function upsertRetryPolicy(config: AppConfig, input: {
  id?: string;
  task_type: string;
  max_attempts?: number;
  base_delay_seconds?: number;
  max_delay_seconds?: number;
  backoff_multiplier?: number;
}): Promise<RetryPolicyConfig> {
  const timestamp = now();
  const id = input.id ?? `retry_${input.task_type}`;
  const record = {
    id,
    task_type: input.task_type,
    max_attempts: input.max_attempts ?? 3,
    base_delay_seconds: input.base_delay_seconds ?? 30,
    max_delay_seconds: input.max_delay_seconds ?? 3600,
    backoff_multiplier: input.backoff_multiplier ?? 2,
    updated_at: timestamp
  };

  if (!isSupabaseConfigured(config)) {
    const policy = asRetryPolicy({ ...record, created_at: timestamp });
    memoryRetryPolicies.set(input.task_type, policy);
    return policy;
  }

  const supabase = getSupabaseClient(config);
  const { data, error } = await supabase.from("retry_policies").upsert(record).select("*").single();
  if (error) throw new Error(`Failed to upsert retry policy: ${error.message}`);
  return asRetryPolicy(data as Record<string, unknown>);
}

export async function listSchedulerRuns(config: AppConfig, limit = 50): Promise<SchedulerRun[]> {
  if (!isSupabaseConfigured(config)) {
    return memorySchedulerRuns.slice(0, limit);
  }

  const supabase = getSupabaseClient(config);
  const { data, error } = await supabase
    .from("scheduler_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to list scheduler runs: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map(asSchedulerRun);
}

export async function runSchedulerTick(
  config: AppConfig,
  schedulerId = "default"
): Promise<SchedulerTickResult> {
  if (!isSupabaseConfigured(config)) {
    const result = {
      ok: true as const,
      scheduler_id: schedulerId,
      scheduler_run_id: createId("schrun"),
      supabase_configured: false,
      expired_leases: 0,
      requeued_tasks: 0,
      stale_agents: 0,
      cron_workflows_created: 0
    };
    memorySchedulerRuns.unshift({
      id: result.scheduler_run_id,
      scheduler_id: schedulerId,
      started_at: now(),
      completed_at: now(),
      status: "completed",
      summary_json: result
    });
    return result;
  }

  const supabase = getSupabaseClient(config);
  const startedAt = now();
  const runId = createId("schrun");
  let lockOwner: string | undefined;

  await supabase.from("scheduler_runs").insert({
    id: runId,
    scheduler_id: schedulerId,
    started_at: startedAt,
    status: "running",
    summary_json: {}
  });

  try {
    lockOwner = await acquireSchedulerLock(config, schedulerId, startedAt);
    if (!lockOwner) {
      const skipped = {
        expired_leases: 0,
        requeued_tasks: 0,
        stale_agents: 0,
        cron_workflows_created: 0,
        lock_acquired: false
      };
      await supabase
        .from("scheduler_runs")
        .update({ status: "skipped", completed_at: now(), summary_json: skipped })
        .eq("id", runId);
      return {
        ok: true,
        scheduler_id: schedulerId,
        scheduler_run_id: runId,
        supabase_configured: true,
        ...skipped
      };
    }

    let expiredLeases = 0;
    let requeuedTasks = 0;
    let staleAgents = 0;
    let cronWorkflowsCreated = 0;

    const staleCutoff = new Date(Date.now() - 120_000).toISOString();
    const { data: staleRows, error: staleError } = await supabase
      .from("agents")
      .update({ status: "stale" })
      .lt("last_seen_at", staleCutoff)
      .not("status", "eq", "offline")
      .select("id");
    if (staleError) throw new Error(`Failed to mark stale agents: ${staleError.message}`);
    staleAgents = (staleRows ?? []).length;

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

    for (const schedule of (schedules ?? []) as Array<{ id: string; workflow_type: string; payload_json?: Record<string, unknown>; next_run_at?: string }>) {
      const { data: claimedRows, error: claimError } = await supabase
        .from("cron_schedules")
        .update({ last_run_at: startedAt, next_run_at: nextRunOneMinuteFromNow() })
        .eq("id", schedule.id)
        .lte("next_run_at", startedAt)
        .select("id");
      if (claimError) throw new Error(`Failed to claim cron schedule: ${claimError.message}`);
      if ((claimedRows ?? []).length === 0) continue;

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
      cronWorkflowsCreated += 1;
    }

    const summary = {
      expired_leases: expiredLeases,
      requeued_tasks: requeuedTasks,
      stale_agents: staleAgents,
      cron_workflows_created: cronWorkflowsCreated,
      lock_acquired: true
    };

    await supabase
      .from("scheduler_runs")
      .update({ status: "completed", completed_at: now(), summary_json: summary })
      .eq("id", runId);

    return {
      ok: true,
      scheduler_id: schedulerId,
      scheduler_run_id: runId,
      supabase_configured: true,
      ...summary
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduler tick failed";
    await supabase
      .from("scheduler_runs")
      .update({ status: "failed", completed_at: now(), summary_json: { error: message } })
      .eq("id", runId);
    throw error;
  } finally {
    if (lockOwner) await releaseSchedulerLock(config, lockOwner);
  }
}
