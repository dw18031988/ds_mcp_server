export type AppConfig = {
  port: number;
  mcpPath: string;
  mcpBearerToken?: string;
  designSystemBackendUrl?: string;
  internalAgentResultToken?: string;
};

function readPort(value: string | undefined): number {
  if (!value) return 8787;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT: ${value}`);
  }
  return parsed;
}

export function loadConfig(): AppConfig {
  return {
    port: readPort(process.env.PORT),
    mcpPath: process.env.MCP_PATH || "/mcp",
    mcpBearerToken: process.env.MCP_BEARER_TOKEN || undefined,
    designSystemBackendUrl: process.env.DS_BACKEND_URL || undefined,
    internalAgentResultToken: process.env.INTERNAL_AGENT_RESULT_TOKEN || undefined
  };
}
