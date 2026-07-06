# GitHub binary-safe downloads

This change adds fallback REST endpoints for GitHub artifacts and repo archive downloads.

## Required GitHub token permissions

Use a fine-grained PAT or GitHub App installation token with at least:

```text
Contents: Read and write
Actions: Read-only
Metadata: Read-only
```

## New endpoints

### List workflow run artifacts

```http
GET /api/github/repos/{owner}/{repo}/actions/runs/{run_id}/artifacts
```

Example:

```bash
curl "https://ds-mcp-server-theta.vercel.app/api/github/repos/nhatnguyenquang1838-coder/ds_mcp_server/actions/runs/123456/artifacts"
```

### Download workflow artifact ZIP

```http
GET /api/github/repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip
```

This endpoint returns `application/zip` and a `Content-Disposition` attachment filename.

Example:

```bash
curl -L -o artifact.zip "https://ds-mcp-server-theta.vercel.app/api/github/repos/nhatnguyenquang1838-coder/ds_mcp_server/actions/artifacts/987654/zip"
```

### Download repo archive ZIP

```http
GET /api/github/repos/{owner}/{repo}/archive?ref=main
```

This endpoint returns a zipball for a branch, tag, or commit ref.

Example:

```bash
curl -L -o repo-main.zip "https://ds-mcp-server-theta.vercel.app/api/github/repos/nhatnguyenquang1838-coder/ds_mcp_server/archive?ref=main"
```

## Notes

- These endpoints are binary-safe and do not try to decode ZIP files as UTF-8.
- Repo allowlist rules still apply through `GITHUB_ALLOWED_REPOS`.
- If `REST_API_BEARER_TOKEN` is configured, callers must pass `Authorization: Bearer <token>`.
- Very large artifacts or archives may still hit hosting/runtime response-size limits.
