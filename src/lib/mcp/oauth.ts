/**
 * Back Bar MCP connector — OAuth 2.1 wrapper helpers.
 *
 * Claude's custom-connector UI speaks only OAuth 2.1 (with Dynamic Client
 * Registration + PKCE), not raw bearer tokens. This module is the thin,
 * stateless glue that lets that UI obtain the existing MCP bearer token
 * through a flow it understands. There is NO database: every piece of
 * short-lived OAuth state (client_id, authorization_code) is a signed JWT
 * that verifies by HMAC signature alone.
 *
 *   client_id           — signed JWT { redirect_uris }, 1-year expiry.
 *   authorization_code  — signed JWT { client_id, redirect_uri, code_challenge,
 *                          code_challenge_method }, 60-second expiry.
 *   access_token        — the existing MCP_TOKEN, returned verbatim. Not a JWT.
 *
 * Trade-off accepted: an issued access token can't be revoked without rotating
 * MCP_TOKEN itself. See the README for the full picture.
 *
 * Compact HS256 JWTs, hand-rolled on Node's crypto — no external dependency.
 */

import { createHmac, timingSafeEqual } from "crypto";

/** The only redirect targets we will ever hand an authorization code to. */
export const CLAUDE_REDIRECT_URIS = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
];

/** base64url-encode a string or Buffer (no padding). */
function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/** The HMAC key, read lazily so a missing env var fails at call time. */
function signingKey(): Buffer {
  const key = process.env.MCP_OAUTH_SIGNING_KEY?.trim();
  if (!key) throw new Error("MCP_OAUTH_SIGNING_KEY is not set");
  return Buffer.from(key, "utf8");
}

const HEADER = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

/**
 * Sign a payload into a compact HS256 JWT. `iat` and `exp` are added
 * automatically; `exp` is `now + expiresInSeconds`.
 */
export function signToken(payload: object, expiresInSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };
  const data = `${HEADER}.${base64url(JSON.stringify(body))}`;
  const sig = createHmac("sha256", signingKey()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/**
 * Verify a compact HS256 JWT and return its payload, or `null` if the token is
 * malformed, the signature doesn't match, or it has expired. Never throws.
 */
export function verifyToken<T = object>(token: string): T | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const data = `${parts[0]}.${parts[1]}`;
  let expected: Buffer;
  try {
    expected = createHmac("sha256", signingKey()).update(data).digest();
  } catch {
    return null; // signing key not configured
  }

  const provided = Buffer.from(parts[2], "base64url");
  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return null;
  }

  let parsed: { exp?: number };
  try {
    parsed = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof parsed.exp === "number" && Math.floor(Date.now() / 1000) >= parsed.exp) {
    return null; // expired
  }

  return parsed as T;
}

/**
 * Absolute base URL for this deployment, honouring Vercel's proxy headers so
 * discovery metadata advertises the public host (admin.myattsfields.com), not
 * an internal one. Falls back to the request URL's origin.
 */
export function baseUrl(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
