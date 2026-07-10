# MCP Phase 2 Hardening

This phase adds safety and production-readiness controls around the Design System MCP server and REST Actions gateway.

## Changes

- Optional REST API bearer auth using `REST_API_BEARER_TOKEN`.
- Public capability endpoint at `GET /api/capabilities
GET /api/diagnostics/url-map`.
- Zod validation for GitHub REST write payloads.
- Audit log events for REST and MCP write actions.
- Service version bump to `0.3.0`.
- Configurable GitHub file size limit using `GITHUB_MAX_FILE_BYTES`.

## REST auth behavior

If `REST_API_BEARER_TOKEN` is not set, REST behavior remains backward-compatible.

If `REST_API_BEARER_TOKEN` is set, all `/api/*` routes require:

```http
Authorization: Bearer <REST_API_BEARER_TOKEN>
```

Exception:

```text
GET /api/capabilities
```

These endpoints stay public for connector/tool debugging and do not expose secrets.

## Capability and URL diagnostics checks

```bash
curl https://ds-mcp-server-one.vercel.app/api/capabilities
curl https://ds-mcp-server-one.vercel.app/api/diagnostics/url-map
```

Expected fields:

```text
service
version
mcp_path
mcp_tools
rest_paths
guardrails
auth
```

## Audit log format

Write actions log structured JSON to stdout:

```json
{
  "level": "audit",
  "timestamp": "2026-07-06T00:00:00.000Z",
  "action": "github_create_pr",
  "source": "mcp",
  "owner": "nhatnguyenquang1838-coder",
  "repo": "ds_mcp_server",
  "branch": "ai/example",
  "pr_number": 123,
  "status": "success"
}
```

Vercel runtime logs can be used as the audit sink for MVP.

## New env vars

```env
REST_API_BEARER_TOKEN=
GITHUB_MAX_FILE_BYTES=256000
```

## Recommended next phase

Phase 3 should replace PAT-based GitHub access with GitHub App installation tokens and add persistent audit storage.
