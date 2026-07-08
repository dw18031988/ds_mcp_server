# Phase 5 - Agent Management

## Objective

Introduce durable agent registration and runtime health so the scheduler can dispatch work to the best available agent.

## Agent data

Implemented tables:

- `agents`
- `agent_capabilities`
- `agent_heartbeats`
- `agent_queue_stats`

## Required fields

### agents

- `id text primary key`
- `name text not null`
- `status text not null`
- `version text`
- `metadata_json jsonb not null default '{}'::jsonb`
- `registered_at timestamptz not null default now()`
- `last_seen_at timestamptz`

### agent_capabilities

- `agent_id text references agents(id)`
- `capability text not null`
- `priority int not null default 100`

### agent_heartbeats

- `id text primary key`
- `agent_id text references agents(id)`
- `status text not null`
- `current_task_id text`
- `current_lease_id text`
- `queue_depth int`
- `payload_json jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

`payload_json.remaining_credits` is used for agent credit visibility without requiring a schema migration.

### agent_queue_stats

- `agent_id text primary key references agents(id)`
- `queue_depth int not null default 0`
- `running_count int not null default 0`
- `failed_count int not null default 0`
- `updated_at timestamptz not null default now()`

## Runtime behavior

Agents should:

1. Register identity and capabilities.
2. Send periodic heartbeat.
3. Claim only compatible tasks.
4. Include current lease/task in heartbeat.
5. Include `remaining_credits` in heartbeat when the agent can measure quota.
6. Mark themselves unavailable during shutdown or maintenance.

## Dispatch inputs

The scheduler can rank agents by:

- capability match
- heartbeat freshness
- current lease count
- queue depth
- remaining credits
- last failure count
- task priority

## API endpoints

- `GET /api/agents`
- `GET /api/agents/health?stale_after_seconds=120`
- `POST /api/agents/register`
- `POST /api/agents/{agent_id}/heartbeat`
- `GET /api/dashboard/agents/health`

## MCP tools

- `agent_list`
- `agent_health`
- `agent_register`
- `agent_heartbeat`

## Agent status dashboard

The local-first dashboard shows an `Agent Status` table with:

- agent id and name
- freshness and runtime status
- current task id
- remaining credits
- queue depth
- last heartbeat time

Heartbeat examples:

```json
{
  "status": "running",
  "current_task_id": "task_123",
  "queue_depth": 1,
  "remaining_credits": 42
}
```

Equivalent payload-only form:

```json
{
  "status": "running",
  "current_task_id": "task_123",
  "queue_depth": 1,
  "payload_json": {
    "remaining_credits": 42
  }
}
```

## Health states

Agent health is derived from `last_seen_at`:

- `online`: heartbeat age is less than or equal to `stale_after_seconds`.
- `stale`: heartbeat age is greater than `stale_after_seconds` and less than or equal to three times that value.
- `offline`: no heartbeat exists or heartbeat age exceeds the stale window.

A scheduler tick marks agents as `stale` when `last_seen_at` is older than the configured operational threshold.

## Acceptance criteria

- Agent identity is durable.
- Capabilities are queryable.
- Heartbeat freshness is visible.
- The system can detect stale agents.
- Task claim can filter by required capability.
- Dashboard can show running agents and current lease ownership.
- Dashboard can show agent health, queue depth, current task, current lease, and remaining credits.
