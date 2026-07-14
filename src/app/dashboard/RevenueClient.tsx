"use client";

import { useState } from "react";
import { fmt, fmtShort, pct, KpiCard, Section, PeriodPills } from "./_shared";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";

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

type ChannelYear = {
  channel: string;
  label: string;
  year: string;
  value: number;
  basis: string;
  source: string;
  asOf: string;
  warning?: string;
  partialYear: boolean;
  detail?: Record<string, number>;
};

type Channels = {
  dtc: ChannelYear[];
  amazon: ChannelYear[];
  wholesale: ChannelYear[];
  unclassified: ChannelYear[];
};

type Variance = {
  year: string;
  total: number | null;
  channelSum: number;
  variance: number | null;
  reason: string;
};

/** Provenance travels with the number, on the face of the card. */
function prov(row: ChannelYear | undefined): string {
  if (!row) return "No data";
  const src = row.source === "shopify" ? "Shopify" : "QuickBooks";
  const partial = row.partialYear ? " · PART YEAR" : "";
  return `${src} · ${row.asOf}${partial}`;
}

export default function RevenueClient({
  years,
  channels,
  variances,
  currentYear,
  shopify,
}: {
  years: Record<string, YearData>;
  channels: Channels;
  variances: Record<string, Variance>;
  currentYear: number;
  shopify: ShopifyLive;
}) {
  const availableYears = Object.keys(years)
    .map(Number)
    .sort((a, b) => b - a);

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const data = years[String(selectedYear)];
  const y = String(selectedYear);
  const isCurrent = selectedYear === currentYear;

  const find = (rows: ChannelYear[]) => rows.find((r) => r.year === y);
  const dtc = find(channels.dtc);
  const amazon = find(channels.amazon);
  const wholesale = find(channels.wholesale);
  const unclassified = find(channels.unclassified);
  const variance = variances[y];

  const totalLabel = isCurrent ? `${selectedYear} total YTD` : `${selectedYear} total`;

  const yearPicker = (
    <PeriodPills values={availableYears} selected={selectedYear} onChange={setSelectedYear} />
  );

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
          rowGap: 8,
        }}
      >
        <p style={{ fontSize: 11, color: COLOR.muted, ...smallCaps }}>Revenue period</p>
        {yearPicker}
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 40,
          borderTop: `1px solid ${COLOR.rule}`,
          borderBottom: `1px solid ${COLOR.rule}`,
          padding: "24px 0",
          marginBottom: 24,
        }}
      >
        <KpiCard
          label={totalLabel}
          value={fmtShort(data?.totalIncome ?? 0)}
          sub={`QuickBooks P&L${isCurrent ? " · PART YEAR" : ""}`}
          accent
        />
        <KpiCard
          label="DTC"
          value={fmtShort(dtc?.value ?? 0)}
          sub={
            isCurrent && shopify
              ? `Shopify · ${shopify.orderCount} orders live`
              : prov(dtc)
          }
        />
        <KpiCard
          label="Wholesale (floor)"
          value={fmtShort(wholesale?.value ?? 0)}
          sub={`${prov(wholesale)} · floor, not a total`}
        />
        <KpiCard
          label="Amazon (gross)"
          value={fmtShort(amazon?.value ?? 0)}
          sub={`${prov(amazon)} · no net exists`}
          warning
        />
        <KpiCard
          label="Unclassified"
          value={fmtShort(unclassified?.value ?? 0)}
          sub="No channel attached"
          warning
        />
        <KpiCard
          label="Net income"
          value={fmtShort(data?.netIncome ?? 0)}
          sub="QuickBooks · unreliable pre-reclass"
          warning={(data?.netIncome ?? 0) < 0}
        />
      </section>

      {variance && variance.total !== null && (
        <div
          style={{
            borderLeft: `2px solid ${COLOR.flag}`,
            padding: "10px 16px",
            marginBottom: 48,
          }}
        >
          <p style={{ fontSize: 11, color: COLOR.flag, ...smallCaps, marginBottom: 4 }}>
            Channels do not reconcile to the total
          </p>
          <p
            style={{
              fontFamily: FONT.serif,
              fontStyle: "italic",
              fontSize: 14,
              color: COLOR.inkSoft,
              lineHeight: 1.55,
            }}
          >
            Channels sum to {fmt(variance.channelSum)} against a P&amp;L total of{" "}
            {fmt(variance.total)}, a variance of {fmt(Math.abs(variance.variance ?? 0))}.{" "}
            {variance.reason}
          </p>
        </div>
      )}

      <Section title="DTC by year (Shopify)" badge="Live">
        <DtcTable rows={channels.dtc} selectedYear={y} />
      </Section>

      <Section title="Annual revenue (QuickBooks)" badge="QB">
        <QBRevenueTable
          years={years}
          selectedYear={selectedYear}
          currentYear={currentYear}
        />
      </Section>
    </>
  );
}

/** The series that was fabricated. Now read from source, and shown, so nobody has to guess again. */
function DtcTable({ rows, selectedYear }: { rows: ChannelYear[]; selectedYear: string }) {
  const sorted = [...rows].sort((a, b) => b.year.localeCompare(a.year));
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr
            style={{
              borderTop: `2px solid ${COLOR.ink}`,
              borderBottom: `1px solid ${COLOR.ruleBold}`,
            }}
          >
            {["Year", "DTC total sales", "Orders", "YoY", "Source"].map((col, i) => (
              <th
                key={col}
                style={{
                  padding: "12px 12px",
                  textAlign: i === 0 || i === 4 ? "left" : "right",
                  fontSize: 10,
                  color: COLOR.muted,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  ...smallCaps,
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const prev = sorted[i + 1]?.value ?? null;
            const yoyPct = prev ? ((row.value - prev) / prev) * 100 : null;
            const isSelected = row.year === selectedYear;
            return (
              <tr
                key={row.year}
                style={{
                  borderBottom: `1px solid ${COLOR.rule}`,
                  background: isSelected ? COLOR.paperDeep : "transparent",
                }}
              >
                <td
                  style={{
                    padding: "14px 12px",
                    fontFamily: FONT.serif,
                    fontSize: 16,
                    color: isSelected ? COLOR.accent : COLOR.ink,
                  }}
                >
                  {row.year}
                  {row.partialYear ? " YTD" : ""}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    color: COLOR.ink,
                    fontWeight: 600,
                    ...tabularNums,
                  }}
                >
                  {fmt(row.value)}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    color: COLOR.muted,
                    ...tabularNums,
                  }}
                >
                  {row.detail?.orders ?? "-"}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    fontSize: 12,
                    color:
                      yoyPct === null
                        ? COLOR.mutedLight
                        : yoyPct >= 0
                        ? COLOR.positive
                        : COLOR.flag,
                    ...tabularNums,
                  }}
                >
                  {row.partialYear ? "part yr" : yoyPct === null ? "-" : pct(yoyPct)}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    fontSize: 11,
                    color: COLOR.mutedLight,
                    whiteSpace: "nowrap",
                  }}
                >
                  Shopify · {row.asOf}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={{ borderTop: `2px solid ${COLOR.ink}`, padding: 0, height: 2 }} />
          </tr>
        </tfoot>
      </table>
    </div>
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
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr
            style={{
              borderTop: `2px solid ${COLOR.ink}`,
              borderBottom: `1px solid ${COLOR.ruleBold}`,
            }}
          >
            {["Year", "Total income", "Gross profit", "Expenses", "Net income", "YoY"].map(
              (col, i) => (
                <th
                  key={col}
                  style={{
                    padding: "12px 12px",
                    textAlign: i === 0 ? "left" : "right",
                    fontSize: 10,
                    color: COLOR.muted,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    ...smallCaps,
                  }}
                >
                  {col}
                </th>
              ),
            )}
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
                  borderBottom: `1px solid ${COLOR.rule}`,
                  background: isSelected ? COLOR.paperDeep : "transparent",
                }}
              >
                <td
                  style={{
                    padding: "14px 12px",
                    fontFamily: FONT.serif,
                    fontSize: 16,
                    color: isSelected ? COLOR.accent : COLOR.ink,
                    fontWeight: isSelected ? 500 : 400,
                  }}
                >
                  {row.year}
                  {isCurrent ? " YTD" : ""}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    color: COLOR.ink,
                    fontWeight: 600,
                    ...tabularNums,
                  }}
                >
                  {fmt(row.totalIncome)}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    color: COLOR.inkSoft,
                    ...tabularNums,
                  }}
                >
                  {fmt(row.grossProfit)}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    color: COLOR.muted,
                    ...tabularNums,
                  }}
                >
                  {fmt(row.totalExpenses)}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    color: row.netIncome >= 0 ? COLOR.positive : COLOR.flag,
                    fontWeight: 600,
                    ...tabularNums,
                  }}
                >
                  {fmt(row.netIncome)}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    fontSize: 12,
                    color:
                      yoyPct === null
                        ? COLOR.mutedLight
                        : yoyPct >= 0
                        ? COLOR.positive
                        : COLOR.flag,
                    ...tabularNums,
                  }}
                >
                  {yoyPct === null ? "-" : pct(yoyPct)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} style={{ borderTop: `2px solid ${COLOR.ink}`, padding: 0, height: 2 }} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
