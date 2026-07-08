# Phase 6 - Scheduling

## Objective

Add first-class scheduling for delayed work, recurring work, retries, exponential backoff, timeout detection, and lease expiration.

This removes reliance on ad hoc polling logic scattered across route handlers.

## Capabilities

- Delayed tasks using `tasks.run_after`
- Cron tasks for recurring workflows
- Retry policy per task type
- Exponential backoff after failure
- Timeout detection for long-running tasks
- Lease expiration and requeue
- Scheduler lock to avoid overlapping ticks
- Scheduler event emission
- Scheduler run history

## Tables

Implemented after Phase 2:

- `cron_schedules`
- `retry_policies`
- `scheduler_runs`
- `task_locks`

### cron_schedules

- `id text primary key`
- `workflow_type text not null`
- `cron_expression text not null`
- `timezone text not null default 'UTC'`
- `payload_json jsonb not null default '{}'::jsonb`
- `enabled boolean not null default true`
- `last_run_at timestamptz`
- `next_run_at timestamptz`
- `created_at timestamptz not null default now()`

### retry_policies

- `id text primary key`
- `task_type text not null unique`
- `max_attempts int not null default 3`
- `base_delay_seconds int not null default 30`
- `max_delay_seconds int not null default 3600`
- `backoff_multiplier numeric not null default 2`

### scheduler_runs

- `id text primary key`
- `scheduler_id text not null`
- `started_at timestamptz not null default now()`
- `completed_at timestamptz`
- `status text not null`
- `summary_json jsonb not null default '{}'::jsonb`

## Scheduler loop

Each scheduler tick should:

1. Acquire scheduler lock via `task_locks`.
2. Mark stale agents.
3. Detect expired leases.
4. Requeue eligible tasks or move terminal failures to dead letter.
5. Create due cron tasks.
6. Emit events for every action.
7. Record scheduler run summary.
8. Release scheduler lock.

## Retry behavior

On task failure:

- Increment `attempts` / `retry_count`.
- Load retry policy for task type.
- If attempts remain, set status to `queued` and compute next `run_after` using exponential backoff.
- If attempts are exhausted, move task to `dead_letter_tasks`.
- Emit retry or dead-letter event.

## API endpoints

- `POST /api/scheduler/tick`
- `GET /api/scheduler/runs`
- `GET /api/scheduler/cron-schedules`
- `POST /api/scheduler/cron-schedules`
- `GET /api/scheduler/retry-policies`
- `POST /api/scheduler/retry-policies`

## MCP tools

- `scheduler_tick`
- `scheduler_runs_list`
- `cron_schedules_list`
- `cron_schedule_upsert`
- `retry_policies_list`
- `retry_policy_upsert`

## Acceptance criteria

- Delayed tasks are not claimable before `run_after`.
- Expired leases are detected and handled safely.
- Retry timing follows configured policy.
- Exhausted retries are moved to dead letter.
- Cron schedules do not create duplicate tasks for the same run window.
- Scheduler actions are auditable through events.
- Scheduler run status is visible in dashboard/API.
- Overlapping scheduler ticks are skipped when lock is held.
