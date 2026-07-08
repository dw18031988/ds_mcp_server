# Phase 4 - Dashboard

## Objective

Add operational pages for workflow orchestration visibility.

The dashboard should show what entered the platform, what is running, what is waiting, what failed, and what needs manual intervention.

## Pages

### Workflow Dashboard

Shows workflow instances by status, type, age, current state, and last event.

### Dashboard Summary

Shows operator-first counts for queued tasks, running agents, agent freshness, waiting work, failed tasks, dead-letter tasks, webhook deliveries, scheduler runs, cron schedules, retry policies, and events.

The summary also exposes a `needs_attention` count so an operator can quickly identify whether waiting, failed, dead-letter, stale-agent, or offline-agent work exists before drilling into detail pages.

### Task Queue

Shows queued tasks, priority, `run_after`, attempts, task type, and workflow id.

### Running Agents

Shows active leases, agent id, task id, lease expiration, and last activity.

### Agent Health

Shows registered agents, capabilities, heartbeat freshness, queue stats, current task, and current lease.

### Waiting: GitHub/Webhooks

Shows workflows waiting for GitHub checks, webhook callbacks, or external events.

### Failed Tasks

Shows retryable failures, attempt count, last error, and next retry time.

### Dead Letter Queue

Shows terminal failures that need manual review or replay.

### Scheduler Runs

Shows scheduler tick history, status, lock outcome, expired leases, requeued tasks, stale agents, and cron workflows created.

### Cron Schedules

Shows recurring workflow schedules, enabled state, last run, and next run.

### Retry Policies

Shows per-task retry behavior, maximum attempts, base delay, cap delay, and backoff multiplier.

### Upstream Calls

Shows inbound calls grouped by upstream/source, method, route, count, and last seen.

### Event Timeline

Shows append-only workflow and task events ordered by time.

## Data source

Dashboard pages must query Supabase tables introduced in Phase 2 and Phase 5/6. Do not use process-local maps for production dashboard data.

## API endpoints

Read-only endpoints:

- `GET /api/dashboard/orchestration`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/workflows`
- `GET /api/dashboard/tasks`
- `GET /api/dashboard/agents/running`
- `GET /api/dashboard/agents/health`
- `GET /api/dashboard/waiting`
- `GET /api/dashboard/failed-tasks`
- `GET /api/dashboard/dead-letter-tasks`
- `GET /api/dashboard/scheduler-runs`
- `GET /api/dashboard/cron-schedules`
- `GET /api/dashboard/retry-policies`
- `GET /api/dashboard/upstream-calls`
- `GET /api/dashboard/events`

## UI principles

- Prefer server-rendered simple HTML for MVP if no frontend app exists.
- Keep auto-refresh conservative, for example 10 to 30 seconds.
- Every row should link to source data when possible.
- Failed and dead-letter states must be visible without logs.
- Avoid destructive controls in first dashboard release.

## Acceptance criteria

- Dashboard data survives server restart.
- Operators can see queued, running, waiting, failed, dead-letter, and scheduler work.
- Operators can read a single summary payload before drilling into detail pages.
- Operators can see stale/offline agent state.
- Operators can see cron schedules, retry policies, and scheduler runs.
- Upstream activity is visible from durable data when persisted.
- Event timeline can reconstruct the lifecycle of one workflow or task.
- No sensitive token or secret is displayed.
