import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ZodError } from "zod";
import { loadConfig } from "./config.js";
import { createMcpServer } from "./mcp.js";
import { agentResultSchema } from "./schemas.js";
import { forwardAgentResultToBackend } from "./tools/backendClient.js";
import { getDesignRequest, submitAgentResult } from "./tools/designSystemStore.js";

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

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");

  if (!rawBody.trim()) {
    return {};
  }

  return JSON.parse(rawBody) as unknown;
}

async function handleRestApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  if (req.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return true;
  }

  const designRequestMatch = url.pathname.match(/^\/api\/design-requests\/([^/]+)$/);

  if (req.method === "GET" && designRequestMatch) {
    setCorsHeaders(res);
    const requestId = decodeURIComponent(designRequestMatch[1] ?? "");
    const designRequest = await getDesignRequest(requestId);

    if (designRequest.status === "not_found") {
      sendJson(res, 404, designRequest);
      return true;
    }

    sendJson(res, 200, designRequest);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/agent-results") {
    setCorsHeaders(res);

    try {
      const body = await readJsonBody(req);
      const parsed = agentResultSchema.parse(body);

      await submitAgentResult(parsed);
      const forwardResult = await forwardAgentResultToBackend(config, parsed);

      sendJson(res, 200, {
        ok: true,
        request_id: parsed.request_id,
        stored: true,
        forwarded_to_backend: forwardResult.forwarded,
        backend_status: forwardResult.status
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(res, 400, { error: "Invalid JSON body" });
        return true;
      }

      if (error instanceof ZodError) {
        sendJson(res, 400, {
          error: "Invalid agent result payload",
          details: error.flatten()
        });
        return true;
      }

      console.error("REST agent result failed", error);
      sendJson(res, 500, { error: "Internal server error" });
    }

    return true;
  }

  return false;
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/") {
    return sendJson(res, 200, {
      ok: true,
      service: "design-system-mcp",
      mcp_path: config.mcpPath,
      rest_paths: ["/api/design-requests/{request_id}", "/api/agent-results"]
    });
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { ok: true });
  }

  const handledRestApi = await handleRestApi(req, res, url);
  if (handledRestApi) return;

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
