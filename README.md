This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Back Bar MCP connector

The app exposes a Model Context Protocol server at `/api/mcp` so trusted AI
agents can read and write Back Bar business data (pricing, ingredients,
revenue). There are two ways to connect:

- **Bearer (programmatic).** Call `/api/mcp` directly with
  `Authorization: Bearer <MCP_TOKEN>` (full read+write) or
  `Authorization: Bearer <MCP_READONLY_TOKEN>` (read-only). This is the path for
  curl and scripts — unchanged and primary.
- **OAuth 2.1 (Claude connector UI).** Claude's "Add custom connector" UI only
  speaks OAuth, not raw bearer tokens. A thin OAuth 2.1 wrapper sits on top of
  the bearer machinery: Claude does Dynamic Client Registration + PKCE, the user
  enters the Back Bar password on a consent screen, and the token endpoint hands
  back **the existing `MCP_TOKEN` verbatim as the `access_token`**. OAuth is only
  a wrapper to obtain the bearer token through a flow Claude understands — it
  does not replace or change bearer auth.

To connect via Claude: Settings → Connectors → Add custom connector → URL
`https://admin.myattsfields.com/api/mcp` (no client ID/secret). Claude walks the
password prompt and connects.

**Revoking access** means rotating `MCP_TOKEN` in Vercel. Because the OAuth
access token *is* `MCP_TOKEN`, there is no per-client revocation — rotating the
token invalidates every issued grant at once.

### OAuth wrapper internals

Stateless by design — no database, no KV. Short-lived OAuth state is encoded as
HMAC-SHA256 signed JWTs (`src/lib/mcp/oauth.ts`):

- `client_id` — signed JWT `{ redirect_uris }`, 1-year expiry. Issued by DCR.
- `authorization_code` — signed JWT bound to the PKCE challenge and redirect_uri,
  60-second expiry.
- `access_token` — the existing `MCP_TOKEN`, not a JWT.

`redirect_uri` is strictly allowlisted to Claude's callbacks
(`https://claude.ai/api/mcp/auth_callback`, `https://claude.com/...`) — this is
the flow's key security boundary against open-redirect token leaks.

Discovery metadata is served (unauthenticated) at both
`/.well-known/oauth-authorization-server` and
`/api/mcp/.well-known/oauth-authorization-server`.

### Environment variables

| Var | Purpose |
| --- | --- |
| `MCP_TOKEN` | Full read+write bearer token. Also the OAuth `access_token`. |
| `MCP_READONLY_TOKEN` | Optional read-only bearer token. |
| `MCP_OAUTH_SIGNING_KEY` | HMAC key for signing OAuth JWTs. Generate 48 bytes of URL-safe base64 entropy (`openssl rand -base64 48 \| tr '+/' '-_' \| tr -d '='`). Set in Vercel Production. |
| `AUTH_PASSWORD` | The Back Bar password; checked on the OAuth consent screen (same as `/login`). |

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
