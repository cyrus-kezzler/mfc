/**
 * OAuth 2.1 Dynamic Client Registration.
 *
 * Claude POSTs its desired redirect_uris; we allowlist them against Claude's
 * known callbacks and hand back a signed `client_id` (a JWT carrying those
 * redirect_uris). There is no client_secret — this is a public PKCE client.
 */

import { signToken, CLAUDE_REDIRECT_URIS } from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: string, description: string, status = 400): Response {
  return new Response(JSON.stringify({ error, error_description: description }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request): Promise<Response> {
  let body: { redirect_uris?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid_request", "Request body is not valid JSON.");
  }

  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return jsonError("invalid_redirect_uri", "redirect_uris must be a non-empty array.");
  }

  for (const uri of redirectUris) {
    if (typeof uri !== "string" || !CLAUDE_REDIRECT_URIS.includes(uri)) {
      return jsonError("invalid_redirect_uri", `Unsupported redirect_uri: ${String(uri)}`);
    }
  }

  // 1-year client_id. PKCE protects the flow, so a long-lived public id is fine.
  const clientId = signToken({ redirect_uris: redirectUris }, 60 * 60 * 24 * 365);

  return new Response(
    JSON.stringify({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
    }),
    { status: 201, headers: { "Content-Type": "application/json" } },
  );
}
