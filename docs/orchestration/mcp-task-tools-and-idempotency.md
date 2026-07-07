# MCP Task Tools and Idempotency

## Objective

Expose AgentOps task orchestration through native MCP tools and make UI mutation calls retry-safe.

## Native MCP tools

Task tools:

- `task_list`
- `task_get`
- `task_create`
- `task_update`
- `task_transition`
- `task_links_list`
- `task_link_create`
- `task_events_list`

Async workflow tools:

- `async_workflow_create`
- `async_workflow_get`
- `async_task_claim`
- `async_task_submit_result`
- `github_ci_event_handle`

Agent tools:

- `agent_list`
- `agent_register`
- `agent_heartbeat`

Ops tools:

- `scheduler_tick`
- `dashboard_snapshot`

## UI duplicate prevention contract

For every user-triggered write action, the UI should:

1. Generate one stable `idempotency_key` per click/action.
2. Disable the submit button while the request is in-flight.
3. Reuse the same `idempotency_key` if the same request is retried after timeout/network error.
4. Re-enable the button only after success/failure is handled.
5. Refresh task state after any transition response.

Recommended key format:

```text
<action>:<task-or-form-id>:<timestamp-or-uuid>
```

Examples:

```json
{
  "idempotency_key": "task-create:quick-filter-pills:018f9bb2"
}
```

```json
{
  "transition": "SUBMIT",
  "actor": "user",
  "actor_id": "dw",
  "idempotency_key": "task-transition:task_123:submit:018f9bb3"
}
```

## Backend behavior

- `task_create` accepts `idempotency_key` and stores it on `agentops_tasks`.
- `task_transition` accepts `idempotency_key` and stores it on `agentops_task_events`.
- `task_link_create` checks existing active links before insert.
- DB constraints prevent duplicate active links and duplicate idempotent task mutations.
- Transition updates are guarded by the current task state to reduce double-submit races.

## Migration

`supabase/migrations/20260707162000_agentops_idempotency.sql`

Adds:

- `agentops_tasks.idempotency_key`
- `agentops_task_events.idempotency_key`
- unique idempotency index for tasks
- unique idempotency index for task events
- unique active task link index
