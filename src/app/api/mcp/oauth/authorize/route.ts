/**
 * OAuth 2.1 authorization endpoint.
 *
 * GET  — validate the request, then render a password gate styled like /login.
 * POST — re-validate, check the back-bar password (AUTH_PASSWORD) in constant
 *        time, and on success 302 to Claude's callback with a signed code.
 *
 * The "user consent" here is simply: whoever knows the back-bar password may
 * mint an authorization code. The code is a 60-second JWT bound to the PKCE
 * challenge, so it's useless without the matching verifier at the token step.
 */

import { timingSafeEqual } from "crypto";
import { signToken, verifyToken, CLAUDE_REDIRECT_URIS } from "@/lib/mcp/oauth";
import { COLOR } from "@/lib/design";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Request params ─────────────────────────────────────────────────────────

interface AuthorizeParams {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  code_challenge: string;
  code_challenge_method: string;
  state: string;
  scope: string;
}

function readParams(src: URLSearchParams | FormData): AuthorizeParams {
  const get = (k: string) => (src.get(k) ?? "").toString();
  return {
    client_id: get("client_id"),
    redirect_uri: get("redirect_uri"),
    response_type: get("response_type"),
    code_challenge: get("code_challenge"),
    code_challenge_method: get("code_challenge_method"),
    state: get("state"),
    scope: get("scope"),
  };
}

/**
 * Validate the request against the signed client_id and the PKCE/response_type
 * constraints. Returns an error string, or null if the request is well-formed.
 * The redirect_uri must be both registered (in the client_id) AND a known
 * Claude callback — this is the flow's most important security boundary.
 */
function validate(p: AuthorizeParams): string | null {
  const client = verifyToken<{ redirect_uris?: string[] }>(p.client_id);
  if (!client || !Array.isArray(client.redirect_uris)) {
    return "Invalid or expired client registration.";
  }
  if (
    !p.redirect_uri ||
    !client.redirect_uris.includes(p.redirect_uri) ||
    !CLAUDE_REDIRECT_URIS.includes(p.redirect_uri)
  ) {
    return "Unrecognised redirect URI.";
  }
  if (p.response_type !== "code") {
    return "Only response_type=code is supported.";
  }
  if (p.code_challenge_method !== "S256") {
    return "Only the S256 PKCE method is supported.";
  }
  if (!p.code_challenge) {
    return "A PKCE code_challenge is required.";
  }
  return null;
}

// ─── Password check ─────────────────────────────────────────────────────────

function passwordMatches(presented: string): boolean {
  const expected = process.env.AUTH_PASSWORD ?? "";
  if (!expected) return false;
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ─── HTML ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";

function page(inner: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorize Claude — The Back Bar</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    background: ${COLOR.paper}; color: ${COLOR.ink};
    display: flex; align-items: center; justify-content: center;
    padding: 40px 20px; font-family: ${SANS};
  }
  .wrap { width: 100%; max-width: 360px; }
  .eyebrow {
    font-size: 10px; color: ${COLOR.accent}; margin: 0 0 14px;
    text-transform: uppercase; letter-spacing: 0.12em; text-align: center;
  }
  h1 {
    font-family: ${SERIF}; font-size: 40px; font-weight: 400;
    letter-spacing: -0.025em; line-height: 1.05; margin: 0;
    color: ${COLOR.ink}; text-align: center;
  }
  .lede {
    font-family: ${SERIF}; font-style: italic; font-size: 14px;
    color: ${COLOR.muted}; margin: 14px 0 0; line-height: 1.5; text-align: center;
  }
  .scope {
    font-size: 13px; color: ${COLOR.inkSoft}; line-height: 1.6;
    margin: 28px 0 0; text-align: center;
  }
  form { display: flex; flex-direction: column; gap: 14px; margin-top: 28px; }
  input[type=password] {
    width: 100%; padding: 14px 16px; font-size: 15px; outline: none;
    background: transparent; border: 1px solid ${COLOR.rule};
    color: ${COLOR.ink}; font-family: ${SANS};
  }
  button {
    width: 100%; padding: 14px 16px; font-size: 12px;
    background: ${COLOR.ink}; color: ${COLOR.paper}; border: none;
    cursor: pointer; text-transform: uppercase; letter-spacing: 0.1em;
  }
  .error {
    text-align: center; font-size: 13px; font-family: ${SERIF};
    font-style: italic; color: ${COLOR.flag}; margin: 0;
  }
</style>
</head>
<body><div class="wrap">${inner}</div></body>
</html>`;
}

function errorPage(message: string): string {
  return page(`
    <p class="eyebrow">Myatt&rsquo;s Fields Cocktails</p>
    <h1>The Back Bar</h1>
    <p class="lede">This authorization request can&rsquo;t be completed.</p>
    <p class="error" style="margin-top:24px">${esc(message)}</p>
  `);
}

function consentPage(p: AuthorizeParams, showError: boolean): string {
  const hidden = (["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state", "scope"] as const)
    .map((k) => `<input type="hidden" name="${k}" value="${esc(p[k])}">`)
    .join("\n      ");
  return page(`
    <p class="eyebrow">Myatt&rsquo;s Fields Cocktails</p>
    <h1>Authorize Claude to access The Back Bar.</h1>
    <p class="scope">This grants Claude full read and write access to pricing, ingredients, and revenue. You can revoke access by rotating <code>MCP_TOKEN</code> in Vercel.</p>
    <form method="POST">
      ${hidden}
      <input type="password" name="password" placeholder="Back Bar password" required autofocus autocomplete="current-password">
      <button type="submit">Authorize</button>
      ${showError ? '<p class="error">Incorrect password</p>' : ""}
    </form>
  `);
}

// ─── Handlers ───────────────────────────────────────────────────────────────

export function GET(req: Request): Response {
  const params = readParams(new URL(req.url).searchParams);
  const err = validate(params);
  if (err) return htmlResponse(errorPage(err), 400);
  return htmlResponse(consentPage(params, false));
}

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const params = readParams(form);

  const err = validate(params);
  if (err) return htmlResponse(errorPage(err), 400);

  const password = (form.get("password") ?? "").toString();
  if (!passwordMatches(password)) {
    return htmlResponse(consentPage(params, true), 401);
  }

  // Password correct → mint a 60-second authorization code bound to the PKCE
  // challenge and this exact redirect_uri.
  const code = signToken(
    {
      client_id: params.client_id,
      redirect_uri: params.redirect_uri,
      code_challenge: params.code_challenge,
      code_challenge_method: params.code_challenge_method,
    },
    60,
  );

  const dest = new URL(params.redirect_uri);
  dest.searchParams.set("code", code);
  if (params.state) dest.searchParams.set("state", params.state);

  return new Response(null, { status: 302, headers: { Location: dest.toString() } });
}
