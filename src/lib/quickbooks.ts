/**
 * QuickBooks Online API client for MFC Dashboard
 *
 * Required environment variables:
 *   QB_CLIENT_ID       — From Intuit Developer Portal
 *   QB_CLIENT_SECRET   — From Intuit Developer Portal
 *   QB_REFRESH_TOKEN   — Long-lived refresh token (see setup guide)
 *   QB_REALM_ID        — Your QuickBooks Company ID
 *
 * Setup steps:
 *   1. Go to https://developer.intuit.com → Create an app
 *   2. Set OAuth 2.0 redirect URI to https://admin.myattsfields.com/api/qb-callback
 *   3. Note your Client ID and Client Secret
 *   4. Run the OAuth flow once (see api/qb-auth/route.ts) to get refresh token
 *   5. Add all four values to Vercel environment variables
 *
 * Token refresh: QuickBooks access tokens expire after 1 hour.
 * Refresh tokens expire after 100 days of inactivity.
 * This client auto-refreshes on each call.
 */

const QB_CLIENT_ID = process.env.QB_CLIENT_ID!
const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET!
const QB_REFRESH_TOKEN = process.env.QB_REFRESH_TOKEN!
const QB_REALM_ID = process.env.QB_REALM_ID!
const QB_BASE_URL = 'https://quickbooks.api.intuit.com'

export interface QBInvoice {
  Id: string
  DocNumber: string
  TxnDate: string
  DueDate: string
  CustomerRef: { value: string; name: string }
  TotalAmt: number
  Balance: number // 0 = paid, >0 = outstanding
  Line: Array<{
    Description?: string
    Amount: number
    SalesItemLineDetail?: {
      ItemRef: { name: string; value: string }
      Qty: number
      UnitPrice: number
    }
  }>
}

export interface QBCustomer {
  Id: string
  DisplayName: string
  Balance: number
}

export interface QBRevenueData {
  ytdRevenue: number
  ytdInvoiceCount: number
  outstandingBalance: number
  overdueInvoices: QBInvoice[]
  recentInvoices: QBInvoice[]
  topCustomers: Array<{ name: string; revenue: number }>
  revenueByMonth: Record<string, number>
}

/** Get a fresh access token using the stored refresh token */
async function getAccessToken(): Promise<string | null> {
  if (!QB_CLIENT_ID || !QB_CLIENT_SECRET || !QB_REFRESH_TOKEN) {
    console.warn('[QuickBooks] Missing credentials — skipping QB data')
    return null
  }

  const credentials = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString('base64')

  try {
    const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: QB_REFRESH_TOKEN,
      }),
    })

    if (!res.ok) {
      console.error('[QuickBooks] Token refresh failed:', await res.text())
      return null
    }

    const data = await res.json()
    return data.access_token
  } catch (err) {
    console.error('[QuickBooks] Token error:', err)
    return null
  }
}

/** Run a QuickBooks query */
async function qbQuery<T>(accessToken: string, query: string): Promise<T | null> {
  const url = `${QB_BASE_URL}/v3/company/${QB_REALM_ID}/query?query=${encodeURIComponent(query)}&minorversion=65`

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      next: { revalidate: 1800 },
    })

    if (!res.ok) {
      console.error('[QuickBooks] Query error:', await res.text())
      return null
    }

    const json = await res.json()
    return json.QueryResponse as T
  } catch (err) {
    console.error('[QuickBooks] Query error:', err)
    return null
  }
}

/** Main function: fetch QB revenue data for the current year */
export async function getQBRevenueData(): Promise<QBRevenueData | null> {
  const accessToken = await getAccessToken()
  if (!accessToken || !QB_REALM_ID) return null

  const currentYear = new Date().getFullYear()
  const since = `${currentYear}-01-01`

  // Fetch all invoices for YTD
  const invoiceQuery = `SELECT * FROM Invoice WHERE TxnDate >= '${since}' ORDERBY TxnDate DESC MAXRESULTS 200`
  const invoiceResponse = await qbQuery<{ Invoice?: QBInvoice[] }>(accessToken, invoiceQuery)
  const invoices = invoiceResponse?.Invoice ?? []

  if (!invoices.length) return null

  // Calculate metrics
  const ytdRevenue = invoices.reduce((sum, inv) => sum + inv.TotalAmt, 0)
  const outstandingBalance = invoices.reduce((sum, inv) => sum + inv.Balance, 0)

  // Overdue: balance > 0 and due date in the past
  const today = new Date().toISOString().split('T')[0]
  const overdueInvoices = invoices
    .filter(inv => inv.Balance > 0 && inv.DueDate < today)
    .slice(0, 10)

  // Revenue by month
  const revenueByMonth: Record<string, number> = {}
  invoices.forEach(inv => {
    const month = inv.TxnDate.substring(0, 7)
    revenueByMonth[month] = (revenueByMonth[month] || 0) + inv.TotalAmt
  })

  // Top customers by YTD revenue
  const customerMap: Record<string, number> = {}
  invoices.forEach(inv => {
    const name = inv.CustomerRef.name
    customerMap[name] = (customerMap[name] || 0) + inv.TotalAmt
  })

  const topCustomers = Object.entries(customerMap)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return {
    ytdRevenue,
    ytdInvoiceCount: invoices.length,
    outstandingBalance,
    overdueInvoices,
    recentInvoices: invoices.slice(0, 15),
    topCustomers,
    revenueByMonth,
  }
}
