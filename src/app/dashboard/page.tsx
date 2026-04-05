import { getShopifyRevenueData, getRecentShopifyOrders } from '@/lib/shopify'
import { getQBRevenueData } from '@/lib/quickbooks'
import {
  STATIC_ANNUAL_REVENUE,
  STATIC_TOP_CUSTOMERS,
  STATIC_TOP_PRODUCTS_DTC,
  STATIC_ALERTS,
} from '@/lib/static-data'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtShort(n: number) {
  if (n >= 1000) return `£${(n / 1000).toFixed(1)}k`
  return fmt(n)
}

function pct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
  warning,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
  warning?: boolean
}) {
  return (
    <div
      style={{
        background: accent ? '#1a1a1a' : '#111',
        border: `1px solid ${warning ? '#c0392b' : accent ? '#C9A84C' : '#2a2a2a'}`,
        borderRadius: 8,
        padding: '20px 24px',
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: 2, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent ? '#C9A84C' : '#fff', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: warning ? '#e74c3c' : '#888', marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title, live }: { title: string; live?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <h2 style={{ fontSize: 13, letterSpacing: 2, color: '#888', textTransform: 'uppercase', margin: 0 }}>
        {title}
      </h2>
      {live && (
        <span style={{
          fontSize: 10,
          background: '#0f3d1a',
          color: '#4caf50',
          border: '1px solid #2d7a3a',
          borderRadius: 12,
          padding: '2px 8px',
          letterSpacing: 1,
        }}>
          LIVE
        </span>
      )}
      {!live && (
        <span style={{
          fontSize: 10,
          background: '#1a1a00',
          color: '#aaa',
          border: '1px solid #333',
          borderRadius: 12,
          padding: '2px 8px',
          letterSpacing: 1,
        }}>
          STATIC
        </span>
      )}
    </div>
  )
}

function AlertBanner({ type, title, message }: { type: 'warning' | 'info'; title: string; message: string }) {
  const isWarning = type === 'warning'
  return (
    <div style={{
      background: isWarning ? '#1a0a0a' : '#0a0f1a',
      border: `1px solid ${isWarning ? '#5a1a1a' : '#1a2a4a'}`,
      borderLeft: `3px solid ${isWarning ? '#c0392b' : '#2980b9'}`,
      borderRadius: 6,
      padding: '12px 16px',
      display: 'flex',
      gap: 12,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{isWarning ? '⚠️' : 'ℹ️'}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: isWarning ? '#e74c3c' : '#5dade2', marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{message}</div>
      </div>
    </div>
  )
}

// ─── Revenue Table ────────────────────────────────────────────────────────────

function RevenueHistoryTable() {
  const rows = [...STATIC_ANNUAL_REVENUE].reverse()
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['Year', 'DTC (Shopify)', 'Wholesale', 'Total', 'YoY'].map(col => (
              <th key={col} style={{
                textAlign: col === 'Year' ? 'left' : 'right',
                padding: '8px 12px',
                color: '#555',
                fontWeight: 500,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
                borderBottom: '1px solid #222',
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const prevTotal = rows[i + 1]?.total ?? null
            const yoyPct = prevTotal ? ((row.total - prevTotal) / prevTotal) * 100 : null
            const isCurrentYear = row.year === String(new Date().getFullYear())
            return (
              <tr key={row.year} style={{ background: isCurrentYear ? '#161610' : 'transparent' }}>
                <td style={{ padding: '10px 12px', color: isCurrentYear ? '#C9A84C' : '#ccc', fontWeight: isCurrentYear ? 600 : 400 }}>
                  {row.year}{isCurrentYear ? ' YTD' : ''}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#888' }}>{fmt(row.dtc)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#ccc' }}>{fmt(row.wholesale)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fff', fontWeight: 600 }}>{fmt(row.total)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: yoyPct === null ? '#444' : yoyPct >= 0 ? '#4caf50' : '#e74c3c' }}>
                  {yoyPct === null ? '—' : pct(yoyPct)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Customer Table ───────────────────────────────────────────────────────────

function TopCustomersTable() {
  const totalWholesale2024 = STATIC_TOP_CUSTOMERS.reduce((s, c) => s + c.revenue2024, 0)
  const topTwoShare = (STATIC_TOP_CUSTOMERS[0].revenue2024 + STATIC_TOP_CUSTOMERS[1].revenue2024) / totalWholesale2024

  return (
    <div>
      <div style={{
        background: '#1a0808',
        border: '1px solid #5a1a1a',
        borderRadius: 6,
        padding: '10px 14px',
        fontSize: 12,
        color: '#e74c3c',
        marginBottom: 12,
      }}>
        ⚠️ Top 2 customers (Cripps + F&M) = {fmt(STATIC_TOP_CUSTOMERS[0].revenue2024 + STATIC_TOP_CUSTOMERS[1].revenue2024)} — {Math.round(topTwoShare * 100)}% of tracked wholesale revenue
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['Customer', '2024', '2023', '2022', 'Trend'].map(col => (
              <th key={col} style={{
                textAlign: col === 'Customer' ? 'left' : 'right',
                padding: '8px 12px',
                color: '#555',
                fontWeight: 500,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
                borderBottom: '1px solid #222',
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STATIC_TOP_CUSTOMERS.map(c => {
            const trend = c.revenue2023 > 0 ? ((c.revenue2024 - c.revenue2023) / c.revenue2023) * 100 : null
            return (
              <tr key={c.name}>
                <td style={{ padding: '10px 12px', color: '#ddd' }}>{c.name}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fff', fontWeight: 600 }}>{fmt(c.revenue2024)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#888' }}>{fmt(c.revenue2023)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#666' }}>{fmt(c.revenue2022)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: trend === null ? '#444' : trend >= 0 ? '#4caf50' : '#e74c3c', fontSize: 12 }}>
                  {trend === null ? '—' : pct(trend)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Live Orders Table ────────────────────────────────────────────────────────

function LiveOrdersTable({ orders }: { orders: Awaited<ReturnType<typeof getRecentShopifyOrders>> }) {
  if (!orders.length) {
    return (
      <div style={{ color: '#555', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
        Connect Shopify API to see live orders
      </div>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          {['Order', 'Date', 'Customer', 'Total', 'Status'].map(col => (
            <th key={col} style={{
              textAlign: col === 'Total' ? 'right' : 'left',
              padding: '8px 12px',
              color: '#555',
              fontWeight: 500,
              fontSize: 11,
              letterSpacing: 1,
              textTransform: 'uppercase',
              borderBottom: '1px solid #222',
            }}>
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orders.map(order => (
          <tr key={order.id}>
            <td style={{ padding: '10px 12px', color: '#C9A84C', fontFamily: 'monospace' }}>{order.name}</td>
            <td style={{ padding: '10px 12px', color: '#888' }}>
              {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </td>
            <td style={{ padding: '10px 12px', color: '#ccc' }}>{order.email?.split('@')[0] ?? '—'}</td>
            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fff', fontWeight: 600 }}>
              {fmt(parseFloat(order.total_price))}
            </td>
            <td style={{ padding: '10px 12px' }}>
              <span style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 12,
                background: order.financial_status === 'paid' ? '#0f3d1a' : '#1a1a00',
                color: order.financial_status === 'paid' ? '#4caf50' : '#aaa',
                border: `1px solid ${order.financial_status === 'paid' ? '#2d7a3a' : '#333'}`,
                letterSpacing: 0.5,
              }}>
                {order.financial_status?.toUpperCase()}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── QB Invoices Table ────────────────────────────────────────────────────────

function QBInvoicesTable({ invoices }: { invoices: Awaited<ReturnType<typeof getQBRevenueData>> }) {
  if (!invoices) {
    return (
      <div style={{ color: '#555', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
        Connect QuickBooks API to see live invoices
      </div>
    )
  }

  const { recentInvoices, overdueInvoices } = invoices
  const today = new Date().toISOString().split('T')[0]

  return (
    <div>
      {overdueInvoices.length > 0 && (
        <div style={{
          background: '#1a0808',
          border: '1px solid #5a1a1a',
          borderRadius: 6,
          padding: '10px 14px',
          fontSize: 12,
          color: '#e74c3c',
          marginBottom: 12,
        }}>
          ⚠️ {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''} — {fmt(overdueInvoices.reduce((s, i) => s + i.Balance, 0))} outstanding
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['Inv #', 'Date', 'Customer', 'Total', 'Balance'].map(col => (
              <th key={col} style={{
                textAlign: ['Total', 'Balance'].includes(col) ? 'right' : 'left',
                padding: '8px 12px',
                color: '#555',
                fontWeight: 500,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
                borderBottom: '1px solid #222',
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {recentInvoices.map(inv => {
            const overdue = inv.Balance > 0 && inv.DueDate < today
            return (
              <tr key={inv.Id} style={{ background: overdue ? '#100808' : 'transparent' }}>
                <td style={{ padding: '10px 12px', color: overdue ? '#e74c3c' : '#C9A84C', fontFamily: 'monospace' }}>
                  {inv.DocNumber}
                </td>
                <td style={{ padding: '10px 12px', color: '#888' }}>
                  {new Date(inv.TxnDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </td>
                <td style={{ padding: '10px 12px', color: '#ccc' }}>{inv.CustomerRef.name}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fff' }}>{fmt(inv.TotalAmt)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {inv.Balance === 0 ? (
                    <span style={{ color: '#4caf50', fontSize: 11 }}>PAID</span>
                  ) : (
                    <span style={{ color: overdue ? '#e74c3c' : '#aaa', fontWeight: 600 }}>{fmt(inv.Balance)}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  // Fetch live data in parallel — both gracefully degrade to null if not connected
  const [shopifyData, shopifyOrders, qbData] = await Promise.all([
    getShopifyRevenueData(),
    getRecentShopifyOrders(),
    getQBRevenueData(),
  ])

  const isShopifyLive = !!shopifyData
  const isQBLive = !!qbData

  // KPI values: prefer live data, fall back to static 2024 figures
  const currentYear = new Date().getFullYear()
  const staticCurrent = STATIC_ANNUAL_REVENUE.find(r => r.year === String(currentYear))

  const dtcYTD = shopifyData?.totalRevenue ?? staticCurrent?.dtc ?? 0
  const wholesaleYTD = qbData?.ytdRevenue ?? staticCurrent?.wholesale ?? 0
  const totalYTD = dtcYTD + wholesaleYTD
  const outstandingBalance = qbData?.outstandingBalance ?? 0

  // Concentration: Cripps + F&M as % of QB YTD (or static)
  const topTwoRevenue = qbData
    ? qbData.topCustomers.slice(0, 2).reduce((s, c) => s + c.revenue, 0)
    : STATIC_TOP_CUSTOMERS[0].revenue2024 + STATIC_TOP_CUSTOMERS[1].revenue2024
  const concentrationPct = wholesaleYTD > 0 ? (topTwoRevenue / wholesaleYTD) * 100 : 74

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'inherit' }}>
      {/* Page header */}
      <div style={{
        borderBottom: '1px solid #1a1a1a',
        padding: '32px 48px 24px',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1, margin: 0 }}>DASHBOARD</h1>
          <p style={{ color: '#555', fontSize: 12, margin: '4px 0 0' }}>
            {currentYear} financial overview — updated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
          <span style={{
            padding: '4px 10px',
            borderRadius: 12,
            background: isShopifyLive ? '#0f3d1a' : '#1a1a1a',
            color: isShopifyLive ? '#4caf50' : '#555',
            border: `1px solid ${isShopifyLive ? '#2d7a3a' : '#2a2a2a'}`,
          }}>
            {isShopifyLive ? '● SHOPIFY LIVE' : '○ SHOPIFY OFFLINE'}
          </span>
          <span style={{
            padding: '4px 10px',
            borderRadius: 12,
            background: isQBLive ? '#0f3d1a' : '#1a1a1a',
            color: isQBLive ? '#4caf50' : '#555',
            border: `1px solid ${isQBLive ? '#2d7a3a' : '#2a2a2a'}`,
          }}>
            {isQBLive ? '● QUICKBOOKS LIVE' : '○ QUICKBOOKS OFFLINE'}
          </span>
        </div>
      </div>

      {/* Sub-nav */}
      <div style={{
        borderBottom: '1px solid #1a1a1a',
        padding: '0 48px',
        display: 'flex',
        gap: 24,
      }}>
        <a href="/dashboard" style={{
          padding: '10px 0',
          fontSize: 12,
          fontWeight: 600,
          color: '#C9A84C',
          borderBottom: '2px solid #C9A84C',
          letterSpacing: 1,
          textTransform: 'uppercase',
          textDecoration: 'none',
        }}>
          Dashboard
        </a>
        <a href="/dashboard/wholesale" style={{
          padding: '10px 0',
          fontSize: 12,
          fontWeight: 500,
          color: '#555',
          borderBottom: '2px solid transparent',
          letterSpacing: 1,
          textTransform: 'uppercase',
          textDecoration: 'none',
        }}>
          £ Wholesale Pricing
        </a>
        <a href="/strategy" style={{
          padding: '10px 0',
          fontSize: 12,
          fontWeight: 500,
          color: '#555',
          borderBottom: '2px solid transparent',
          letterSpacing: 1,
          textTransform: 'uppercase',
          textDecoration: 'none',
        }}>
          Strategy &amp; Targets
        </a>
      </div>

      <div style={{ padding: '32px 48px', maxWidth: 1400 }}>

        {/* Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          {STATIC_ALERTS.map(alert => (
            <AlertBanner key={alert.title} {...alert} />
          ))}
          {outstandingBalance > 0 && (
            <AlertBanner
              type="warning"
              title="Outstanding Invoices"
              message={`${fmt(outstandingBalance)} in unpaid QuickBooks invoices. Check the Wholesale Invoices section below.`}
            />
          )}
        </div>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
          <KpiCard
            label={`${currentYear} Total YTD`}
            value={fmtShort(totalYTD)}
            sub={isShopifyLive && isQBLive ? 'Live data' : 'Based on historical estimates'}
            accent
          />
          <KpiCard
            label="DTC (Shopify)"
            value={fmtShort(dtcYTD)}
            sub={isShopifyLive ? `${shopifyData?.orderCount} orders` : 'Connect Shopify for live data'}
          />
          <KpiCard
            label="Wholesale (QB)"
            value={fmtShort(wholesaleYTD)}
            sub={isQBLive ? `${qbData?.ytdInvoiceCount} invoices` : 'Connect QuickBooks for live data'}
          />
          <KpiCard
            label="Concentration Risk"
            value={`${Math.round(concentrationPct)}%`}
            sub="Cripps + F&M of wholesale"
            warning={concentrationPct > 60}
          />
        </div>

        {/* Live Orders + Invoices */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 40 }}>
          {/* Recent Shopify Orders */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: 24 }}>
            <SectionHeader title="Recent DTC Orders" live={isShopifyLive} />
            <LiveOrdersTable orders={shopifyOrders} />
          </div>

          {/* QB Invoices */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: 24 }}>
            <SectionHeader title="Wholesale Invoices" live={isQBLive} />
            <QBInvoicesTable invoices={qbData} />
          </div>
        </div>

        {/* Annual Revenue History */}
        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: 24, marginBottom: 32 }}>
          <SectionHeader title="Annual Revenue History" live={false} />
          <RevenueHistoryTable />
        </div>

        {/* Customer Concentration */}
        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: 24 }}>
          <SectionHeader title="Top Customers" live={isQBLive} />
          {isQBLive ? (
            // Live QB top customers
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Customer', 'YTD Revenue', 'Share'].map(col => (
                    <th key={col} style={{
                      textAlign: col === 'Customer' ? 'left' : 'right',
                      padding: '8px 12px',
                      color: '#555',
                      fontWeight: 500,
                      fontSize: 11,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      borderBottom: '1px solid #222',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qbData!.topCustomers.map(c => (
                  <tr key={c.name}>
                    <td style={{ padding: '10px 12px', color: '#ddd' }}>{c.name}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fff', fontWeight: 600 }}>{fmt(c.revenue)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#888', fontSize: 12 }}>
                      {wholesaleYTD > 0 ? `${((c.revenue / wholesaleYTD) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <TopCustomersTable />
          )}
        </div>

      </div>
    </div>
  )
}
