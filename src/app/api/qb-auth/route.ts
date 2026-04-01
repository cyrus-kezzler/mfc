/**
 * QuickBooks OAuth callback route
 *
 * This runs ONCE to get your initial refresh token.
 * After that, the refresh token is stored in Vercel env vars.
 *
 * Steps:
 *   1. Deploy this to Vercel
 *   2. Visit: https://admin.myattsfields.com/api/qb-auth
 *   3. You'll be redirected to Intuit's login
 *   4. After authorising, you'll be redirected back here
 *   5. The page will display your refresh token and realm ID
 *   6. Add both to Vercel environment variables
 *   7. Remove or protect this route
 */

import { NextRequest, NextResponse } from 'next/server'

const CLIENT_ID = process.env.QB_CLIENT_ID!
const CLIENT_SECRET = process.env.QB_CLIENT_SECRET!
const REDIRECT_URI = 'https://admin.myattsfields.com/api/qb-callback'

// Step 1: Redirect to Intuit OAuth
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  if (!searchParams.has('start')) {
    // Show a simple page to start the flow
    return new NextResponse(
      `<html><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;padding:40px">
        <h2>QuickBooks OAuth Setup</h2>
        <p>Click below to connect your QuickBooks account.</p>
        <p style="color:#888;font-size:12px">This only needs to be done once. Store the resulting refresh token in Vercel.</p>
        <a href="/api/qb-auth?start=1" style="display:inline-block;background:#C9A84C;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:16px">
          Connect QuickBooks →
        </a>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  const scopes = ['com.intuit.quickbooks.accounting']
  const state = Math.random().toString(36).substring(2)

  const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2')
  authUrl.searchParams.set('client_id', CLIENT_ID)
  authUrl.searchParams.set('scope', scopes.join(' '))
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', state)

  return NextResponse.redirect(authUrl.toString())
}
