---
name: orchestrator-design
description: Design for a cron‑based task orchestrator that pulls pending tasks from DS‑MCP AgentOps and routes them to sub‑agents based on task_type.
type: design
---

# Orchestrator Design (2026-07-10)

## Overview
The orchestrator is a lightweight service that runs on a schedule (cron). On each tick it:
1. Queries the DS‑MCP AgentOps API for all tasks with `state` **pending** or **queued**.
2. For every task, it looks up a mapping from `task.task_type` to an agent name defined in `orchestrator/mapping.json`.
3. Claims the task via `/api/tasks/{id}/claim`, which sets `assigned_agent_id` and locks the task for this orchestrator instance.
4. Starts the appropriate async workflow by POSTing to `/api/async-tasks` with payload `{ agent_name, task_id }`.
5. Returns a summary of claimed tasks.

The orchestrator itself is stateless; all state (task claims, locks, retries) lives in AgentOps’ Supabase tables.

## Components
| Component | Responsibility |
|-----------|----------------|
| **Cron Scheduler** | Triggers the orchestrator every N minutes. Implemented with Node‑cron or system cron invoking a small script (`orchestrator/run.js`). |
| **Orchestrator Service** | Implements `/api/orchestrate` endpoint; performs task listing, mapping, claiming, and workflow triggering. |
| **Mapping Config** (`orchestrator/mapping.json`) | JSON file that maps `task_type` → agent name. Example: `{"code-review":"code-reviewer", "run-tests":"test-runner"}` |
| **Sub‑Agents / Async Workflows** | Existing AgentOps async workflows (e.g., `code-reviewer`, `test-runner`). Each receives a task ID and updates the task state to *completed* or *failed*. |
| **Monitoring** | `/api/dashboard/orchestration` already exposes pending tasks, running agents, dead‑letter tasks. The orchestrator logs summary metrics (claimed count, errors). |

## Data Flow
```
Cron -> orchestrator.run.js
    -> GET /api/tasks?status=pending
        for each task:
            mapping[task.task_type] => agentName
            POST /api/tasks/{id}/claim
            POST /api/async-tasks {agent_name, task_id}
    -> return summary
```

## Error & Retry Handling
* **Claim failure** – if the task is already claimed or locked, skip and log.
* **Workflow start failure** – record in task events; rely on AgentOps retry policy (max_attempts, backoff) to re‑attempt.
* **Mapping miss** – mark task as *unhandled* via a custom event (`task_unmapped`) and optionally send an alert.

## Scheduling & Idempotency
* The cron job must be idempotent; it only claims tasks that are still pending. If the orchestrator crashes mid‑tick, already claimed tasks remain locked until their async workflow completes or expires.
* Use `task_locks` table to avoid duplicate runs if multiple orchestrator instances are accidentally started.

## Security & Permissions
* The orchestrator runs with the same service account that calls AgentOps APIs; no new permissions required.
* No direct GitHub API usage – all interactions go through AgentOps, which enforces repo/branch restrictions.

## Extensibility
* Add a new sub‑agent: create its async workflow and add an entry to `mapping.json`.
* Change scheduling frequency by editing the cron expression in the system’s crontab or the script.

---
