import type { AppConfig } from "../config.js";
import { getSupabaseClient, isSupabaseConfigured } from "../db/supabaseClient.js";

export type RegisteredAgent = {
  id: string;
  name: string;
  status: string;
  version?: string;
  capabilities: string[];
  metadata_json: Record<string, unknown>;
  registered_at: string;
  last_seen_at?: string;
};

export type AgentHeartbeat = {
  agent_id: string;
  status: string;
  current_task_id?: string;
  current_lease_id?: string;
  queue_depth?: number;
  payload_json?: Record<string, unknown>;
};

const memoryAgents = new Map<string, RegisteredAgent>();
const memoryHeartbeats: AgentHeartbeat[] = [];

function now(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function asAgent(row: Record<string, unknown>, capabilities: string[] = []): RegisteredAgent {
  return {
    id: String(row.id),
    name: String(row.name),
    status: String(row.status ?? "available"),
    version: row.version ? String(row.version) : undefined,
    capabilities,
    metadata_json: (row.metadata_json as Record<string, unknown>) ?? {},
    registered_at: String(row.registered_at ?? now()),
    last_seen_at: row.last_seen_at ? String(row.last_seen_at) : undefined
  };
}

export async function registerAgent(
  config: AppConfig,
  input: {
    id: string;
    name: string;
    version?: string;
    capabilities?: string[];
    metadata_json?: Record<string, unknown>;
  }
): Promise<RegisteredAgent> {
  const timestamp = now();
  const capabilities = input.capabilities ?? [];

  if (!isSupabaseConfigured(config)) {
    const agent: RegisteredAgent = {
      id: input.id,
      name: input.name,
      status: "available",
      version: input.version,
      capabilities,
      metadata_json: input.metadata_json ?? {},
      registered_at: timestamp,
      last_seen_at: timestamp
    };
    memoryAgents.set(agent.id, agent);
    return agent;
  }

  const supabase = getSupabaseClient(config);
  const { data, error } = await supabase
    .from("agents")
    .upsert({
      id: input.id,
      name: input.name,
      status: "available",
      version: input.version ?? null,
      metadata_json: input.metadata_json ?? {},
      last_seen_at: timestamp
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to register agent: ${error.message}`);

  if (capabilities.length > 0) {
    await supabase.from("agent_capabilities").delete().eq("agent_id", input.id);
    const capabilityRows = capabilities.map((capability) => ({
      agent_id: input.id,
      capability,
      priority: 100
    }));
    const { error: capabilityError } = await supabase.from("agent_capabilities").insert(capabilityRows);
    if (capabilityError) throw new Error(`Failed to register agent capabilities: ${capabilityError.message}`);
  }

  return asAgent(data as Record<string, unknown>, capabilities);
}

export async function recordAgentHeartbeat(
  config: AppConfig,
  input: AgentHeartbeat
): Promise<{ ok: true; heartbeat_id: string }> {
  const heartbeatId = createId("ahb");
  const timestamp = now();

  if (!isSupabaseConfigured(config)) {
    memoryHeartbeats.unshift(input);
    const current = memoryAgents.get(input.agent_id);
    if (current) {
      memoryAgents.set(input.agent_id, {
        ...current,
        status: input.status,
        last_seen_at: timestamp
      });
    }
    return { ok: true, heartbeat_id: heartbeatId };
  }

  const supabase = getSupabaseClient(config);
  const { error } = await supabase.from("agent_heartbeats").insert({
    id: heartbeatId,
    agent_id: input.agent_id,
    status: input.status,
    current_task_id: input.current_task_id ?? null,
    current_lease_id: input.current_lease_id ?? null,
    queue_depth: input.queue_depth ?? null,
    payload_json: input.payload_json ?? {},
    created_at: timestamp
  });
  if (error) throw new Error(`Failed to record agent heartbeat: ${error.message}`);

  const { error: updateError } = await supabase
    .from("agents")
    .update({ status: input.status, last_seen_at: timestamp })
    .eq("id", input.agent_id);
  if (updateError) throw new Error(`Failed to update agent activity: ${updateError.message}`);

  await supabase.from("agent_queue_stats").upsert({
    agent_id: input.agent_id,
    queue_depth: input.queue_depth ?? 0,
    updated_at: timestamp
  });

  return { ok: true, heartbeat_id: heartbeatId };
}

export async function listAgents(config: AppConfig): Promise<RegisteredAgent[]> {
  if (!isSupabaseConfigured(config)) {
    return [...memoryAgents.values()].sort((a, b) => (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? ""));
  }

  const supabase = getSupabaseClient(config);
  const { data: agents, error } = await supabase
    .from("agents")
    .select("*")
    .order("last_seen_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Failed to list agents: ${error.message}`);

  const { data: capabilityRows, error: capabilityError } = await supabase
    .from("agent_capabilities")
    .select("agent_id,capability");
  if (capabilityError) throw new Error(`Failed to list agent capabilities: ${capabilityError.message}`);

  const capabilityMap = new Map<string, string[]>();
  for (const row of (capabilityRows ?? []) as Array<{ agent_id: string; capability: string }>) {
    const values = capabilityMap.get(row.agent_id) ?? [];
    values.push(row.capability);
    capabilityMap.set(row.agent_id, values);
  }

  return ((agents ?? []) as Array<Record<string, unknown>>).map((agent) =>
    asAgent(agent, capabilityMap.get(String(agent.id)) ?? [])
  );
}
