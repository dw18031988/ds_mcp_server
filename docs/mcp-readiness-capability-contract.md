# DS MCP Readiness and Capability Contract

## Purpose

This contract keeps the MCP tool surface, runtime readiness, authentication state, write capability, startup validation, and error reporting synchronized.

The default failure mode is safe:

```text
unknown readiness -> block write
missing capability -> block write
auth uncertain -> block write
schema mismatch -> block write
plugin disabled -> block write
```

## Readiness response

`ds_ping` and `/health` return additive readiness metadata:

```json
{
  "ok": true,
  "enabled": true,
  "authenticated": true,
  "write_enabled": true,
  "service": "ds-mcp-server-one",
  "runtime_id": "runtime-or-deployment-id",
  "schema_version": "sha256:<hash>",
  "capabilities_version": "sha256:<hash>",
  "startup_validated": true
}
```

Field meanings:

| Field | Meaning |
|---|---|
| `ok` | The readiness check completed. |
| `enabled` | Runtime/plugin is enabled in this environment. |
| `authenticated` | Required auth is configured or the non-production relaxed runtime does not require it. |
| `write_enabled` | State-changing operations may dispatch. |
| `service` | Stable service identifier. |
| `runtime_id` | Runtime/deployment identifier from config or platform environment. |
| `schema_version` | Hash of the readiness schema contract. |
| `capabilities_version` | Hash of deterministic capability metadata. |
| `startup_validated` | Security and capability startup checks passed. |

When write readiness fails but read-only dependencies are healthy, the response includes:

```json
{
  "degraded_mode": "read_only"
}
```

## Capabilities response

`get_capabilities` and `/api/capabilities` return authoritative capability metadata in `methods`.

Each entry follows this shape:

```json
{
  "name": "task_transition",
  "transport": "mcp",
  "enabled": true,
  "read_only": false,
  "write_capable": true,
  "required_gate": "G2_EXECUTION",
  "requires_auth": true,
  "runtime_available": true
}
```

Disabled methods remain visible in capability metadata with a sanitized `disabled_reason`, but write-capable disabled methods are not exposed through the MCP tool list because the SDK list handler only returns registered enabled tools.

## Pre-dispatch guard

Every write-capable MCP handler is wrapped by the readiness guard before it can call downstream state, Supabase, GitHub, audit, or async workflow logic.

REST write routes are guarded before route handlers run. The guard covers state-changing DS MCP methods, including:

```text
task_transition
async_task_submit_result
async_task_claim
task_create
task_update
github_upsert_file
github_create_branch
github_create_pr
github_comment_pr
```

Additional write-capable orchestration and scheduler methods are registered in the same capability registry.

## Structured errors

Disabled runtime/plugin:

```json
{
  "ok": false,
  "error": {
    "code": "PLUGIN_DISABLED",
    "service": "ds-mcp-server-one",
    "retryable": false,
    "details": "The plugin is registered but disabled in the current runtime.",
    "method": "task_transition",
    "request_id": "req-123"
  }
}
```

Schema/runtime drift:

```json
{
  "ok": false,
  "error": {
    "code": "TOOL_REGISTRY_DRIFT",
    "service": "ds-mcp-server-one",
    "retryable": false,
    "details": "The exposed tool schema does not match the active runtime capability registry.",
    "method": "task_transition",
    "request_id": "req-123"
  }
}
```

Errors preserve request IDs when available and never include raw secrets, bearer tokens, environment variable values, private keys, or connection strings.

## Startup drift validation

Startup compares:

```text
exposed_tool_names
runtime_capability_names
enabled_runtime_tool_names
```

If a schema/runtime mismatch is detected, strict runtime exits at startup. Relaxed non-production runtime logs a sanitized warning and blocks write-capable operations through the pre-dispatch guard.

## Configuration

| Environment key | Default | Meaning |
|---|---:|---|
| `DS_MCP_RUNTIME_ENABLED` / `RUNTIME_ENABLED` | `true` | Enables or disables runtime/plugin availability. |
| `DS_MCP_WRITE_ENABLED` / `WRITE_ENABLED` | `true` | Enables or disables state-changing operations. |
| `DS_MCP_RUNTIME_ID` / `RUNTIME_ID` | platform/runtime fallback | Stable runtime identifier shown in readiness. |

## Non-goals

This contract does not change:

- task state-machine semantics;
- Supabase schema or production data;
- OAuth provider behavior;
- GitHub connector authentication behavior;
- deployment settings;
- merge, deploy, credential, migration, or production-data authority.
