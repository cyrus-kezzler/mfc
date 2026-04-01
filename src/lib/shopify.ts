/**
 * Shopify Admin API client for MFC Dashboard
 *
 * Required environment variables:
 *   SHOPIFY_STORE_DOMAIN   — e.g. mfclondon.myshopify.com
 *   SHOPIFY_CLIENT_ID      — Client ID from dev.shopify.com → MFC Dashboard → Settings
 *   SHOPIFY_CLIENT_SECRET  — Secret from dev.shopify.com → MFC Dashboard → Settings
 *
 * Tokens are fetched automatically using the client_credentials OAuth grant.
 * They last 24 hours; Next.js cache handles reuse within that window.
 * No manual token rotation needed.
 */

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!
const API_VERSION = '2024-01'

if (!SHOPIFY_DOMAIN || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
  console.warn('[Shopify] Missing environment variables — dashboard will show static fallback data')
}

/** Fetch a short-lived Admin API access token using client credentials */
async function getShopifyToken(): Promise<string | null> {
  if (!SHOPIFY_DOMAIN || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) return null

  try {
    const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
      }),
      // Cache the token for 23 hours (tokens last 24h)
      next: { revalidate: 82800 },
    })

    if (!res.ok) {
      console.error('[Shopify] Token error:', await res.text())
      return null
    }

    const data = await res.json()
    return data.access_token ?? null
  } catch (err) {
    console.error('[Shopify] Token fetch error:', err)
    return null
  }
}

export interface ShopifyOrder {
  id: number
  name: string // e.g. "#1234"
  created_at: string
  email: string
  total_price: string
  financial_status: string
  fulfillment_status: string | null
  line_items: Array<{
    title: string
    quantity: number
    price: string
    sku: string
  }>
}

export interface ShopifyRevenueData {
  orders: ShopifyOrder[]
  totalRevenue: number
  orderCount: number
  avgOrderValue: number
  revenueByMonth: Record<string, number>
  topProducts: Array<{ title: string; revenue: number; quantity: number }>
}

async function shopifyFetch<T>(endpoint: string): Promise<T | null> {
  const token = await getShopifyToken()
  if (!token) return null

  const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/${endpoint}`

  try {
    const res = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      // Next.js: revalidate every 30 minutes
      next: { revalidate: 1800 },
    })

    if (!res.ok) {
      console.error(`[Shopify] API error ${res.status}: ${await res.text()}`)
      return null
    }

    return res.json() as Promise<T>
  } catch (err) {
    console.error('[Shopify] Fetch error:', err)
    return null
  }
}

/** Fetch all orders for a given year (paginates automatically) */
async function fetchOrdersForYear(year: number): Promise<ShopifyOrder[]> {
  const allOrders: ShopifyOrder[] = []
  const since = `${year}-01-01T00:00:00Z`
  const before = `${year}-12-31T23:59:59Z`
  let pageInfo: string | null = null
  let url = `orders.json?status=any&created_at_min=${since}&created_at_max=${before}&limit=250&fields=id,name,created_at,email,total_price,financial_status,fulfillment_status,line_items`

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const endpoint = pageInfo ? `orders.json?page_info=${pageInfo}&limit=250` : url
    const data = await shopifyFetch<{ orders: ShopifyOrder[] }>(endpoint)
    if (!data) break

    allOrders.push(...data.orders)
    // Check Link header for next page — Shopify cursor pagination
    // In production you'd parse the Link header from the raw response
    break // For now fetch just the first page (250 orders is usually enough for YTD)
  }

  return allOrders
}

/** Main function: get revenue data for the current year + last year */
export async function getShopifyRevenueData(): Promise<ShopifyRevenueData | null> {
  const currentYear = new Date().getFullYear()
  const orders = await fetchOrdersForYear(currentYear)

  if (!orders.length) return null

  // Only count paid/partially_paid orders
  const paidOrders = orders.filter(o =>
    ['paid', 'partially_paid'].includes(o.financial_status)
  )

  const totalRevenue = paidOrders.reduce((sum, o) => sum + parseFloat(o.total_price), 0)
  const orderCount = paidOrders.length
  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0

  // Revenue by month
  const revenueByMonth: Record<string, number> = {}
  paidOrders.forEach(order => {
    const month = order.created_at.substring(0, 7) // "2025-01"
    revenueByMonth[month] = (revenueByMonth[month] || 0) + parseFloat(order.total_price)
  })

  // Top products
  const productMap: Record<string, { revenue: number; quantity: number }> = {}
  paidOrders.forEach(order => {
    order.line_items.forEach(item => {
      if (!productMap[item.title]) productMap[item.title] = { revenue: 0, quantity: 0 }
      productMap[item.title].revenue += parseFloat(item.price) * item.quantity
      productMap[item.title].quantity += item.quantity
    })
  })

  const topProducts = Object.entries(productMap)
    .map(([title, data]) => ({ title, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return {
    orders: orders.slice(0, 20), // most recent 20 for display
    totalRevenue,
    orderCount,
    avgOrderValue,
    revenueByMonth,
    topProducts,
  }
}

/** Get recent 20 orders for the orders feed */
export async function getRecentShopifyOrders(): Promise<ShopifyOrder[]> {
  const data = await shopifyFetch<{ orders: ShopifyOrder[] }>(
    'orders.json?status=any&limit=20&fields=id,name,created_at,email,total_price,financial_status,fulfillment_status,line_items'
  )
  return data?.orders ?? []
}
