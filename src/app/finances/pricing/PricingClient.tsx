"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import {
  PricingConfig,
  PricingProduct,
  calcWholesale,
  calcRetailerPrice,
  passesRetailerTest,
  calcMargin,
} from "@/lib/pricing-data";
import { updateRrpOverride, resetRrpOverrides } from "@/app/actions/pricing";

const GBP = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(n);

const STORAGE_CONFIG_KEY = "mfc_pricing_config";

type Props = {
  products: PricingProduct[];
  defaultConfig: PricingConfig;
  rrpOverrides: Record<string, number>;
};

export default function PricingClient({ products: serverProducts, defaultConfig, rrpOverrides: serverRrpOverrides }: Props) {
  const [config, setConfig] = useState<PricingConfig>(defaultConfig);
  const [localRrpEdits, setLocalRrpEdits] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [filterFails, setFilterFails] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    try {
      const sc = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (sc) setConfig({ ...defaultConfig, ...JSON.parse(sc) });
    } catch {}
    setHydrated(true);
  }, [defaultConfig]);

  // Products with any unsaved local RRP edits layered on top
  const products: PricingProduct[] = serverProducts.map((p) => ({
    ...p,
    rrp: localRrpEdits[p.id] ?? p.rrp,
  }));

  const allPass = products.every((p) => passesRetailerTest(p, config));
  const failCount = products.filter((p) => !passesRetailerTest(p, config)).length;
  const displayed = filterFails
    ? products.filter((p) => !passesRetailerTest(p, config))
    : products;

  const hasUnsavedRrpEdits = Object.keys(localRrpEdits).length > 0;

  const startEdit = (id: string, val: number) => {
    setEditingId(id);
    setEditValue(val.toFixed(2));
  };

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const val = parseFloat(editValue);
    if (isNaN(val) || val <= 0) {
      setEditingId(null);
      return;
    }
    // Stage locally — user clicks Save to persist to git
    setLocalRrpEdits((prev) => ({ ...prev, [editingId]: val }));
    setEditingId(null);
    setFeedback(null);
  }, [editingId, editValue]);

  const saveAllRrpEdits = () => {
    setFeedback(null);
    const edits = { ...localRrpEdits };
    const entries = Object.entries(edits);
    if (entries.length === 0) return;

    startTransition(async () => {
      for (const [id, rrp] of entries) {
        const product = serverProducts.find((p) => p.id === id);
        if (!product) continue;
        const res = await updateRrpOverride(id, product.name, product.size, rrp);
        if (!res.ok) {
          setFeedback({ kind: "err", msg: res.error });
          return;
        }
      }
      setLocalRrpEdits({});
      setFeedback({
        kind: "ok",
        msg: `${entries.length} RRP change${entries.length > 1 ? "s" : ""} saved to git. Site will redeploy in ~30s.`,
      });
    });
  };

  const handleReset = () => {
    startTransition(async () => {
      const res = await resetRrpOverrides();
      if (res.ok) {
        setLocalRrpEdits({});
        setFeedback({ kind: "ok", msg: "All RRP overrides cleared. Defaults restored." });
      } else {
        setFeedback({ kind: "err", msg: res.error });
      }
    });
  };

  const saveConfig = (c: PricingConfig) => {
    setConfig(c);
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(c));
  };

  if (!hydrated)
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ color: "#555" }}>
        Loading…
      </div>
    );

  return (
    <main className="max-w-6xl mx-auto px-6 py-12 sm:py-16">
      {/* Header */}
      <div className="mb-10">
        <p
          className="text-xs uppercase tracking-[0.6em] mb-3 font-medium"
          style={{ color: "#c9a227" }}
        >
          Finances · Pricing
        </p>
        <h1
          className="text-3xl sm:text-4xl font-bold tracking-tight mb-3"
          style={{ color: "#f0f0f0", letterSpacing: "-0.02em", lineHeight: 1.1 }}
        >
          Wholesale Pricing
        </h1>
        <p className="text-sm max-w-2xl" style={{ color: "#4a4a4a" }}>
          COGS is derived live from the ingredient master (liquid + labour). The wholesale
          price is COGS × markup + shipping. Adjust the markup, retailer margin, and VAT
          assumptions below. RRP is click-to-edit — changes persist to git across all devices.
        </p>
      </div>

      {/* Status + controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span
          className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-[0.1em]"
          style={{
            background: allPass ? "rgba(79,174,143,0.1)" : "rgba(224,122,95,0.1)",
            color: allPass ? "#4fae8f" : "#e07a5f",
          }}
        >
          {allPass ? `All ${products.length} pass` : `${failCount} fail retailer test`}
        </span>
        <button
          onClick={() => setFilterFails((f) => !f)}
          className="px-3 py-1.5 rounded text-xs font-medium uppercase tracking-[0.1em]"
          style={{
            background: filterFails ? "rgba(224,122,95,0.1)" : "#1a1a1a",
            color: filterFails ? "#e07a5f" : "#555",
            border: "1px solid #222",
          }}
        >
          {filterFails ? "Show all" : "Show fails only"}
        </button>

        <div className="flex items-center gap-3 ml-auto">
          {feedback && (
            <span className="text-xs" style={{ color: feedback.kind === "ok" ? "#4fae8f" : "#e07a5f" }}>
              {feedback.msg}
            </span>
          )}
          {hasUnsavedRrpEdits && (
            <button
              onClick={saveAllRrpEdits}
              disabled={isPending}
              className="px-4 py-1.5 rounded text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-50"
              style={{ background: "#c9a227", color: "#080808" }}
            >
              {isPending ? "Saving…" : `Save ${Object.keys(localRrpEdits).length} RRP change${Object.keys(localRrpEdits).length > 1 ? "s" : ""}`}
            </button>
          )}
          <button
            onClick={handleReset}
            disabled={isPending}
            className="px-3 py-1.5 rounded text-xs font-medium uppercase tracking-[0.1em] disabled:opacity-50"
            style={{ background: "#1a1a1a", color: "#555", border: "1px solid #222" }}
          >
            Reset RRP
          </button>
        </div>
      </div>

      {/* Assumptions */}
      <div
        className="rounded-xl p-5 mb-6 flex flex-wrap items-center gap-6"
        style={{ background: "#0a0a0a", border: "1px solid #1c1c1c" }}
      >
        {[
          { label: "Markup on COGS", key: "markup" as const },
          { label: "Retailer margin", key: "retailerMargin" as const },
          { label: "VAT rate", key: "vat" as const },
        ].map(({ label, key }) => (
          <label key={key} className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "#666" }}>
              {label}
            </span>
            <input
              className="w-16 px-2 py-1 rounded text-xs text-center tabular-nums outline-none"
              style={{ background: "#111", border: "1px solid #222", color: "#c9a227", fontWeight: 600 }}
              value={((config[key] - 1) * 100).toFixed(0) + "%"}
              onChange={(e) => {
                const raw = parseFloat(e.target.value.replace("%", ""));
                if (!isNaN(raw) && raw > 0 && raw < 200) {
                  saveConfig({ ...config, [key]: 1 + raw / 100 });
                }
              }}
            />
          </label>
        ))}
        <span className="text-[10px]" style={{ color: "#444" }}>
          Wholesale = COGS × (1 + markup) + Shipping
        </span>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "#0a0a0a", border: "1px solid #1c1c1c" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  { label: "Cocktail", align: "left" },
                  { label: "Size", align: "left" },
                  { label: "RRP", align: "right" },
                  { label: "COGS", align: "right" },
                  { label: "Ship", align: "right" },
                  { label: "Wholesale", align: "right" },
                  { label: "Retailer +30%", align: "right" },
                  { label: "Test", align: "center" },
                  { label: "Headroom", align: "right" },
                  { label: "Markup %", align: "right" },
                ].map(({ label, align }) => (
                  <th
                    key={label}
                    className="px-3 py-3 text-[10px] uppercase tracking-[0.1em] font-semibold whitespace-nowrap"
                    style={{
                      color: "#555",
                      borderBottom: "1px solid #1c1c1c",
                      textAlign: align as "left" | "right" | "center",
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((p) => {
                const ws = calcWholesale(p, config);
                const rp = calcRetailerPrice(ws, config);
                const passes = rp <= p.rrp;
                const headroom = Math.round((p.rrp - rp) * 100) / 100;
                const margin = calcMargin(p, config);
                const isEditing = editingId === p.id;
                const hasOverride = localRrpEdits[p.id] !== undefined || serverRrpOverrides[p.id] !== undefined;

                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid #141414" }}>
                    <td className="px-3 py-3 font-semibold" style={{ color: "#f0f0f0" }}>
                      {p.name}
                    </td>
                    <td className="px-3 py-3" style={{ color: "#777" }}>
                      {p.size}
                    </td>

                    {/* RRP — click to edit */}
                    <td
                      className="px-3 py-3 text-right tabular-nums cursor-pointer"
                      style={{
                        color: localRrpEdits[p.id] !== undefined ? "#FFC107" : hasOverride ? "#c9a227" : "#4FC3F7",
                        fontWeight: hasOverride || localRrpEdits[p.id] !== undefined ? 700 : 400,
                      }}
                      onClick={() => !isEditing && startEdit(p.id, p.rrp)}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          className="w-16 px-1.5 py-0.5 rounded text-xs text-right outline-none tabular-nums"
                          style={{ background: "#1a1a1a", border: "1px solid #4FC3F7", color: "#4FC3F7", fontWeight: 600 }}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                      ) : (
                        GBP(p.rrp)
                      )}
                    </td>

                    {/* COGS — derived, read-only */}
                    <td className="px-3 py-3 text-right tabular-nums" style={{ color: "#cfcfcf" }}>
                      {GBP(p.cogs)}
                    </td>

                    <td className="px-3 py-3 text-right tabular-nums" style={{ color: "#555" }}>
                      {GBP(p.shipping)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: "#f0f0f0" }}>
                      {GBP(ws)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums" style={{ color: "#999" }}>
                      {GBP(rp)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.08em]"
                        style={{
                          background: passes ? "rgba(79,174,143,0.1)" : "rgba(224,122,95,0.1)",
                          color: passes ? "#4fae8f" : "#e07a5f",
                        }}
                      >
                        {passes ? "Pass" : "Fail"}
                      </span>
                    </td>
                    <td
                      className="px-3 py-3 text-right tabular-nums"
                      style={{
                        color: headroom < 0 ? "#e07a5f" : headroom < 0.5 ? "#c9a227" : "#4fae8f",
                        fontWeight: headroom < 0.5 ? 700 : 400,
                      }}
                    >
                      {headroom >= 0 ? "+" : ""}
                      {GBP(headroom)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums" style={{ color: "#777" }}>
                      {margin.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap gap-8 mt-6 justify-center">
        {[
          { label: "SKUs", value: products.length.toString() },
          { label: "All pass", value: allPass ? "Yes" : `${failCount} fail` },
          {
            label: "Avg wholesale",
            value: GBP(products.reduce((s, p) => s + calcWholesale(p, config), 0) / products.length),
          },
          {
            label: "Avg markup",
            value: (products.reduce((s, p) => s + calcMargin(p, config), 0) / products.length).toFixed(1) + "%",
          },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-[9px] uppercase tracking-[0.12em]" style={{ color: "#555" }}>
              {label}
            </p>
            <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: "#c9a227" }}>
              {value}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
