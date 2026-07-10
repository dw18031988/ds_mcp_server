# Requirements Document

## Introduction

The DS MCP server URL currently used in documentation and connector guidance is stale. The old URL `https://ds-mcp-server-theta.vercel.app` must be replaced or normalized to the current Vercel URL `https://ds-mcp-server-one.vercel.app`.

The target outcome is a single canonical DS MCP base URL used consistently across README, OpenAPI, docs, webhook setup, connector setup, and any runtime examples. The task must also add lightweight diagnostics so future URL drift can be detected quickly.

Non-goals:

- Do not redesign the MCP protocol implementation.
- Do not change GitHub write guardrails.
- Do not rotate or expose secrets.
- Do not deploy unrelated Rental Home changes.
- Do not change business logic outside URL/config/diagnostic surfaces.

## Glossary

| Term | Definition |
|---|---|
| Canonical DS MCP URL | The single production base URL selected for DS MCP access. |
| Old DS MCP URL | `https://ds-mcp-server-theta.vercel.app`. |
| New DS MCP URL | `https://ds-mcp-server-one.vercel.app`. |
| REST wrapper | The HTTP API surface under `/api/...` used when native MCP is unavailable. |
| MCP endpoint | The native MCP endpoint exposed at `/mcp`. |
| Health endpoint | The liveness endpoint exposed at `/health`. |
| Connector config | ChatGPT/OpenAI connector setup that points to the DS MCP server URL. |
| URL drift | A mismatch between deployed URL, docs, OpenAPI servers, and connector instructions. |

## Requirements

### Requirement 1: Canonical URL Remapping

**User Story:** As a DS MCP operator, I want all references to the DS MCP production URL remapped to the current Vercel URL, so that agents and connectors do not call stale endpoints.

#### Acceptance Criteria

1. WHEN the repo contains `ds-mcp-server-theta.vercel.app` THEN the implementation SHALL replace it with `ds-mcp-server-one.vercel.app` unless the occurrence is explicitly historical.
2. WHEN documentation shows REST examples THEN the examples SHALL use `https://ds-mcp-server-one.vercel.app` as the base URL.
3. WHEN documentation shows MCP setup THEN the MCP URL SHALL be `https://ds-mcp-server-one.vercel.app/mcp`.
4. IF a historical reference must remain THEN the implementation SHALL label it as historical and not as the current production URL.
5. WHEN the task is complete THEN there SHALL be no unlabeled stale production URL references.

### Requirement 2: REST and MCP Route Mapping

**User Story:** As a workspace agent integrator, I want the REST and MCP routes documented against the correct base URL, so that fallback flows work when developer MCP is unavailable.

#### Acceptance Criteria

1. WHEN the README lists REST routes THEN it SHALL include current examples for `/health`, `/mcp`, `/api/github/repos/{owner}/{repo}`, `/files`, `/branches`, `/pull-requests`, and `/workflow-runs`.
2. WHEN the docs mention GitHub webhook setup THEN the webhook URL SHALL use `https://ds-mcp-server-one.vercel.app/api/webhooks/github`.
3. WHEN the docs mention REST bearer usage THEN they SHALL show `Authorization: Bearer $REST_API_BEARER_TOKEN`.
4. IF native MCP is unavailable THEN the docs SHOULD clearly show REST fallback commands.
5. WHEN route examples are updated THEN route paths SHALL remain consistent with the existing server implementation.

### Requirement 3: OpenAPI and Connector Consistency

**User Story:** As a connector publisher, I want OpenAPI and connector-facing metadata to use the same server URL, so that ChatGPT connector setup does not drift from the deployed service.

#### Acceptance Criteria

1. WHEN `openapi.yaml` contains server URLs THEN the current production server SHALL be `https://ds-mcp-server-one.vercel.app`.
2. WHEN connector setup docs contain a server URL THEN the current production server SHALL match OpenAPI.
3. IF multiple environments are documented THEN the production environment SHALL be clearly distinguished from preview or historical environments.
4. WHEN the change is complete THEN README, OpenAPI, and connector docs SHALL agree on the same production base URL.
5. WHEN stale URL references remain in tests or examples THEN they SHALL be intentional and documented.

### Requirement 4: URL Diagnostics

**User Story:** As a DS MCP maintainer, I want a lightweight diagnostic route or documented check for URL mapping, so that future sessions can verify the active base URL quickly.

#### Acceptance Criteria

1. WHEN `/health` is called THEN the response SHOULD include enough information to identify the running service and environment without exposing secrets.
2. WHEN diagnostics are added THEN they SHALL NOT expose tokens, GitHub secrets, or bearer values.
3. IF a new `/api/diagnostics/url-map` route is added THEN it SHALL return the configured base URL, MCP path, REST paths, and webhook path.
4. WHEN diagnostics cannot be added safely in this task THEN the docs SHALL include manual `curl` checks as a fallback.
5. WHEN validation runs THEN the diagnostic changes SHALL pass typecheck and build.

### Requirement 5: Validation and Regression Safety

**User Story:** As a delivery owner, I want the URL remap validated with automated and manual checks, so that the change does not break existing DS MCP behavior.

#### Acceptance Criteria

1. WHEN code or config changes are made THEN `npm run typecheck` SHALL pass or failures SHALL be reported honestly.
2. WHEN code or config changes are made THEN `npm run build` SHALL pass or failures SHALL be reported honestly.
3. WHEN tests exist for affected routes THEN relevant tests SHALL run or skipped status SHALL be justified.
4. IF network calls cannot run in the agent environment THEN the final report SHALL include exact curl commands for operator-side verification.
5. WHEN a PR is opened THEN CI SHALL be monitored according to the project rule.
