/**
 * Back Bar MCP connector — OAuth 2.1 authorization-server metadata.
 *
 * Shared by the two discovery routes (root and /api/mcp). Different MCP clients
 * probe different well-known locations; both mount this same handler so neither
 * lookup can fail.
 */

import { baseUrl } from "./oauth";

export function oauthMetadata(req: Request): Response {
  const issuer = baseUrl(req);
  const body = {
    issuer,
    authorization_endpoint: `${issuer}/api/mcp/oauth/authorize`,
    token_endpoint: `${issuer}/api/mcp/oauth/token`,
    registration_endpoint: `${issuer}/api/mcp/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp"],
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
