# Design Document

## Overview

This design remaps DS MCP documentation, OpenAPI metadata, connector setup guidance, and optional diagnostics from the stale Vercel URL to the current canonical URL:

```txt
https://ds-mcp-server-one.vercel.app
```

The change is intentionally narrow. It should not alter core MCP behavior, GitHub guardrails, async task orchestration, or unrelated application code.

## Architecture

```txt
Operator / ChatGPT / Agent
  |
  | native MCP
  v
https://ds-mcp-server-one.vercel.app/mcp

Operator / Agent REST fallback
  |
  | REST wrapper
  v
https://ds-mcp-server-one.vercel.app/api/...

GitHub webhook
  |
  v
https://ds-mcp-server-one.vercel.app/api/webhooks/github

Repo documentation/config
  |
  +-- README.md
  +-- openapi.yaml
  +-- docs/*.md
  +-- .env.example
  +-- optional route diagnostics
```

## Components and Interfaces

### UrlReferenceAudit

Suggested path:

```txt
manual grep/search task, no new runtime path required
```

Responsibility:

- Find every occurrence of stale DS MCP URLs.
- Classify each occurrence as current production, historical, preview, or test fixture.
- Replace current-production stale URLs with the canonical URL.

Interface:

```ts
type UrlReference = {
  path: string
  line: number
  value: string
  classification: "production" | "historical" | "preview" | "test"
  action: "replace" | "label" | "keep"
}
```

### DocumentationUrlMap

Suggested path:

```txt
README.md
docs/workspace-agent-trigger-setup.md
docs/agentops-admin-ui.md
docs/tasks-xstate-supabase.md
docs/mcp-phase-2-hardening.md
docs/github-binary-downloads.md
```

Responsibility:

- Present the canonical base URL.
- Present MCP, REST, and webhook route examples.
- Document REST fallback when developer MCP is unavailable.

Interface:

```ts
type DsMcpUrlMap = {
  baseUrl: string
  healthUrl: string
  mcpUrl: string
  githubRepoUrl: string
  githubFileUrl: string
  branchUrl: string
  upsertFileUrl: string
  pullRequestUrl: string
  workflowRunsUrl: string
  webhookUrl: string
}
```

### OpenApiServerMap

Suggested path:

```txt
openapi.yaml
```

Responsibility:

- Ensure OpenAPI `servers` uses the current DS MCP production URL.
- Avoid stale server entries unless clearly described as historical or preview.

Interface:

```yaml
servers:
  - url: https://ds-mcp-server-one.vercel.app
    description: DS MCP production
```

### OptionalUrlDiagnosticsRoute

Suggested path:

```txt
src/server.ts
src/agentops/router.ts
src/config.ts
```

Responsibility:

- Expose a safe diagnostic payload if the implementation already has a suitable routing pattern.
- Avoid secrets.
- Keep the route read-only.

Interface:

```ts
type UrlDiagnosticsResponse = {
  service: "ds-mcp-server"
  environment: string
  baseUrl: string
  routes: {
    health: "/health"
    mcp: "/mcp"
    githubRepo: "/api/github/repos/{owner}/{repo}"
    githubFile: "/api/github/repos/{owner}/{repo}/files"
    branch: "/api/github/repos/{owner}/{repo}/branches"
    pullRequest: "/api/github/repos/{owner}/{repo}/pull-requests"
    workflowRuns: "/api/github/repos/{owner}/{repo}/workflow-runs"
    githubWebhook: "/api/webhooks/github"
  }
}
```

## Data Models

### CanonicalUrlConfig

```ts
type CanonicalUrlConfig = {
  productionBaseUrl: "https://ds-mcp-server-one.vercel.app"
  oldBaseUrls: string[]
  environment?: "production" | "preview" | "local"
}
```

Mapping rules:

- `https://ds-mcp-server-theta.vercel.app` maps to `https://ds-mcp-server-one.vercel.app`.
- `/mcp` remains `/mcp`.
- `/health` remains `/health`.
- `/api/webhooks/github` remains `/api/webhooks/github`.
- REST wrapper paths remain unchanged except for the base URL.

### CurlCheck

```ts
type CurlCheck = {
  name: string
  method: "GET" | "POST"
  url: string
  requiresBearer: boolean
  expectedStatus: number[]
}
```

Mapping rules:

- Public checks should cover `/health`.
- Protected REST checks should include bearer header.
- Write checks should use guarded non-main branches only.

## Correctness Properties

### URL Consistency

The production DS MCP base URL must be identical across README, OpenAPI, connector setup docs, and webhook docs.

### Route Stability

Only the base URL should change. REST paths and MCP path must not be renamed unless the server implementation already changed.

### Secret Safety

Diagnostics and docs must never print real bearer tokens, GitHub tokens, webhook secrets, or private env values.

### Guardrail Preservation

GitHub write examples must continue using non-main guarded branches and must not suggest direct writes to `main`.

### Honest Validation

If DNS/network access is unavailable from the agent environment, the final report must say so and provide operator-side curl commands.

## Error Handling

- IF the Vercel URL cannot be reached from the agent environment THEN report it as an environment/network limitation, not as a server outage.
- IF a stale URL occurrence appears in a historical section THEN label it clearly instead of deleting context.
- IF OpenAPI validation fails THEN revert only invalid YAML structure and keep the canonical URL change.
- IF runtime diagnostics are added and route wiring fails THEN remove the route and keep documentation-only diagnostics.
- IF GitHub connector write permission fails THEN produce patch/ZIP output and report that connector write was blocked.

## Testing Strategy

Required checks:

```bash
npm run typecheck
npm run build
npm test
```

Repository search checks:

```bash
grep -R "ds-mcp-server-theta.vercel.app" README.md docs openapi.yaml .env.example src test || true
grep -R "ds-mcp-server-one.vercel.app" README.md docs openapi.yaml .env.example src test || true
```

Manual HTTP checks:

```bash
curl -i https://ds-mcp-server-one.vercel.app/health
curl -i https://ds-mcp-server-one.vercel.app/mcp
curl -i -H "Authorization: Bearer $REST_API_BEARER_TOKEN" \
  https://ds-mcp-server-one.vercel.app/api/github/repos/dw18031988/ds_mcp_server
```

Optional diagnostics check if route is implemented:

```bash
curl -i https://ds-mcp-server-one.vercel.app/api/diagnostics/url-map
```

## Implementation Constraints

- Do not touch unrelated Rental Home code.
- Do not change GitHub guardrails.
- Do not expose tokens or secrets.
- Do not write directly to `main`.
- Use a guarded branch such as `docs/remap-ds-mcp-vercel-url`.
- Prefer documentation/config-only changes unless diagnostics are already easy to add safely.
- Keep route handlers thin if adding diagnostics.
- Run validation honestly and report failures.
