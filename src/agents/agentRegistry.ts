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
  remaining_credits?: number;
  payload_json?: Record<string, unknown>;
};

type StoredAgentHeartbeat = AgentHeartbeat & {
  id: string;
  created_at: string;
};

export type AgentFreshness = "online" | "stale" | "offline";

export type AgentHealth = RegisteredAgent & {
  freshness: AgentFreshness;
  stale_after_seconds: number;
  last_seen_age_seconds?: number;
  current_task_id?: string;
  current_lease_id?: string;
  queue_depth?: number;
  remaining_credits?: number;
  last_heartbeat?: {
    id?: string;
    status: string;
    current_task_id?: string;
    current_lease_id?: string;
    queue_depth?: number;
    remaining_credits?: number;
    created_at: string;
  };
  queue_stats?: {
    queue_depth: number;
    running_count: number;
    failed_count: number;
    updated_at?: string;
  };
};

const memoryAgents = new Map<string, RegisteredAgent>();
const memoryHeartbeats: StoredAgentHeartbeat[] = [];

function now(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function ageSeconds(timestamp: string | undefined): number | undefined {
  if (!timestamp) return undefined;
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.floor((Date.now() - parsed) / 1000));
}

function freshnessFor(lastSeenAt: string | undefined, staleAfterSeconds: number): AgentFreshness {
  const age = ageSeconds(lastSeenAt);
  if (age === undefined) return "offline";
  if (age <= staleAfterSeconds) return "online";
  if (age <= staleAfterSeconds * 3) return "stale";
  return "offline";
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readRemainingCredits(input: {
  heartbeat?: AgentHeartbeat;
  metadataJson?: Record<string, unknown>;
}): number | undefined {
  return asNumber(input.heartbeat?.remaining_credits) ??
    asNumber(input.heartbeat?.payload_json?.remaining_credits) ??
    asNumber(input.heartbeat?.payload_json?.credits_remaining) ??
    asNumber(input.heartbeat?.payload_json?.credit_remaining) ??
    asNumber(input.metadataJson?.remaining_credits) ??
    asNumber(input.metadataJson?.credits_remaining) ??
    asNumber(input.metadataJson?.credit_remaining);
}

function heartbeatPayload(input: AgentHeartbeat): Record<string, unknown> {
  return input.remaining_credits === undefined
    ? input.payload_json ?? {}
    : {
        ...(input.payload_json ?? {}),
        remaining_credits: input.remaining_credits
      };
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

function asHealth(
  agent: RegisteredAgent,
  options: {
    staleAfterSeconds: number;
    heartbeat?: StoredAgentHeartbeat;
    queueStats?: { queue_depth?: number; running_count?: number; failed_count?: number; updated_at?: string };
  }
): AgentHealth {
  const remainingCredits = readRemainingCredits({
    heartbeat: options.heartbeat,
    metadataJson: agent.metadata_json
  });
  const queueDepth = options.heartbeat?.queue_depth ?? options.queueStats?.queue_depth;

  return {
    ...agent,
    freshness: freshnessFor(agent.last_seen_at, options.staleAfterSeconds),
    stale_after_seconds: options.staleAfterSeconds,
    last_seen_age_seconds: ageSeconds(agent.last_seen_at),
    current_task_id: options.heartbeat?.current_task_id,
    current_lease_id: options.heartbeat?.current_lease_id,
    queue_depth: queueDepth,
    remaining_credits: remainingCredits,
    last_heartbeat: options.heartbeat
      ? {
          id: options.heartbeat.id,
          status: options.heartbeat.status,
          current_task_id: options.heartbeat.current_task_id,
          current_lease_id: options.heartbeat.current_lease_id,
          queue_depth: options.heartbeat.queue_depth,
          remaining_credits: remainingCredits,
          created_at: options.heartbeat.created_at
        }
      : undefined,
    queue_stats: options.queueStats
      ? {
          queue_depth: options.queueStats.queue_depth ?? 0,
          running_count: options.queueStats.running_count ?? 0,
          failed_count: options.queueStats.failed_count ?? 0,
          updated_at: options.queueStats.updated_at
        }
      : undefined
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
  const payload = heartbeatPayload(input);

  if (!isSupabaseConfigured(config)) {
    memoryHeartbeats.unshift({ id: heartbeatId, created_at: timestamp, ...input, payload_json: payload });
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
    payload_json: payload,
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

export async function listAgentHealth(config: AppConfig, staleAfterSeconds = 120): Promise<AgentHealth[]> {
  const agents = await listAgents(config);

  if (!isSupabaseConfigured(config)) {
    return agents.map((agent) => {
      const heartbeat = memoryHeartbeats.find((entry) => entry.agent_id === agent.id);
      return asHealth(agent, { staleAfterSeconds, heartbeat });
    });
  }

  const supabase = getSupabaseClient(config);
  const agentIds = agents.map((agent) => agent.id);
  if (agentIds.length === 0) return [];

  const { data: heartbeatRows, error: heartbeatError } = await supabase
    .from("agent_heartbeats")
    .select("*")
    .in("agent_id", agentIds)
    .order("created_at", { ascending: false })
    .limit(Math.max(agentIds.length * 5, 50));
  if (heartbeatError) throw new Error(`Failed to list agent heartbeats: ${heartbeatError.message}`);

  const { data: queueRows, error: queueError } = await supabase
    .from("agent_queue_stats")
    .select("*")
    .in("agent_id", agentIds);
  if (queueError) throw new Error(`Failed to list agent queue stats: ${queueError.message}`);

  const heartbeatMap = new Map<string, StoredAgentHeartbeat>();
  for (const row of (heartbeatRows ?? []) as Array<Record<string, unknown>>) {
    const agentId = String(row.agent_id);
    if (heartbeatMap.has(agentId)) continue;
    const payloadJson = (row.payload_json as Record<string, unknown>) ?? {};
    heartbeatMap.set(agentId, {
      id: String(row.id),
      agent_id: agentId,
      status: String(row.status ?? "unknown"),
      current_task_id: row.current_task_id ? String(row.current_task_id) : undefined,
      current_lease_id: row.current_lease_id ? String(row.current_lease_id) : undefined,
      queue_depth: typeof row.queue_depth === "number" ? row.queue_depth : undefined,
      remaining_credits: asNumber(payloadJson.remaining_credits) ?? asNumber(payloadJson.credits_remaining),
      payload_json: payloadJson,
      created_at: String(row.created_at)
    });
  }

  const queueMap = new Map<string, { queue_depth?: number; running_count?: number; failed_count?: number; updated_at?: string }>();
  for (const row of (queueRows ?? []) as Array<Record<string, unknown>>) {
    queueMap.set(String(row.agent_id), {
      queue_depth: typeof row.queue_depth === "number" ? row.queue_depth : undefined,
      running_count: typeof row.running_count === "number" ? row.running_count : undefined,
      failed_count: typeof row.failed_count === "number" ? row.failed_count : undefined,
      updated_at: row.updated_at ? String(row.updated_at) : undefined
    });
  }

  return agents.map((agent) => asHealth(agent, {
    staleAfterSeconds,
    heartbeat: heartbeatMap.get(agent.id),
    queueStats: queueMap.get(agent.id)
  }));
}
