"use client";

import { useState } from "react";
import { fmt, fmtShort, pct, Section, PeriodPills } from "./_shared";

type Partner = {
  revenue: Record<string, number>;
  total: number;
  subEntities?: Record<string, Record<string, number>>;
};

export default function WholesaleClient({
  partners,
  partnerOrder,
  periods,
}: {
  partners: Record<string, Partner>;
  partnerOrder: string[];
  periods: string[];
}) {
  // Default to the most recent period that has any revenue
  const defaultPeriod = [...periods].reverse().find((p) =>
    partnerOrder.some((name) => (partners[name]?.revenue?.[p] ?? 0) > 0)
  ) ?? periods[periods.length - 1];

  const [selectedPeriod, setSelectedPeriod] = useState<string>(defaultPeriod);
  const selectedIdx = periods.indexOf(selectedPeriod);
  const prevPeriod = selectedIdx > 0 ? periods[selectedIdx - 1] : null;

  const picker = (
    <PeriodPills
      values={periods}
      selected={selectedPeriod}
      onChange={setSelectedPeriod}
    />
  );

  return (
    <Section title="Wholesale Partners" badge="QB" right={picker}>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {partnerOrder.map((pName) => {
          const p = partners[pName];
          const latest = p?.revenue?.[selectedPeriod] ?? 0;
          const prev = prevPeriod ? (p?.revenue?.[prevPeriod] ?? 0) : 0;
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
                {latest > 0 ? selectedPeriod : "No orders"}{trend !== null ? ` · ${pct(trend)}` : ""}
              </p>
            </div>
          );
        })}
      </div>

      <PartnerHistoryTable
        partners={partners}
        partnerOrder={partnerOrder}
        periods={periods}
        selectedPeriod={selectedPeriod}
      />
    </Section>
  );
}

function PartnerHistoryTable({
  partners,
  partnerOrder,
  periods,
  selectedPeriod,
}: {
  partners: Record<string, Partner>;
  partnerOrder: string[];
  periods: string[];
  selectedPeriod: string;
}) {
  // Show 5 most recent periods up to and including the selected one
  const selectedIdx = periods.indexOf(selectedPeriod);
  const endIdx = selectedIdx >= 0 ? selectedIdx + 1 : periods.length;
  const startIdx = Math.max(0, endIdx - 5);
  const displayPeriods = periods.slice(startIdx, endIdx);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th className="px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-left" style={{ color: "#555", borderBottom: "1px solid #1c1c1c" }}>
              Partner
            </th>
            {displayPeriods.map((p) => (
              <th
                key={p}
                className="px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-right whitespace-nowrap"
                style={{
                  color: p === selectedPeriod ? "#c9a227" : "#555",
                  borderBottom: "1px solid #1c1c1c",
                }}
              >
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
                  const isSelected = period === selectedPeriod;
                  return (
                    <td
                      key={period}
                      className="px-3 py-3 text-right tabular-nums"
                      style={{
                        color: val > 0 ? (isSelected ? "#c9a227" : "#f0f0f0") : "#333",
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
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
