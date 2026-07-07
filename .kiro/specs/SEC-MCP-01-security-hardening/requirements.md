# Requirements Document

## Introduction

The Design System MCP server exposes MCP native tools, REST wrapper endpoints, GitHub gateway operations, AgentOps task APIs, workspace-agent callbacks, and dashboard endpoints. Phase 2 already introduced optional REST bearer auth, validation, audit logs, and GitHub file-size limits. This spec defines the next security hardening phase for production use.

Target outcomes:

- Enforce explicit authentication posture for all sensitive routes.
- Reduce risk from leaked bearer tokens or PAT-style GitHub credentials.
- Add durable audit visibility for write actions and security-relevant requests.
- Harden public/dashboard endpoints against accidental data exposure.
- Add safe defaults without exposing destructive GitHub operations.

Non-goals:

- Do not add merge/delete/force-push/secret-management GitHub tools.
- Do not replace the whole MCP protocol implementation.
- Do not introduce a full user-management product.
- Do not change unrelated AgentOps workflow behavior.

## Glossary

| Term | Definition |
|---|---|
| MCP | Model Context Protocol endpoint exposed at `/mcp`. |
| REST wrapper | HTTP `/api/...` endpoints used by Custom GPT Actions or external callers. |
| Sensitive route | Any route that reads private repo data, writes data, triggers agents, exposes task state, or returns operational details. |
| Public route | Route intentionally available without authentication, such as health or limited capabilities. |
| GitHub App token | Short-lived installation token issued from a GitHub App, preferred over long-lived PATs. |
| PAT | Personal Access Token. Higher leakage impact because it is often long-lived and user-scoped. |
| Audit event | Structured event emitted for security-relevant reads, writes, auth failures, callbacks, and GitHub operations. |
| Redaction | Removal or masking of tokens, secrets, authorization headers, and sensitive payload fields from logs/responses. |

## Requirements

### Requirement 1: Explicit Route Authentication Policy

**User Story:** As a system owner, I want every route to have an explicit authentication policy, so that no sensitive endpoint is accidentally public.

#### Acceptance Criteria

1. WHEN the server starts THEN the system SHALL load a route security policy that classifies each route as `public`, `bearer_required`, `internal_token_required`, or `disabled`.
2. WHEN a request targets a sensitive `/api/*` route THEN the system SHALL require valid REST bearer authentication unless the route is explicitly configured as public.
3. WHEN a request targets `/mcp` THEN the system SHALL require MCP bearer authentication when `MCP_BEARER_TOKEN` is configured.
4. WHEN a request targets `/internal/*` callback routes THEN the system SHALL require the dedicated internal callback token and SHALL NOT accept the general REST bearer token.
5. IF a sensitive route has no explicit policy THEN the system SHALL fail closed with `403 Forbidden`.
6. WHEN `/health` is requested THEN the system MAY remain public but SHALL NOT expose secrets, tokens, repository allowlists, or backend URLs.

### Requirement 2: Production Auth Fail-Closed Mode

**User Story:** As an operator, I want production deployments to fail closed when auth secrets are missing, so that an internet-exposed MCP cannot run in insecure mode by mistake.

#### Acceptance Criteria

1. WHEN `NODE_ENV=production` or `SECURITY_ENFORCEMENT=strict` THEN the system SHALL refuse to start if `MCP_BEARER_TOKEN` is missing.
2. WHEN `NODE_ENV=production` or `SECURITY_ENFORCEMENT=strict` THEN the system SHALL refuse to start if `REST_API_BEARER_TOKEN` is missing and any REST sensitive route is enabled.
3. WHEN `WORKSPACE_AGENT_CALLBACK_TOKEN` is missing THEN `/internal/agent-runs/{run_id}/result` SHALL remain unavailable and return a safe error.
4. WHEN startup validation fails THEN the system SHALL log a redacted configuration error and exit non-zero.
5. IF `SECURITY_ENFORCEMENT=relaxed` THEN local development MAY allow missing tokens, but the capability response SHALL clearly show relaxed mode.

### Requirement 3: GitHub Credential Hardening

**User Story:** As a repository owner, I want GitHub access to use least-privilege, short-lived credentials, so that token leakage has limited blast radius.

#### Acceptance Criteria

1. WHEN `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_APP_INSTALLATION_ID` are configured THEN the system SHALL use GitHub App installation tokens instead of `GITHUB_TOKEN`.
2. WHEN both GitHub App configuration and PAT configuration are present THEN GitHub App authentication SHALL take priority.
3. WHEN only `GITHUB_TOKEN` is present THEN the system SHALL continue to work but SHALL report `github_auth_mode: "pat"` in capabilities.
4. WHEN a GitHub token is used THEN the system SHALL NOT include the token value in logs, audit events, API responses, or error messages.
5. WHEN a GitHub operation targets a repo outside `GITHUB_ALLOWED_REPOS` THEN the system SHALL reject the request before calling GitHub.
6. WHEN a write operation targets protected branches such as `main`, `master`, `production`, or `prod` THEN the system SHALL reject the request.

### Requirement 4: Security Audit Events

**User Story:** As an operator, I want durable audit records for security-relevant actions, so that I can investigate misuse, failures, and agent activity.

#### Acceptance Criteria

1. WHEN any write action succeeds or fails THEN the system SHALL emit an audit event with action, source, route, repo, branch, request id, status, and timestamp where available.
2. WHEN authentication fails THEN the system SHALL emit an audit event without recording bearer tokens.
3. WHEN a GitHub read accesses file content or archive/artifact downloads THEN the system SHOULD emit a read audit event.
4. WHEN persistent audit storage is configured THEN the system SHALL write audit events to persistent storage in addition to stdout.
5. IF persistent audit storage fails THEN the request SHOULD continue only if the action itself is safe, and the system SHALL log an audit sink failure.
6. WHEN audit data is returned through APIs or dashboards THEN the system SHALL redact secrets and sensitive payload fields.

### Requirement 5: Request Body, Rate, and Size Controls

**User Story:** As an operator, I want request-level controls, so that malformed or abusive requests cannot exhaust the MCP server.

#### Acceptance Criteria

1. WHEN a JSON request body exceeds `MAX_JSON_BODY_BYTES` THEN the system SHALL reject the request with `413 Payload Too Large`.
2. WHEN a GitHub file upsert exceeds `GITHUB_MAX_FILE_BYTES` THEN the system SHALL reject the request before calling GitHub.
3. WHEN a client exceeds configured rate limits for sensitive routes THEN the system SHALL return `429 Too Many Requests`.
4. WHEN JSON parsing fails THEN the system SHALL return `400 Invalid JSON body` without leaking stack traces.
5. WHEN a request path contains traversal patterns, Windows backslashes, or absolute file paths THEN the system SHALL reject the request.
6. WHEN CORS is configured for production THEN the system SHALL use an allowlist instead of wildcard origins.

### Requirement 6: Public Capability and Dashboard Redaction

**User Story:** As a system owner, I want public diagnostics to be useful but safe, so that connector debugging does not leak operational details.

#### Acceptance Criteria

1. WHEN `/api/capabilities` is public THEN it SHALL expose only boolean configuration status and non-sensitive route/tool names.
2. WHEN `/api/capabilities` reports auth state THEN it SHALL NOT expose token values, backend URLs, private keys, repository secrets, or service-role keys.
3. WHEN upstream dashboard APIs are public THEN they SHALL NOT expose raw authorization headers, bearer tokens, full query strings containing secrets, or sensitive payloads.
4. WHEN `DASHBOARD_AUTH_REQUIRED=true` THEN dashboard HTML and dashboard JSON SHALL require REST bearer authentication.
5. WHEN a user agent or upstream name contains HTML or script content THEN dashboard rendering SHALL escape it before output.
6. WHEN dashboard data is in-memory only THEN the UI SHALL clearly label that it resets on server restart.

### Requirement 7: Security Validation and Regression Tests

**User Story:** As a maintainer, I want automated security tests, so that future endpoint changes do not silently weaken the MCP server.

#### Acceptance Criteria

1. WHEN tests run THEN they SHALL verify sensitive REST routes reject missing or invalid bearer tokens.
2. WHEN tests run THEN they SHALL verify public routes do not expose secrets.
3. WHEN tests run THEN they SHALL verify protected branches cannot be written.
4. WHEN tests run THEN they SHALL verify invalid repo/path inputs are rejected before GitHub calls.
5. WHEN tests run THEN they SHALL verify auth failures produce redacted audit events.
6. WHEN validation completes THEN maintainers SHALL run `npm run typecheck`, `npm run build`, and relevant tests.
