import type { IncomingMessage } from "node:http";

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function isSecureCookieRequest(req: IncomingMessage): boolean {
  const forwardedProto = firstHeader(req.headers["x-forwarded-proto"]);
  if (forwardedProto) return forwardedProto === "https";

  const forwardedHost = firstHeader(req.headers["x-forwarded-host"]);
  const host = forwardedHost || firstHeader(req.headers.host);
  if (!host) return false;

  const hostname = host.split(":")[0].replace(/^\[|\]$/g, "").toLowerCase();
  return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1";
}
