# Design System MCP Server

Self-hosted MCP server for connecting ChatGPT / Workspace Agents to a Design System backend and guarded GitHub workflows.

See `docs/async-task-orchestration-design.md` for the proposed async workflow/task engine design.

## What this provides

This server supports two integration modes:

| Mode | Endpoint | Use case |
|---|---|---|
| MCP native connector | `/mcp` | ChatGPT Apps & Connectors / MCP connector |
| REST wrapper | `/api/...` | Custom GPT Actions using OpenAPI YAML |

Design System MCP tools:

| Tool | Type | Purpose |
|---|---|---|
| `ds_ping` | read | Health check from ChatGPT |
| `ds_get_request` | read | Fetch design request context by `request_id` |
| `ds_submit_agent_result` | write | Submit a completed agent review result back to the system |
