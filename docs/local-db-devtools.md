# Local Runtime With Configured Supabase DB

## Goal

Support running the MCP server locally while connecting to a configured Supabase database, and provide guarded dev tools to inspect or switch the active runtime mode and database target.

## Runtime model

Runtime mode and database target are intentionally separate:

| Field | Purpose |
|---|---|
| `DS_MCP_APP_RUNTIME_MODE` | Describes where the server process is running, such as `local`, `development`, `staging`, or `production`. |
| `DS_MCP_SUPABASE_ACTIVE_DB_TARGET` | Selects which configured Supabase profile the process uses. |
| `DS_MCP_DEV_TOOLS_ENABLED` | Enables guarded switch endpoints. Keep disabled by default. |
| `DS_MCP_DEV_TOOLS_ALLOW_REAL_DB_SWITCH` | Allows switching to guarded database targets: `real`, `production`, or `prod`. |

This allows `DS_MCP_APP_RUNTIME_MODE=local` with `DS_MCP_SUPABASE_ACTIVE_DB_TARGET=real` for local debugging against the configured DB.

The same runtime switch is also exposed in the localhost admin page at `/admin` when dev tools are enabled.
If `.env.local` is present, the admin page auto-seeds the local REST bearer token on load.
The admin page also includes a "Check env issues" modal that lists missing or broken env values and shows a copyable fix snippet.

For local startup, the server automatically loads `.env` and `.env.local` if they exist in the project root.

If strict mode is enabled locally before the `security_rate_limit_acquire` RPC is deployed, the server falls back to in-memory rate limiting instead of failing every request. Production expects the rate-limit RPC and OAuth tables to exist on the configured Supabase project, and startup now fails fast if the URL/key pair or schema is wrong.

## Database profiles

The default profile is still read from existing variables:

```env
DS_MCP_SUPABASE_URL=
DS_MCP_SUPABASE_SERVICE_ROLE_KEY=
```

Named profiles are optional:

```env
DS_MCP_SUPABASE_REAL_URL=
DS_MCP_SUPABASE_REAL_SERVICE_ROLE_KEY=
DS_MCP_SUPABASE_LOCAL_URL=
DS_MCP_SUPABASE_LOCAL_SERVICE_ROLE_KEY=
DS_MCP_SUPABASE_DEVELOPMENT_URL=
DS_MCP_SUPABASE_DEVELOPMENT_SERVICE_ROLE_KEY=
DS_MCP_SUPABASE_STAGING_URL=
DS_MCP_SUPABASE_STAGING_SERVICE_ROLE_KEY=
DS_MCP_SUPABASE_PRODUCTION_URL=
DS_MCP_SUPABASE_PRODUCTION_SERVICE_ROLE_KEY=
```

`real` falls back to `DS_MCP_SUPABASE_URL` and `DS_MCP_SUPABASE_SERVICE_ROLE_KEY` when `DS_MCP_SUPABASE_REAL_URL` and `DS_MCP_SUPABASE_REAL_SERVICE_ROLE_KEY` are not set.

## Dev tool endpoints

All routes are under `/api/*`, so they are protected by `DS_MCP_REST_API_BEARER_TOKEN` when that token is configured.

### Inspect current environment

```bash
curl http://localhost:8787/api/dev/environment
```

Response returns masked status only. It exposes the Supabase host and key-configured flags, not secret values.

### Switch runtime mode and database target

```bash
curl -X POST http://localhost:8787/api/dev/environment \
  -H "Content-Type: application/json" \
  -d '{"runtime_mode":"local","db_target":"real"}'
```

To switch to `real`, `production`, or `prod`, set:

```env
DS_MCP_DEV_TOOLS_ALLOW_REAL_DB_SWITCH=true
```

## Safety rules

- Dev tools are disabled unless `DS_MCP_DEV_TOOLS_ENABLED=true`.
- Switching to guarded DB targets requires `DS_MCP_DEV_TOOLS_ALLOW_REAL_DB_SWITCH=true`.
- Secret values are not returned by status endpoints.
- Existing Supabase client cache resets naturally because the cache key changes when URL/key changes.
- Do not expose these endpoints publicly without `DS_MCP_REST_API_BEARER_TOKEN`.
