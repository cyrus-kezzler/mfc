"use client";

import { useState } from "react";
import { fmt, fmtShort, pct, KpiCard, Section, PeriodPills } from "./_shared";

type YearData = {
  totalIncome: number;
  netIncome: number;
  grossProfit: number;
  totalExpenses: number;
  incomeByAccount: Record<string, number>;
};

type ShopifyLive = {
  totalRevenue: number;
  orderCount: number;
} | null;

export default function RevenueClient({
  years,
  lastUpdated,
  currentYear,
  shopify,
}: {
  years: Record<string, YearData>;
  lastUpdated: string;
  currentYear: number;
  shopify: ShopifyLive;
}) {
  const availableYears = Object.keys(years)
    .map(Number)
    .sort((a, b) => b - a);

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const data = years[String(selectedYear)];
  const isCurrent = selectedYear === currentYear;

  const qbAmazon = data?.incomeByAccount?.["Amazon Sales"] ?? 0;
  const qbShopify = data?.incomeByAccount?.["Shopify Sales"] ?? 0;
  const qbWholesale =
    (data?.incomeByAccount?.["Sales - wholesale"] ?? 0) +
    (data?.incomeByAccount?.["Sales of Product Income"] ?? 0) +
    (data?.incomeByAccount?.["Sales - channel"] ?? 0) +
    (data?.incomeByAccount?.["Sales - retail"] ?? 0);

  const dtcValue = isCurrent && shopify ? shopify.totalRevenue : qbShopify + qbAmazon;
  const dtcSub = isCurrent && shopify
    ? `${shopify.orderCount} orders (live)`
    : "From QB";

  const totalLabel = isCurrent ? `${selectedYear} Total YTD` : `${selectedYear} Total`;
  const totalSub = isCurrent
    ? `From QuickBooks · Updated ${lastUpdated}`
    : "Full year · From QuickBooks";

  const yearPicker = (
    <PeriodPills
      values={availableYears}
      selected={selectedYear}
      onChange={setSelectedYear}
    />
  );

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <p className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: "#555" }}>
          Revenue Period
        </p>
        {yearPicker}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-10">
        <KpiCard
          label={totalLabel}
          value={fmtShort(data?.totalIncome ?? 0)}
          sub={totalSub}
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
          value={fmtShort(dtcValue)}
          sub={dtcSub}
        />
        <KpiCard
          label="Net Income"
          value={fmtShort(data?.netIncome ?? 0)}
          sub="After all expenses"
          warning={(data?.netIncome ?? 0) < 0}
        />
      </div>

      <Section title="Annual Revenue (QuickBooks)" badge="QB">
        <QBRevenueTable years={years} selectedYear={selectedYear} currentYear={currentYear} />
      </Section>
    </>
  );
}

function QBRevenueTable({
  years,
  selectedYear,
  currentYear,
}: {
  years: Record<string, YearData>;
  selectedYear: number;
  currentYear: number;
}) {
  const rows = Object.entries(years)
    .map(([year, d]) => ({ year, ...d }))
    .sort((a, b) => b.year.localeCompare(a.year));

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
          const yearNum = Number(row.year);
          const isCurrent = yearNum === currentYear;
          const isSelected = yearNum === selectedYear;
          return (
            <tr
              key={row.year}
              style={{
                borderBottom: "1px solid #141414",
                background: isSelected ? "rgba(201,162,39,0.04)" : "transparent",
              }}
            >
              <td className="px-3 py-3" style={{ color: isSelected ? "#c9a227" : "#cfcfcf", fontWeight: isSelected ? 600 : 400 }}>
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
