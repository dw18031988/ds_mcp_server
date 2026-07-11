# Orchestrator Cron Job Implementation Plan

> **For agentic workers:** REQUIRED SUB‑SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cron‑based orchestrator that polls DS‑MCP AgentOps for pending tasks, maps them to sub‑agents via `orchestrator/mapping.json`, claims each task, and triggers the appropriate async workflow.

**Architecture:** The orchestrator is a lightweight Node service that exposes an `/api/orchestrate` endpoint. A system cron job invokes this endpoint every N minutes. On each call, it lists pending tasks, looks up the mapping, claims the task, and starts the relevant async workflow via AgentOps APIs.

**Tech Stack:** Node.js (ESM), Supabase (via existing AgentOps SDK), HTTP server (`src/server.ts`), simple JSON config.

## Global Constraints
- Must use existing AgentOps tables (`agentops_tasks`, `task_locks`).
- No new database schema changes.
- All code must be TypeScript and follow the repo’s coding style (strict, no comments unless needed).
- Tests should cover mapping logic, API calls (mocked), and cron trigger.
- Commit after each task; keep commits small and descriptive.

---

## File Structure Overview
| Path | Responsibility |
|------|----------------|
| `orchestrator/mapping.json` | JSON map of `task_type → agent_name`. |
| `src/orchestrator.ts` | Implements `/api/orchestrate` handler. |
| `src/server.ts` | Add route registration for orchestrator endpoint. |
| `cron/orchestrator.sh` (or system crontab entry) | Executes HTTP request to `/api/orchestrate`. |
| `tests/orchestrator.test.ts` | Unit tests for mapping and handler logic. |

## Tasks
### Task 1: Create mapping.json
- **Files:** Create `orchestrator/mapping.json`
- **Content:**
```json
{
  "code-review": "code-reviewer",
  "run-tests": "test-runner"
}
```
- **Step:** Commit.

### Task 2: Implement orchestrator handler (`src/orchestrator.ts`)
- **Files:** Create `src/orchestrator.ts`
- **Imports:** `fetch`, `AgentOpsClient` (existing helper), `zod` for validation.
- **Logic Steps:**
  1. Load mapping.json at module init.
  2. Define async function `handleOrchestrate(req, res)`.
     - GET `/api/tasks?status=pending,queued` via AgentOps client.
     - For each task:
       * Determine agentName = mapping[task.task_type] or skip.
       * POST `/api/tasks/${id}/claim` to claim the task.
       * POST `/api/async-tasks` with `{agent_name: agentName, task_id: id}`.
  3. Return JSON summary {claimed: N, skipped: M}.
- **Testing:** Write unit tests in `tests/orchestrator.test.ts` that mock AgentOps client responses and verify the flow.
- **Commit** after test passes.

### Task 3: Register endpoint in server (`src/server.ts`)
- **Files:** Modify `src/server.ts`
- **Change:** Import `handleOrchestrate` and add route:
```ts
server.registerRoute("POST", "/api/orchestrate", handleOrchestrate);
```
- **Commit**.

### Task 4: Add cron trigger (system crontab)
- **Files:** Create a shell script `cron/run-orchestrator.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
curl -X POST http://localhost:8787/api/orchestrate > /dev/null 2>&1 || true
```
- Make it executable (`chmod +x`).
- Add crontab entry (example every 5 minutes):
```cron
*/5 * * * * /path/to/cron/run-orchestrator.sh
```
- **Commit**.

### Task 5: Update documentation
- **Files:** Update `docs/superpowers/specs/2026-07-10-orchestrator-design.md` to reference the new cron schedule and endpoint path.
- Commit.

### Task 6: Write integration tests (optional but recommended)
- **Files:** Create `tests/integration/orchestrator.integration.test.ts`
- Spin up a test instance of the server, mock AgentOps endpoints via nock or similar, invoke `/api/orchestrate`, assert that tasks were claimed and async workflows started.
- Commit after passing.

## Execution Handoff
Plan complete and saved to `docs/superpowers/plans/2026-07-10-orchestrator-cron-job.md`. Two execution options:
1. **Subagent‑Driven (recommended)** – I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** – Execute tasks in this session using executing‑plans, batch execution with checkpoints.

Which approach would you like to proceed with?