import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.js";
import type { AppConfig } from "../src/config.js";
import { getEnvironmentStatus, switchRuntimeEnvironment } from "../src/devtools/environment.js";

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 8787,
    mcpPath: "/mcp",
    runtimeMode: "local",
    securityEnforcement: "relaxed",
    corsAllowedOrigins: [],
    maxJsonBodyBytes: 1_048_576,
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 120,
    activeDbTarget: "default",
    devToolsEnabled: true,
    devToolsAllowRealDbSwitch: false,
    databaseProfiles: {
      default: {
        target: "default",
        supabaseUrl: "https://default.example.supabase.co",
        supabaseServiceRoleKey: "default-key"
      },
      production: {
        target: "production",
        supabaseUrl: "https://production.example.supabase.co",
        supabaseServiceRoleKey: "production-key"
      }
    },
    supabaseUrl: "https://default.example.supabase.co",
    supabaseServiceRoleKey: "default-key",
    githubAllowedRepos: [],
    githubDefaultBaseBranch: "main",
    githubAllowedBranchPrefixes: [],
    githubMaxFileBytes: 1_048_576,
    dsUploadSessionTtlSeconds: 3600,
    dsUploadChunkMaxBytes: 1_048_576,
    dsUploadMaxFileBytes: 10_485_760,
    dsUploadStorage: "memory",
    workspaceAgentApiBaseUrl: "https://api.chatgpt.com",
    ...overrides
  };
}

test("getEnvironmentStatus marks production targets as guarded", () => {
  const status = getEnvironmentStatus(makeConfig());
  const productionProfile = status.database.profiles.find((profile) => profile.target === "production");

  assert.equal(status.runtime_mode, "local");
  assert.equal(status.active_db_target, "default");
  assert.equal(productionProfile?.real_database_guard_required, true);
  assert.equal(productionProfile?.configured, true);
});

test("switchRuntimeEnvironment can wire localhost to production when guarded switch is allowed", () => {
  const config = makeConfig({
    devToolsAllowRealDbSwitch: true
  });

  const status = switchRuntimeEnvironment(config, {
    runtime_mode: "production",
    db_target: "production"
  });

  assert.equal(config.runtimeMode, "production");
  assert.equal(config.activeDbTarget, "production");
  assert.equal(config.supabaseUrl, "https://production.example.supabase.co");
  assert.equal(config.supabaseServiceRoleKey, "production-key");
  assert.equal(status.runtime_mode, "production");
  assert.equal(status.active_db_target, "production");
});

test("switchRuntimeEnvironment blocks guarded production switches unless explicitly allowed", () => {
  assert.throws(
    () =>
      switchRuntimeEnvironment(makeConfig(), {
        runtime_mode: "production",
        db_target: "production"
      }),
    /DEV_TOOLS_ALLOW_REAL_DB_SWITCH=true/
  );
});

test("loadConfig prefers DS_MCP-prefixed environment variables", () => {
  const keys = [
    "DS_MCP_PORT",
    "DS_MCP_APP_RUNTIME_MODE",
    "DS_MCP_SUPABASE_ACTIVE_DB_TARGET",
    "DS_MCP_SUPABASE_PRODUCTION_URL",
    "DS_MCP_SUPABASE_PRODUCTION_SERVICE_ROLE_KEY"
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));

  try {
    process.env.DS_MCP_PORT = "9998";
    process.env.DS_MCP_APP_RUNTIME_MODE = "development";
    process.env.DS_MCP_SUPABASE_ACTIVE_DB_TARGET = "production";
    process.env.DS_MCP_SUPABASE_PRODUCTION_URL = "https://prefix.example.supabase.co";
    process.env.DS_MCP_SUPABASE_PRODUCTION_SERVICE_ROLE_KEY = "prefix-key";

    const config = loadConfig();

    assert.equal(config.port, 9998);
    assert.equal(config.runtimeMode, "development");
    assert.equal(config.activeDbTarget, "production");
    assert.equal(config.supabaseUrl, "https://prefix.example.supabase.co");
    assert.equal(config.supabaseServiceRoleKey, "prefix-key");
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
