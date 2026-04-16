import Nav from "@/components/Nav";
import { getShopifyRevenueData, getRecentShopifyOrders } from "@/lib/shopify";
import { STATIC_ALERTS } from "@/lib/static-data";
import qbRevenue from "@/data/qb-revenue.json";
import qbCustomers from "@/data/qb-customers.json";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtShort(n: number) {
  if (n >= 1000) return `£${(n / 1000).toFixed(1)}k`;
  return fmt(n);
}

function pct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function RevenuePage() {
  const [shopifyData, shopifyOrders] = await Promise.all([
    getShopifyRevenueData(),
    getRecentShopifyOrders(),
  ]);

  const isShopifyLive = !!shopifyData;

  const currentYear = new Date().getFullYear();
  const qbCurrentYear = (qbRevenue.years as Record<string, { totalIncome: number; netIncome: number; grossProfit: number; incomeByAccount: Record<string, number> }>)[String(currentYear)];

  // Revenue from QB (covers everything — wholesale, DTC, Amazon)
  const qbTotalYTD = qbCurrentYear?.totalIncome ?? 0;
  const qbAmazon = qbCurrentYear?.incomeByAccount?.["Amazon Sales"] ?? 0;
  const qbShopify = qbCurrentYear?.incomeByAccount?.["Shopify Sales"] ?? 0;
  const qbWholesale = (qbCurrentYear?.incomeByAccount?.["Sales - wholesale"] ?? 0)
    + (qbCurrentYear?.incomeByAccount?.["Sales of Product Income"] ?? 0)
    + (qbCurrentYear?.incomeByAccount?.["Sales - channel"] ?? 0)
    + (qbCurrentYear?.incomeByAccount?.["Sales - retail"] ?? 0);
  const qbNetIncome = qbCurrentYear?.netIncome ?? 0;

  // Prefer live Shopify if available, otherwise use QB figure
  const dtcYTD = shopifyData?.totalRevenue ?? (qbShopify + qbAmazon);
  const totalYTD = qbTotalYTD;

  // Partner data from QB Sales by Customer Summary
  const partners = qbCustomers.partners as Record<string, { revenue: Record<string, number>; total: number; subEntities?: Record<string, Record<string, number>> }>;
  const partnerOrder = ["Cripps & Co.", "Fortnum & Mason", "Bayley & Sage", "Dugard & Daughters", "Italo", "Mother Superior", "Macknade"];
  const latestPeriod = "2025-26"; // current fiscal period
  const prevPeriod = "2024-25";

  // Concentration: Cripps + F&M as % of all partner revenue in latest period
  const allPartnerRevLatest = partnerOrder.reduce((s, p) => s + (partners[p]?.revenue?.[latestPeriod] ?? 0), 0);
  const topTwoLatest = (partners["Cripps & Co."]?.revenue?.[latestPeriod] ?? 0) + (partners["Fortnum & Mason"]?.revenue?.[latestPeriod] ?? 0);
  const concentrationPct = allPartnerRevLatest > 0 ? (topTwoLatest / allPartnerRevLatest) * 100 : 0;

  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      <Nav />
      <main className="max-w-6xl mx-auto px-6 py-12 sm:py-16">
        {/* Header */}
        <div className="mb-10">
          <p
            className="text-xs uppercase tracking-[0.6em] mb-3 font-medium"
            style={{ color: "#c9a227" }}
          >
            Finances · Revenue
          </p>
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-3"
            style={{ color: "#f0f0f0", letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            Revenue Overview
          </h1>
          <p className="text-sm max-w-2xl" style={{ color: "#4a4a4a" }}>
            {currentYear} financial overview. Revenue data pulled from QuickBooks via
            Claude — refreshes automatically every Monday. Last updated {qbRevenue.lastUpdated}.
          </p>
        </div>

        {/* Connection status */}
        <div className="flex gap-2 mb-8">
          <StatusBadge label="Shopify" live={isShopifyLive} />
          <StatusBadge label="QuickBooks" live={true} note={`Updated ${qbRevenue.lastUpdated}`} />
        </div>

        {/* Alerts */}
        <div className="flex flex-col gap-3 mb-8">
          {STATIC_ALERTS.map((alert) => (
            <AlertBanner key={alert.title} {...alert} />
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-10">
          <KpiCard
            label={`${currentYear} Total YTD`}
            value={fmtShort(totalYTD)}
            sub={`From QuickBooks · Updated ${qbRevenue.lastUpdated}`}
            accent
          />
          <KpiCard
            label="Wholesale"
            value={fmtShort(qbWholesale)}
            sub="Product + channel + retail"
          />
          <KpiCard
            label="Amazon"
            value={fmtShort(qbAmazon)}
            sub="FBA sales"
          />
          <KpiCard
            label="Shopify"
            value={fmtShort(dtcYTD)}
            sub={isShopifyLive ? `${shopifyData?.orderCount} orders (live)` : "From QB"}
          />
          <KpiCard
            label="Net Income"
            value={fmtShort(qbNetIncome)}
            sub="After all expenses"
            warning={qbNetIncome < 0}
          />
        </div>

        {/* Wholesale Partners */}
        <Section title="Wholesale Partners" badge="QB">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {partnerOrder.map((pName) => {
              const p = partners[pName];
              const latest = p?.revenue?.[latestPeriod] ?? 0;
              const prev = p?.revenue?.[prevPeriod] ?? 0;
              const trend = prev > 0 ? ((latest - prev) / prev) * 100 : null;
              return (
                <div
                  key={pName}
                  className="rounded-lg p-4"
                  style={{ background: "#111", border: "1px solid #1a1a1a" }}
                >
                  <p className="text-[9px] uppercase tracking-[0.12em] mb-1 truncate" style={{ color: "#555" }}>
                    {pName}
                  </p>
                  <p className="text-lg font-bold tabular-nums" style={{ color: latest > 0 ? "#f0f0f0" : "#333" }}>
                    {latest > 0 ? fmtShort(latest) : "—"}
                  </p>
                  <p className="text-[10px] tabular-nums mt-1" style={{ color: trend === null ? "#555" : (trend ?? 0) >= 0 ? "#4fae8f" : "#e07a5f" }}>
                    {latest > 0 ? "2025-26 YTD" : "No orders"}{trend !== null ? ` · ${pct(trend)}` : ""}
                  </p>
                </div>
              );
            })}
          </div>

          <PartnerHistoryTable partners={partners} partnerOrder={partnerOrder} periods={qbCustomers.periods as string[]} />
        </Section>

        {/* Recent Shopify Orders */}
        <Section title="Recent DTC Orders" badge={isShopifyLive ? "Live" : "Offline"}>
          <LiveOrdersTable orders={shopifyOrders} />
        </Section>

        {/* Annual Revenue History — from QB */}
        <Section title="Annual Revenue (QuickBooks)" badge="QB">
          <QBRevenueTable />
        </Section>
      </main>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ label, live, note }: { label: string; live: boolean; note?: string }) {
  return (
    <span
      className="px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.1em]"
      style={{
        background: live ? "rgba(79,174,143,0.1)" : "#1a1a1a",
        color: live ? "#4fae8f" : "#555",
        border: `1px solid ${live ? "rgba(79,174,143,0.2)" : "#222"}`,
      }}
    >
      {live ? "●" : "○"} {label} {live ? "live" : note ?? "offline"}
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  warning,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: accent ? "#0f0f0f" : "#0a0a0a",
        border: `1px solid ${warning ? "rgba(224,122,95,0.3)" : accent ? "rgba(201,162,39,0.2)" : "#1c1c1c"}`,
      }}
    >
      <p className="text-[9px] uppercase tracking-[0.12em] mb-2" style={{ color: "#555" }}>
        {label}
      </p>
      <p
        className="text-2xl font-bold tabular-nums"
        style={{ color: accent ? "#c9a227" : "#f0f0f0" }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] mt-2" style={{ color: warning ? "#e07a5f" : "#444" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function Section({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  const isLive = badge === "Live";
  return (
    <div
      className="rounded-xl p-6 mb-8"
      style={{ background: "#0a0a0a", border: "1px solid #1c1c1c" }}
    >
      <div className="flex items-center gap-3 mb-5">
        <p className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: "#555" }}>
          {title}
        </p>
        <span
          className="px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase"
          style={{
            background: isLive ? "rgba(79,174,143,0.1)" : "rgba(85,85,85,0.1)",
            color: isLive ? "#4fae8f" : "#555",
          }}
        >
          {badge}
        </span>
      </div>
      {children}
    </div>
  );
}

function AlertBanner({ type, title, message }: { type: "warning" | "info"; title: string; message: string }) {
  const isWarning = type === "warning";
  return (
    <div
      className="rounded-lg px-4 py-3 flex gap-3"
      style={{
        background: isWarning ? "rgba(224,122,95,0.05)" : "rgba(79,174,143,0.05)",
        border: `1px solid ${isWarning ? "rgba(224,122,95,0.15)" : "rgba(79,174,143,0.15)"}`,
      }}
    >
      <span className="text-sm shrink-0">{isWarning ? "⚠" : "ℹ"}</span>
      <div>
        <p className="text-xs font-semibold" style={{ color: isWarning ? "#e07a5f" : "#4fae8f" }}>
          {title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "#666" }}>
          {message}
        </p>
      </div>
    </div>
  );
}

// ─── Tables ─────────────────────────────────────────────────────────────────

function PartnerHistoryTable({
  partners,
  partnerOrder,
  periods,
}: {
  partners: Record<string, { revenue: Record<string, number>; total: number }>;
  partnerOrder: string[];
  periods: string[];
}) {
  // Show most recent 5 periods + all-time total
  const displayPeriods = periods.slice(-5);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th className="px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-left" style={{ color: "#555", borderBottom: "1px solid #1c1c1c" }}>
              Partner
            </th>
            {displayPeriods.map((p) => (
              <th key={p} className="px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-right whitespace-nowrap" style={{ color: "#555", borderBottom: "1px solid #1c1c1c" }}>
                {p}
              </th>
            ))}
            <th className="px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-right" style={{ color: "#c9a227", borderBottom: "1px solid #1c1c1c" }}>
              All-time
            </th>
          </tr>
        </thead>
        <tbody>
          {partnerOrder.map((pName) => {
            const p = partners[pName];
            return (
              <tr key={pName} style={{ borderBottom: "1px solid #141414" }}>
                <td className="px-3 py-3" style={{ color: "#cfcfcf" }}>{pName}</td>
                {displayPeriods.map((period) => {
                  const val = p?.revenue?.[period] ?? 0;
                  return (
                    <td key={period} className="px-3 py-3 text-right tabular-nums" style={{ color: val > 0 ? "#f0f0f0" : "#333" }}>
                      {val > 0 ? fmt(val) : "—"}
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-right tabular-nums font-semibold" style={{ color: "#c9a227" }}>
                  {fmt(p?.total ?? 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QBRevenueTable() {
  const years = qbRevenue.years as Record<string, { totalIncome: number; grossProfit: number; netIncome: number; totalExpenses: number }>;
  const rows = Object.entries(years)
    .map(([year, d]) => ({ year, ...d }))
    .sort((a, b) => b.year.localeCompare(a.year));

  const currentYear = String(new Date().getFullYear());

  return (
    <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {["Year", "Total Income", "Gross Profit", "Expenses", "Net Income", "YoY"].map((col) => (
            <th
              key={col}
              className="px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold"
              style={{
                textAlign: col === "Year" ? "left" : "right",
                color: "#555",
                borderBottom: "1px solid #1c1c1c",
              }}
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const prev = rows[i + 1]?.totalIncome ?? null;
          const yoyPct = prev ? ((row.totalIncome - prev) / prev) * 100 : null;
          const isCurrent = row.year === currentYear;
          return (
            <tr key={row.year} style={{ borderBottom: "1px solid #141414" }}>
              <td className="px-3 py-3" style={{ color: isCurrent ? "#c9a227" : "#cfcfcf", fontWeight: isCurrent ? 600 : 400 }}>
                {row.year}{isCurrent ? " YTD" : ""}
              </td>
              <td className="px-3 py-3 text-right tabular-nums font-semibold" style={{ color: "#f0f0f0" }}>
                {fmt(row.totalIncome)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums" style={{ color: "#cfcfcf" }}>
                {fmt(row.grossProfit)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums" style={{ color: "#777" }}>
                {fmt(row.totalExpenses)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums" style={{ color: row.netIncome >= 0 ? "#4fae8f" : "#e07a5f", fontWeight: 600 }}>
                {fmt(row.netIncome)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-xs" style={{ color: yoyPct === null ? "#333" : yoyPct >= 0 ? "#4fae8f" : "#e07a5f" }}>
                {yoyPct === null ? "—" : pct(yoyPct)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function LiveOrdersTable({
  orders,
}: {
  orders: Awaited<ReturnType<typeof getRecentShopifyOrders>>;
}) {
  if (!orders.length) {
    return (
      <p className="text-sm text-center py-8" style={{ color: "#555" }}>
        Connect Shopify API to see live orders
      </p>
    );
  }

  return (
    <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {["Order", "Date", "Customer", "Total", "Status"].map((col) => (
            <th
              key={col}
              className="px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold"
              style={{
                textAlign: col === "Total" ? "right" : "left",
                color: "#555",
                borderBottom: "1px solid #1c1c1c",
              }}
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id} style={{ borderBottom: "1px solid #141414" }}>
            <td className="px-3 py-3 font-mono" style={{ color: "#c9a227" }}>
              {order.name}
            </td>
            <td className="px-3 py-3" style={{ color: "#777" }}>
              {new Date(order.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </td>
            <td className="px-3 py-3" style={{ color: "#cfcfcf" }}>
              {order.email?.split("@")[0] ?? "—"}
            </td>
            <td className="px-3 py-3 text-right tabular-nums font-semibold" style={{ color: "#f0f0f0" }}>
              {fmt(parseFloat(order.total_price))}
            </td>
            <td className="px-3 py-3">
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase"
                style={{
                  background:
                    order.financial_status === "paid"
                      ? "rgba(79,174,143,0.1)"
                      : "rgba(85,85,85,0.1)",
                  color: order.financial_status === "paid" ? "#4fae8f" : "#888",
                }}
              >
                {order.financial_status?.toUpperCase()}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
