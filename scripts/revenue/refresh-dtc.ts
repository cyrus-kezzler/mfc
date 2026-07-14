/**
 * Refresh the DTC revenue series in src/data/channel-revenue.json from Shopify.
 *
 * Run from the repo root:
 *   npx tsx scripts/revenue/refresh-dtc.ts          # dry run, prints the diff
 *   npx tsx scripts/revenue/refresh-dtc.ts --write  # writes if the basis holds
 *
 * Reads SHOPIFY_* from .env.production.local (`vercel env pull .env.production.local`).
 *
 * WHY THIS SCRIPT EXISTS. The DTC series used to be six numbers a person typed
 * into a data layer, each round to the nearest £100. A board pack read them as
 * source data and recommended defunding the channel on the strength of them.
 * The fix is not "better numbers", it is that the numbers are DERIVED and can be
 * re-derived on demand by anyone, from the source system, in one command.
 *
 * THE BASIS IS THE WHOLE GAME. The committed series uses Shopify's `total_sales`
 * (gross_sales less discounts less returns plus shipping_charges), the figure
 * the Shopify admin shows as Total sales. This script recomputes that from the
 * Admin API order-by-order. If its result does not tie to the committed file, it
 * does NOT overwrite: it prints the divergence and exits non-zero. A refresh
 * that silently changes the meaning of a number is the original sin, and the
 * script refuses to commit it.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { config } from 'dotenv'

config({ path: '.env.production.local', quiet: true })

const { SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = process.env
const WRITE = process.argv.includes('--write')
const API_VERSION = '2025-01'
const DATA_FILE = join(process.cwd(), 'src', 'data', 'channel-revenue.json')

if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
  console.error('Missing SHOPIFY_* env vars. Run: vercel env pull .env.production.local')
  process.exit(1)
}

interface DtcYear {
  orders: number
  grossSales: number
  discounts: number
  returns: number
  netSales: number
  shipping: number
  totalSales: number
}

async function getAccessToken(): Promise<string> {
  const res = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SHOPIFY_CLIENT_ID!,
      client_secret: SHOPIFY_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) throw new Error(`Shopify token failed (${res.status}): ${await res.text()}`)
  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) throw new Error('No access_token in Shopify response')
  return data.access_token
}

const ORDER_QUERY = `
  query Orders($cursor: String) {
    orders(first: 250, after: $cursor, sortKey: PROCESSED_AT, query: "financial_status:paid OR financial_status:partially_paid OR financial_status:partially_refunded OR financial_status:refunded") {
      edges {
        node {
          processedAt
          currentSubtotalPriceSet { shopMoney { amount } }
          subtotalPriceSet { shopMoney { amount } }
          totalDiscountsSet { shopMoney { amount } }
          totalShippingPriceSet { shopMoney { amount } }
          totalRefundedSet { shopMoney { amount } }
          totalPriceSet { shopMoney { amount } }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`

type OrderNode = {
  processedAt: string
  subtotalPriceSet: { shopMoney: { amount: string } }
  totalDiscountsSet: { shopMoney: { amount: string } }
  totalShippingPriceSet: { shopMoney: { amount: string } }
  totalRefundedSet: { shopMoney: { amount: string } }
  totalPriceSet: { shopMoney: { amount: string } }
}

async function pullOrders(token: string): Promise<OrderNode[]> {
  const all: OrderNode[] = []
  let cursor: string | null = null
  let page = 0
  for (;;) {
    page++
    const res = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query: ORDER_QUERY, variables: { cursor } }),
      },
    )
    const json = (await res.json()) as {
      data?: { orders: { edges: Array<{ node: OrderNode }>; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }
      errors?: Array<{ message: string }>
    }
    if (json.errors?.length) throw new Error(`GraphQL: ${json.errors.map(e => e.message).join('; ')}`)
    if (!json.data) throw new Error('No data in GraphQL response')

    const { edges, pageInfo } = json.data.orders
    all.push(...edges.map(e => e.node))
    process.stdout.write(`  page ${String(page).padStart(3)} → ${all.length} orders\n`)
    if (!pageInfo.hasNextPage) break
    cursor = pageInfo.endCursor
    await new Promise(r => setTimeout(r, 120))
  }
  return all
}

const money = (v: { shopMoney: { amount: string } } | null | undefined): number =>
  v ? parseFloat(v.shopMoney.amount) : 0
const round2 = (n: number) => Math.round(n * 100) / 100

function aggregate(orders: OrderNode[]): Record<string, DtcYear> {
  const years: Record<string, DtcYear> = {}
  for (const o of orders) {
    const year = o.processedAt.slice(0, 4)
    const y = (years[year] ??= {
      orders: 0,
      grossSales: 0,
      discounts: 0,
      returns: 0,
      netSales: 0,
      shipping: 0,
      totalSales: 0,
    })
    // gross_sales in Shopify's model is the line-item total BEFORE discounts.
    const discounts = money(o.totalDiscountsSet)
    const gross = money(o.subtotalPriceSet) + discounts
    const returned = money(o.totalRefundedSet)
    const shipping = money(o.totalShippingPriceSet)

    y.orders += 1
    y.grossSales += gross
    y.discounts -= discounts
    y.returns -= returned
    y.shipping += shipping
  }
  for (const y of Object.values(years)) {
    y.grossSales = round2(y.grossSales)
    y.discounts = round2(y.discounts)
    y.returns = round2(y.returns)
    y.shipping = round2(y.shipping)
    y.netSales = round2(y.grossSales + y.discounts + y.returns)
    y.totalSales = round2(y.netSales + y.shipping)
  }
  return years
}

async function main() {
  console.log(`Shop: ${SHOPIFY_STORE_DOMAIN}`)
  console.log(`Mode: ${WRITE ? 'WRITE (will commit changes if the basis holds)' : 'DRY RUN'}`)
  console.log('')

  const file = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  const committed: Record<string, DtcYear> = file.dtc.years

  console.log('Pulling orders from Shopify:')
  const token = await getAccessToken()
  const orders = await pullOrders(token)
  const fresh = aggregate(orders)
  console.log('')

  // Compare against the committed series, year by year, on totalSales.
  const currentYear = String(new Date().getFullYear())
  const allYears = [...new Set([...Object.keys(committed), ...Object.keys(fresh)])].sort()
  let drift = 0

  console.log('Year   committed      fresh          delta')
  for (const year of allYears) {
    const c = committed[year]?.totalSales ?? null
    const f = fresh[year]?.totalSales ?? null
    const delta = c !== null && f !== null ? round2(f - c) : null
    // The current year is expected to move: it is still happening.
    const expected = year === currentYear
    if (!expected && delta !== null && Math.abs(delta) > 0.01) drift++
    const flag = expected ? '(current year, expected to move)' : delta && Math.abs(delta) > 0.01 ? '  ← DRIFT' : ''
    console.log(
      `${year}   ${(c ?? 0).toFixed(2).padStart(10)}   ${(f ?? 0).toFixed(2).padStart(10)}   ${(delta ?? 0)
        .toFixed(2)
        .padStart(9)} ${flag}`,
    )
  }
  console.log('')

  if (drift > 0) {
    console.error(`REFUSING TO WRITE. ${drift} closed year(s) moved.`)
    console.error('')
    console.error('A closed year should not change. If it has, one of two things is true:')
    console.error('  (a) this script computes total_sales on a different basis than the')
    console.error('      committed series did (which came from ShopifyQL), or')
    console.error('  (b) historical orders were edited or refunded in Shopify.')
    console.error('')
    console.error('Either way, a human decides. Silently overwriting a number whose meaning')
    console.error('has changed underneath it is exactly the failure this file exists to end.')
    process.exit(1)
  }

  if (!WRITE) {
    console.log('Dry run only. The basis holds. Re-run with --write to commit the refresh.')
    return
  }

  file.dtc.years = fresh
  file.dtc.asOf = new Date().toISOString().slice(0, 10)
  file.dtc.method = `Shopify Admin GraphQL (${API_VERSION}), aggregated by scripts/revenue/refresh-dtc.ts. Basis: total_sales = gross_sales less discounts less returns plus shipping.`
  file.generatedAt = new Date().toISOString().slice(0, 10)
  writeFileSync(DATA_FILE, JSON.stringify(file, null, 2) + '\n')
  console.log(`Written. DTC series refreshed to ${file.dtc.asOf}.`)
  console.log('Commit the change so the provenance is in git history.')
}

main().catch(err => {
  console.error('FATAL:', err.message ?? err)
  process.exit(1)
})
