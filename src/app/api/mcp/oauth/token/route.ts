/**
 * OAuth 2.1 token endpoint.
 *
 * Exchanges a valid authorization code (+ PKCE verifier) for an access token.
 * The access token IS the existing MCP_TOKEN, returned verbatim — OAuth is only
 * the wrapper that lets Claude's UI obtain the bearer token. `expires_in` is
 * cosmetic; the underlying token doesn't actually expire (revoke = rotate
 * MCP_TOKEN). No refresh tokens in this MVP.
 */

import { createHash } from "crypto";
import { verifyToken } from "@/lib/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: string, description: string, status = 400): Response {
  return new Response(JSON.stringify({ error, error_description: description }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Accept either form-encoded (the OAuth norm) or JSON bodies. */
async function readBody(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const j = await req.json().catch(() => ({}));
    return j && typeof j === "object" ? (j as Record<string, string>) : {};
  }
  const params = new URLSearchParams(await req.text());
  return Object.fromEntries(params.entries());
}

interface CodePayload {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
}

export async function POST(req: Request): Promise<Response> {
  const body = await readBody(req);

  if (body.grant_type !== "authorization_code") {
    return jsonError("unsupported_grant_type", "Only authorization_code is supported.");
  }

  const payload = verifyToken<CodePayload>(body.code ?? "");
  if (!payload) {
    return jsonError("invalid_grant", "The authorization code is invalid or expired.");
  }

  if (!body.redirect_uri || body.redirect_uri !== payload.redirect_uri) {
    return jsonError("invalid_grant", "redirect_uri does not match the authorization code.");
  }

  // PKCE: base64url(SHA256(verifier)) must equal the stored challenge.
  const verifier = body.code_verifier ?? "";
  const computed = verifier
    ? createHash("sha256").update(verifier).digest("base64url")
    : "";
  if (!computed || computed !== payload.code_challenge) {
    return jsonError("invalid_grant", "PKCE verification failed.");
  }

  const accessToken = process.env.MCP_TOKEN?.trim();
  if (!accessToken) {
    return jsonError("server_error", "MCP not configured.", 500);
  }

  return new Response(
    JSON.stringify({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 2592000, // 30 days — cosmetic; the token doesn't truly expire.
      scope: "mcp",
    }),
    { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
}
