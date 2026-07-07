import type { AppConfig } from "../config.js";
import { getSupabaseClient, isSupabaseConfigured } from "../db/supabaseClient.js";

export type OrchestrationDashboardSnapshot = {
  ok: true;
  generated_at: string;
  supabase_configured: boolean;
  workflows: unknown[];
  task_queue: unknown[];
  running_agents: unknown[];
  waiting: unknown[];
  failed_tasks: unknown[];
  dead_letter_tasks: unknown[];
  webhook_deliveries: unknown[];
  events: unknown[];
};

function now(): string {
  return new Date().toISOString();
}

async function selectList(
  config: AppConfig,
  table: string,
  options: { limit?: number; status?: string; orderColumn?: string } = {}
): Promise<unknown[]> {
  const supabase = getSupabaseClient(config);
  let query = supabase.from(table).select("*");
  if (options.status) query = query.eq("status", options.status);
  query = query.order(options.orderColumn ?? "created_at", { ascending: false }).limit(options.limit ?? 50);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load ${table}: ${error.message}`);
  return data ?? [];
}

export async function getOrchestrationDashboardSnapshot(
  config: AppConfig,
  limit = 50
): Promise<OrchestrationDashboardSnapshot> {
  if (!isSupabaseConfigured(config)) {
    return {
      ok: true,
      generated_at: now(),
      supabase_configured: false,
      workflows: [],
      task_queue: [],
      running_agents: [],
      waiting: [],
      failed_tasks: [],
      dead_letter_tasks: [],
      webhook_deliveries: [],
      events: []
    };
  }

  const supabase = getSupabaseClient(config);
  const [workflows, taskQueue, leases, waiting, failedTasks, deadLetters, webhooks, events] = await Promise.all([
    selectList(config, "workflows", { limit, orderColumn: "updated_at" }),
    selectList(config, "tasks", { limit, status: "queued", orderColumn: "updated_at" }),
    selectList(config, "task_leases", { limit, status: "active", orderColumn: "leased_at" }),
    selectList(config, "tasks", { limit, status: "waiting_external", orderColumn: "updated_at" }),
    selectList(config, "tasks", { limit, status: "failed", orderColumn: "updated_at" }),
    selectList(config, "dead_letter_tasks", { limit, orderColumn: "failed_at" }),
    selectList(config, "webhook_deliveries", { limit, orderColumn: "received_at" }),
    selectList(config, "task_events", { limit, orderColumn: "created_at" })
  ]);

  const agentIds = [...new Set((leases as Array<{ agent_id?: string }>).map((lease) => lease.agent_id).filter(Boolean))];
  let runningAgents: unknown[] = leases;
  if (agentIds.length > 0) {
    const { data, error } = await supabase.from("agents").select("*").in("id", agentIds);
    if (error) throw new Error(`Failed to load running agents: ${error.message}`);
    runningAgents = data ?? leases;
  }

  return {
    ok: true,
    generated_at: now(),
    supabase_configured: true,
    workflows,
    task_queue: taskQueue,
    running_agents: runningAgents,
    waiting,
    failed_tasks: failedTasks,
    dead_letter_tasks: deadLetters,
    webhook_deliveries: webhooks,
    events
  };
}
