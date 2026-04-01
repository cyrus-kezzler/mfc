/**
 * QuickBooks OAuth callback — exchanges code for refresh token
 * Add REDIRECT_URI = https://admin.myattsfields.com/api/qb-callback
 * to your Intuit app settings
 */

import { NextRequest, NextResponse } from 'next/server'

const CLIENT_ID = process.env.QB_CLIENT_ID!
const CLIENT_SECRET = process.env.QB_CLIENT_SECRET!
const REDIRECT_URI = 'https://admin.myattsfields.com/api/qb-callback'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')

  if (!code || !realmId) {
    return new NextResponse('Missing code or realmId', { status: 400 })
  }

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

  const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenRes.ok) {
    return new NextResponse(`Token exchange failed: ${JSON.stringify(tokenData)}`, { status: 500 })
  }

  const { refresh_token, access_token } = tokenData

  // Display the tokens — copy these to Vercel env vars
  return new NextResponse(
    `<html><body style="background:#0a0a0a;color:#fff;font-family:monospace;padding:40px">
      <h2 style="color:#C9A84C">✓ QuickBooks Connected</h2>
      <p>Add these to your Vercel environment variables:</p>
      <br/>
      <div style="background:#111;border:1px solid #333;padding:20px;border-radius:8px">
        <p><strong style="color:#888">QB_REALM_ID</strong><br/><span style="color:#4caf50">${realmId}</span></p>
        <p><strong style="color:#888">QB_REFRESH_TOKEN</strong><br/><span style="color:#4caf50;word-break:break-all">${refresh_token}</span></p>
      </div>
      <br/>
      <p style="color:#888;font-size:12px">⚠️ Remove or protect /api/qb-auth and /api/qb-callback once setup is complete.</p>
      <a href="/dashboard" style="display:inline-block;background:#C9A84C;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:16px">
        Go to Dashboard →
      </a>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
