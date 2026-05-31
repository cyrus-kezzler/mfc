/**
 * OAuth 2.1 discovery — MCP-scoped well-known location.
 * Mirrors /.well-known/oauth-authorization-server. No auth.
 */

import { oauthMetadata } from "@/lib/mcp/oauth-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request): Response {
  return oauthMetadata(req);
}

export function OPTIONS(): Response {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
