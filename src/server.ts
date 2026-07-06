import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { createMcpServer } from "./mcp.js";

const config = loadConfig();

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, content-type, mcp-session-id"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

function isAuthorized(req: IncomingMessage): boolean {
  if (!config.mcpBearerToken) return true;
  const authHeader = req.headers.authorization;
  return authHeader === `Bearer ${config.mcpBearerToken}`;
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/") {
    return sendJson(res, 200, {
      ok: true,
      service: "design-system-mcp",
      mcp_path: config.mcpPath
    });
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname !== config.mcpPath) {
    return sendJson(res, 404, { error: "Not found" });
  }

  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  if (!req.method || !["POST", "GET", "DELETE"].includes(req.method)) {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const mcpServer = createMcpServer(config);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  res.on("close", () => {
    transport.close();
    mcpServer.close();
  });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("MCP request failed", error);
    if (!res.headersSent) {
      return sendJson(res, 500, { error: "Internal server error" });
    }
  }
});

httpServer.listen(config.port, () => {
  console.log(`Design System MCP listening on http://localhost:${config.port}${config.mcpPath}`);
});
