import Nav from "@/components/Nav";
import { getShopifyRevenueData, getRecentShopifyOrders } from "@/lib/shopify";
import {
  STATIC_ANNUAL_REVENUE,
  STATIC_TOP_CUSTOMERS,
  STATIC_ALERTS,
} from "@/lib/static-data";

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
  const staticCurrent = STATIC_ANNUAL_REVENUE.find((r) => r.year === String(currentYear));

  const dtcYTD = shopifyData?.totalRevenue ?? staticCurrent?.dtc ?? 0;
  const wholesaleYTD = staticCurrent?.wholesale ?? 0;
  const totalYTD = dtcYTD + wholesaleYTD;

  // Concentration
  const topTwoRevenue =
    STATIC_TOP_CUSTOMERS[0].revenue2024 + STATIC_TOP_CUSTOMERS[1].revenue2024;
  const totalWholesale2024 = STATIC_TOP_CUSTOMERS.reduce((s, c) => s + c.revenue2024, 0);
  const concentrationPct =
    totalWholesale2024 > 0 ? (topTwoRevenue / totalWholesale2024) * 100 : 0;

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
            {currentYear} financial overview. Shopify data is live when connected; wholesale
            figures are from QuickBooks exports until we wire the API.
          </p>
        </div>

        {/* Connection status */}
        <div className="flex gap-2 mb-8">
          <StatusBadge label="Shopify" live={isShopifyLive} />
          <StatusBadge label="QuickBooks" live={false} note="Manual export" />
        </div>

        {/* Alerts */}
        <div className="flex flex-col gap-3 mb-8">
          {STATIC_ALERTS.map((alert) => (
            <AlertBanner key={alert.title} {...alert} />
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <KpiCard
            label={`${currentYear} Total YTD`}
            value={fmtShort(totalYTD)}
            sub={isShopifyLive ? "DTC live, wholesale static" : "Based on historical data"}
            accent
          />
          <KpiCard
            label="DTC (Shopify)"
            value={fmtShort(dtcYTD)}
            sub={
              isShopifyLive
                ? `${shopifyData?.orderCount} orders`
                : "Connect Shopify for live data"
            }
          />
          <KpiCard
            label="Wholesale"
            value={fmtShort(wholesaleYTD)}
            sub="From QuickBooks export"
          />
          <KpiCard
            label="Concentration"
            value={`${Math.round(concentrationPct)}%`}
            sub="Cripps + F&M of wholesale"
            warning={concentrationPct > 60}
          />
        </div>

        {/* Wholesale Partners */}
        <Section title="Wholesale Partners" badge="Static">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {STATIC_TOP_CUSTOMERS.map((c) => (
              <div
                key={c.name}
                className="rounded-lg p-4"
                style={{ background: "#111", border: "1px solid #1a1a1a" }}
              >
                <p
                  className="text-[9px] uppercase tracking-[0.12em] mb-1 truncate"
                  style={{ color: "#555" }}
                >
                  {c.name}
                </p>
                <p
                  className="text-lg font-bold tabular-nums"
                  style={{ color: c.revenue2024 > 0 ? "#f0f0f0" : "#333" }}
                >
                  {c.revenue2024 > 0 ? fmtShort(c.revenue2024) : "—"}
                </p>
                <p className="text-[10px] tabular-nums mt-1" style={{ color: "#555" }}>
                  {c.revenue2024 > 0 ? "2024" : "No data yet"}
                </p>
              </div>
            ))}
          </div>

          <TopCustomersTable />
        </Section>

        {/* Recent Shopify Orders */}
        <Section title="Recent DTC Orders" badge={isShopifyLive ? "Live" : "Offline"}>
          <LiveOrdersTable orders={shopifyOrders} />
        </Section>

        {/* Annual Revenue History */}
        <Section title="Annual Revenue" badge="Static">
          <RevenueHistoryTable />
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

function TopCustomersTable() {
  return (
    <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {["Customer", "2024", "2023", "2022", "Trend"].map((col) => (
            <th
              key={col}
              className="px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold"
              style={{
                textAlign: col === "Customer" ? "left" : "right",
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
        {STATIC_TOP_CUSTOMERS.map((c) => {
          const trend =
            c.revenue2023 > 0
              ? ((c.revenue2024 - c.revenue2023) / c.revenue2023) * 100
              : null;
          return (
            <tr key={c.name} style={{ borderBottom: "1px solid #141414" }}>
              <td className="px-3 py-3" style={{ color: "#cfcfcf" }}>
                {c.name}
              </td>
              <td className="px-3 py-3 text-right tabular-nums font-semibold" style={{ color: c.revenue2024 > 0 ? "#f0f0f0" : "#333" }}>
                {c.revenue2024 > 0 ? fmt(c.revenue2024) : "—"}
              </td>
              <td className="px-3 py-3 text-right tabular-nums" style={{ color: "#777" }}>
                {c.revenue2023 > 0 ? fmt(c.revenue2023) : "—"}
              </td>
              <td className="px-3 py-3 text-right tabular-nums" style={{ color: "#555" }}>
                {c.revenue2022 > 0 ? fmt(c.revenue2022) : "—"}
              </td>
              <td
                className="px-3 py-3 text-right tabular-nums text-xs"
                style={{
                  color:
                    trend === null ? "#333" : trend >= 0 ? "#4fae8f" : "#e07a5f",
                }}
              >
                {trend === null ? "—" : pct(trend)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RevenueHistoryTable() {
  const rows = [...STATIC_ANNUAL_REVENUE].reverse();
  return (
    <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {["Year", "DTC (Shopify)", "Wholesale", "Total", "YoY"].map((col) => (
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
          const prevTotal = rows[i + 1]?.total ?? null;
          const yoyPct = prevTotal ? ((row.total - prevTotal) / prevTotal) * 100 : null;
          const isCurrentYear = row.year === String(new Date().getFullYear());
          return (
            <tr
              key={row.year}
              style={{ borderBottom: "1px solid #141414" }}
            >
              <td
                className="px-3 py-3"
                style={{ color: isCurrentYear ? "#c9a227" : "#cfcfcf", fontWeight: isCurrentYear ? 600 : 400 }}
              >
                {row.year}
                {isCurrentYear ? " YTD" : ""}
              </td>
              <td className="px-3 py-3 text-right tabular-nums" style={{ color: "#777" }}>
                {fmt(row.dtc)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums" style={{ color: "#cfcfcf" }}>
                {fmt(row.wholesale)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums font-semibold" style={{ color: "#f0f0f0" }}>
                {fmt(row.total)}
              </td>
              <td
                className="px-3 py-3 text-right tabular-nums text-xs"
                style={{
                  color: yoyPct === null ? "#333" : yoyPct >= 0 ? "#4fae8f" : "#e07a5f",
                }}
              >
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
