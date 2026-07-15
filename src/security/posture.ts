import type { AppConfig } from "../config.js";
import { summarizeSecurityConfig, type SecurityStartupSummary } from "./startupValidation.js";
import { getSecuritySignalSnapshot, type SecuritySignalSnapshot } from "./monitoring.js";

export type SecurityControlStatus = {
  name: string;
  configured: boolean;
  severity: "ok" | "warn";
  detail?: string;
};

export type SecurityPostureSnapshot = {
  ok: true;
  generated_at: string;
  summary: SecurityStartupSummary;
  controls: SecurityControlStatus[];
  signals: SecuritySignalSnapshot;
};

function control(
  name: string,
  configured: boolean,
  detail?: string,
  severity: "ok" | "warn" = configured ? "ok" : "warn"
): SecurityControlStatus {
  return { name, configured, severity, detail };
}

export function buildSecurityPosture(
  config: AppConfig,
  signals = getSecuritySignalSnapshot()
): SecurityPostureSnapshot {
  const summary = summarizeSecurityConfig(config);

  return {
    ok: true,
    generated_at: new Date().toISOString(),
    summary,
    controls: [
      control("REST bearer", summary.restBearerConfigured, "REST_API_BEARER_TOKEN"),
      control("MCP bearer", summary.mcpBearerConfigured, "MCP_BEARER_TOKEN"),
      control("MCP URL secret", summary.mcpUrlSecretConfigured, "MCP_URL_SECRET"),
      control("MCP OAuth", summary.mcpOAuthConfigured, "Supabase-backed MCP OAuth"),
      control(
        "Admin OAuth",
        summary.adminOAuthConfigured,
        "Supabase URL + anon key + OAuth provider"
      ),
      control(
        "Admin email allowlist",
        summary.adminAllowlistConfigured,
        "DS_MCP_SUPABASE_ADMIN_ALLOWED_EMAILS"
      ),
      control("GitHub webhook", summary.webhookSecretConfigured, "GITHUB_WEBHOOK_SECRET"),
      control("Internal callback", summary.internalCallbackConfigured, "WORKSPACE_AGENT_CALLBACK_TOKEN"),
      control("Supabase", summary.supabaseConfigured, "Supabase URL + service role"),
      control(
        "CORS allowlist",
        summary.corsAllowedOrigins > 0,
        `Origins configured: ${summary.corsAllowedOrigins}`
      )
    ],
    signals
  };
}
