/**
 * Back Bar MCP connector — authentication.
 *
 * The MCP route is a machine-to-machine endpoint, so it does NOT use the
 * browser shared-password cookie. It authenticates with a bearer token
 * presented in the `Authorization` header.
 *
 * Environment variables (set in Vercel):
 *   MCP_TOKEN           — full read + write access (Owner).
 *   MCP_READONLY_TOKEN  — optional; read-only access (Operator).
 *
 * Fail-closed: if neither token is configured the endpoint rejects every
 * request, so the connector can never be left unintentionally open.
 */

import { timingSafeEqual } from "crypto";
import type { AccessLevel } from "./types";

/** Constant-time string comparison that tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Pull the bearer token out of an `Authorization` header value. */
function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Resolve the access level for an incoming request.
 * Returns `null` when the request is unauthenticated or the server has no
 * tokens configured.
 */
export function resolveAccess(authHeader: string | null): AccessLevel | null {
  const fullToken = process.env.MCP_TOKEN?.trim() || "";
  const readToken = process.env.MCP_READONLY_TOKEN?.trim() || "";

  // Fail closed: nothing configured → endpoint is effectively disabled.
  if (!fullToken && !readToken) return null;

  const presented = bearerToken(authHeader);
  if (!presented) return null;

  if (fullToken && safeEqual(presented, fullToken)) return "write";
  if (readToken && safeEqual(presented, readToken)) return "read";
  return null;
}

/** True when the server has at least one token configured. */
export function isConfigured(): boolean {
  return Boolean(process.env.MCP_TOKEN?.trim() || process.env.MCP_READONLY_TOKEN?.trim());
}
