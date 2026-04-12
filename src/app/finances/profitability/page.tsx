import Nav from "@/components/Nav";
import { computeAllSkuBreakdowns, computeSummary } from "@/lib/cogs";
import ProfitabilityClient from "./ProfitabilityClient";

export default function ProfitabilityPage() {
  const breakdowns = computeAllSkuBreakdowns();
  const summary = computeSummary(breakdowns);
  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      <Nav />
      <main className="max-w-6xl mx-auto px-6 py-12 sm:py-16">
        <div className="mb-10">
          <p
            className="text-xs uppercase tracking-[0.6em] mb-3 font-medium"
            style={{ color: "#c9a227" }}
          >
            Finances · Profitability
          </p>
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-3"
            style={{ color: "#f0f0f0", letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            COGS Reconciliation
          </h1>
          <p className="text-sm max-w-2xl" style={{ color: "#4a4a4a" }}>
            Derived <strong style={{ color: "#777" }}>liquid-only</strong> COGS (ingredient master ×
            recipe ratios) compared to the hardcoded values in the wholesale pricing model. The
            hardcoded COGS may include packaging (bottle, cap, label) which the derived figure
            does not — so a consistent gap of ~£1–2 per bottle is expected until we add a
            packaging cost layer. Click any SKU for the full ingredient-level breakdown.
          </p>
        </div>

        <ProfitabilityClient breakdowns={breakdowns} summary={summary} />
      </main>
    </div>
  );
}
