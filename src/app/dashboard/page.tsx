import Nav from "@/components/Nav";
import { getShopifyRevenueData, getRecentShopifyOrders } from "@/lib/shopify";
import { STATIC_ALERTS } from "@/lib/static-data";
import qbRevenue from "@/data/qb-revenue.json";
import qbCustomers from "@/data/qb-customers.json";
import { fmt, Section } from "./_shared";
import RevenueClient from "./RevenueClient";
import WholesaleClient from "./WholesaleClient";

export default async function RevenuePage() {
  const [shopifyData, shopifyOrders] = await Promise.all([
    getShopifyRevenueData(),
    getRecentShopifyOrders(),
  ]);

  const isShopifyLive = !!shopifyData;
  const currentYear = new Date().getFullYear();

  const years = qbRevenue.years as Record<
    string,
    {
      totalIncome: number;
      netIncome: number;
      grossProfit: number;
      totalExpenses: number;
      incomeByAccount: Record<string, number>;
    }
  >;

  const partners = qbCustomers.partners as Record<
    string,
    { revenue: Record<string, number>; total: number; subEntities?: Record<string, Record<string, number>> }
  >;
  const partnerOrder = ["Cripps & Co.", "Fortnum & Mason", "Bayley & Sage", "Dugard & Daughters", "Italo", "Mother Superior", "Macknade"];

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

        {/* KPI cards + annual revenue table (with year picker) */}
        <RevenueClient
          years={years}
          lastUpdated={qbRevenue.lastUpdated}
          currentYear={currentYear}
          shopify={shopifyData ? { totalRevenue: shopifyData.totalRevenue, orderCount: shopifyData.orderCount } : null}
        />

        {/* Wholesale Partners (with period picker) */}
        <WholesaleClient
          partners={partners}
          partnerOrder={partnerOrder}
          periods={qbCustomers.periods as string[]}
        />

        {/* Recent Shopify Orders */}
        <Section title="Recent DTC Orders" badge={isShopifyLive ? "Live" : "Offline"}>
          <LiveOrdersTable orders={shopifyOrders} />
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
          {["Order", "Date", "Items", "Total", "Status"].map((col) => (
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
        {orders.map((order) => {
          const items = (order as unknown as { line_items?: Array<{ title: string; quantity: number }> }).line_items ?? [];
          const itemSummary = items.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ""}${i.title}`).join(", ");
          return (
            <tr key={order.id} style={{ borderBottom: "1px solid #141414" }}>
              <td className="px-3 py-3 font-mono" style={{ color: "#c9a227" }}>
                {order.name}
              </td>
              <td className="px-3 py-3 whitespace-nowrap" style={{ color: "#777" }}>
                {new Date(order.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </td>
              <td className="px-3 py-3 text-xs" style={{ color: "#cfcfcf", maxWidth: 300 }}>
                <span className="line-clamp-2">{itemSummary || "—"}</span>
              </td>
              <td className="px-3 py-3 text-right tabular-nums font-semibold whitespace-nowrap" style={{ color: "#f0f0f0" }}>
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
          );
        })}
      </tbody>
    </table>
  );
}
