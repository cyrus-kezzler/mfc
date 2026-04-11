"use client";

import { useMemo, useState, useTransition } from "react";
import {
  IngredientMaster,
  IngredientPriceHistoryEntry,
  computeImpact,
  pricePerMl,
} from "@/lib/ingredients";
import { updateIngredientPrice } from "@/app/actions/ingredients";

const fmt = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });

const fmtDelta = (n: number) => {
  const abs = Math.abs(n).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  });
  if (n > 0.005) return `+${abs}`;
  if (n < -0.005) return `−${abs}`;
  return abs;
};

const fmtMl = (n: number) =>
  n.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " ml";

const fmtDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

type Props = {
  ingredients: IngredientMaster[];
  priceHistory: IngredientPriceHistoryEntry[];
  usageCounts: Record<string, number>;
};

export default function IngredientsClient({ ingredients, priceHistory, usageCounts }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.spreadsheetName?.toLowerCase().includes(q) ?? false),
    );
  }, [ingredients, query]);

  const selected = ingredients.find((i) => i.id === selectedId) ?? null;
  const selectedHistory = useMemo(
    () =>
      selected
        ? priceHistory
            .filter((h) => h.ingredientId === selected.id)
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
        : [],
    [priceHistory, selected],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8">
      {/* LEFT — ingredient table */}
      <section>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search ingredients…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
            style={{
              background: "#0f0f0f",
              border: "1px solid #1c1c1c",
              color: "#f0f0f0",
            }}
          />
        </div>

        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "#0a0a0a", border: "1px solid #1c1c1c" }}
        >
          <div
            className="grid grid-cols-[1.6fr_0.6fr_0.7fr_0.4fr] gap-2 px-4 py-3 text-[10px] uppercase tracking-[0.12em] font-semibold"
            style={{ color: "#555", borderBottom: "1px solid #1c1c1c" }}
          >
            <span>Ingredient</span>
            <span className="text-right">Bottle</span>
            <span className="text-right">Price</span>
            <span className="text-right">Used in</span>
          </div>
          <ul>
            {filtered.map((ing) => {
              const active = ing.id === selectedId;
              const count = usageCounts[ing.id] ?? 0;
              return (
                <li key={ing.id}>
                  <button
                    onClick={() => setSelectedId(ing.id)}
                    className="w-full grid grid-cols-[1.6fr_0.6fr_0.7fr_0.4fr] gap-2 px-4 py-3 text-sm text-left transition-colors"
                    style={{
                      background: active ? "#121212" : "transparent",
                      borderBottom: "1px solid #141414",
                      color: active ? "#f0f0f0" : "#cfcfcf",
                    }}
                  >
                    <span className="truncate">
                      {ing.name}
                      {ing.notes && (
                        <span className="ml-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: "#555" }}>
                          house
                        </span>
                      )}
                    </span>
                    <span className="text-right tabular-nums" style={{ color: "#777" }}>
                      {ing.bottleSizeMl} ml
                    </span>
                    <span className="text-right tabular-nums">{fmt(ing.currentPrice)}</span>
                    <span
                      className="text-right tabular-nums"
                      style={{ color: count > 0 ? "#c9a227" : "#333" }}
                    >
                      {count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* RIGHT — detail + impact preview */}
      <section>
        {selected ? (
          <IngredientDetail ingredient={selected} history={selectedHistory} />
        ) : (
          <div
            className="rounded-xl p-10 text-center"
            style={{ background: "#0a0a0a", border: "1px solid #1c1c1c" }}
          >
            <div className="w-8 h-px mx-auto mb-6" style={{ background: "#c9a227" }} />
            <p className="text-sm" style={{ color: "#555" }}>
              Select an ingredient to see its history, the drinks that use it, and to model a price change.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function IngredientDetail({
  ingredient,
  history,
}: {
  ingredient: IngredientMaster;
  history: IngredientPriceHistoryEntry[];
}) {
  const [newPriceStr, setNewPriceStr] = useState(ingredient.currentPrice.toString());
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const newPrice = Number(newPriceStr);
  const newPriceValid = Number.isFinite(newPrice) && newPrice >= 0;
  const changed = newPriceValid && Math.abs(newPrice - ingredient.currentPrice) > 0.0005;

  const impact = useMemo(
    () => (newPriceValid ? computeImpact(ingredient, newPrice) : []),
    [ingredient, newPrice, newPriceValid],
  );

  const ppmCurrent = pricePerMl(ingredient);
  const ppmNew = newPriceValid ? newPrice / ingredient.bottleSizeMl : ppmCurrent;
  const deltaPct = ingredient.currentPrice > 0
    ? ((newPrice - ingredient.currentPrice) / ingredient.currentPrice) * 100
    : 0;

  function handleSave() {
    if (!changed || !newPriceValid) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await updateIngredientPrice(ingredient.id, newPrice, note);
      if (res.ok) {
        setFeedback({ kind: "ok", msg: "Saved. Commit and push to make it live on the app." });
        setNote("");
      } else {
        setFeedback({ kind: "err", msg: res.error });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header card */}
      <div
        className="rounded-xl p-6"
        style={{ background: "#0a0a0a", border: "1px solid #1c1c1c" }}
      >
        <div className="w-8 h-px mb-5" style={{ background: "#c9a227" }} />
        <h2
          className="text-2xl font-bold mb-1"
          style={{ color: "#f0f0f0", letterSpacing: "-0.01em" }}
        >
          {ingredient.name}
        </h2>
        <p className="text-xs uppercase tracking-[0.15em]" style={{ color: "#c9a227" }}>
          {ingredient.bottleSizeMl} ml · {fmt(ingredient.currentPrice)} · set {fmtDate(ingredient.currentPriceSetAt)}
        </p>
        {ingredient.notes && (
          <p className="text-xs mt-3" style={{ color: "#555" }}>
            {ingredient.notes}
          </p>
        )}
      </div>

      {/* Scenario editor */}
      <div
        className="rounded-xl p-6"
        style={{ background: "#0a0a0a", border: "1px solid #1c1c1c" }}
      >
        <p
          className="text-[10px] uppercase tracking-[0.15em] font-semibold mb-4"
          style={{ color: "#555" }}
        >
          Model a price change
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <label className="flex-1">
            <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "#666" }}>
              New price (per {ingredient.bottleSizeMl} ml bottle)
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newPriceStr}
              onChange={(e) => setNewPriceStr(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none tabular-nums"
              style={{
                background: "#111",
                border: "1px solid #222",
                color: "#f0f0f0",
              }}
            />
          </label>
          <label className="flex-[1.4]">
            <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "#666" }}>
              Note (optional — shows up in history)
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Supplier price increase Q2"
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "#111",
                border: "1px solid #222",
                color: "#f0f0f0",
              }}
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm tabular-nums">
          <Stat
            label="Current £/ml"
            value={`£${ppmCurrent.toFixed(5)}`}
          />
          <Stat
            label="New £/ml"
            value={`£${ppmNew.toFixed(5)}`}
            color={changed ? "#c9a227" : undefined}
          />
          <Stat
            label="Change"
            value={changed ? `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%` : "—"}
            color={changed ? (deltaPct >= 0 ? "#e07a5f" : "#4fae8f") : undefined}
          />
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button
            disabled={!changed || isPending}
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-xs uppercase tracking-[0.12em] font-semibold transition-opacity disabled:opacity-30"
            style={{
              background: "#c9a227",
              color: "#080808",
            }}
          >
            {isPending ? "Saving…" : "Save price change"}
          </button>
          {feedback && (
            <span
              className="text-xs"
              style={{ color: feedback.kind === "ok" ? "#4fae8f" : "#e07a5f" }}
            >
              {feedback.msg}
            </span>
          )}
        </div>
      </div>

      {/* Impact preview */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "#0a0a0a", border: "1px solid #1c1c1c" }}
      >
        <div className="px-6 py-4" style={{ borderBottom: "1px solid #1c1c1c" }}>
          <p
            className="text-[10px] uppercase tracking-[0.15em] font-semibold"
            style={{ color: "#555" }}
          >
            Impact on MFC drinks
          </p>
          <p className="text-xs mt-1" style={{ color: "#777" }}>
            {impact.length === 0
              ? "No MFC recipes use this ingredient yet."
              : `${impact.length} recipe${impact.length === 1 ? "" : "s"} — sorted by biggest 500 ml impact`}
          </p>
        </div>

        {impact.length > 0 && (
          <>
            <div
              className="grid grid-cols-[1.4fr_0.5fr_0.7fr_0.7fr_0.6fr] gap-2 px-6 py-3 text-[10px] uppercase tracking-[0.12em] font-semibold"
              style={{ color: "#555", borderBottom: "1px solid #141414" }}
            >
              <span>Drink</span>
              <span className="text-right">ml / 500</span>
              <span className="text-right">Current</span>
              <span className="text-right">New</span>
              <span className="text-right">Δ / 500</span>
            </div>
            <ul>
              {impact.map((row) => (
                <li
                  key={row.recipeName}
                  className="grid grid-cols-[1.4fr_0.5fr_0.7fr_0.7fr_0.6fr] gap-2 px-6 py-3 text-sm tabular-nums"
                  style={{ borderBottom: "1px solid #141414", color: "#cfcfcf" }}
                >
                  <span className="truncate">{row.recipeName}</span>
                  <span className="text-right" style={{ color: "#777" }}>
                    {fmtMl(row.mlPerBottle500)}
                  </span>
                  <span className="text-right">{fmt(row.currentCostPer500)}</span>
                  <span className="text-right" style={{ color: changed ? "#c9a227" : "#cfcfcf" }}>
                    {fmt(row.newCostPer500)}
                  </span>
                  <span
                    className="text-right font-semibold"
                    style={{
                      color: !changed
                        ? "#444"
                        : row.deltaPer500 > 0.005
                        ? "#e07a5f"
                        : row.deltaPer500 < -0.005
                        ? "#4fae8f"
                        : "#444",
                    }}
                  >
                    {changed ? fmtDelta(row.deltaPer500) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Price history */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "#0a0a0a", border: "1px solid #1c1c1c" }}
      >
        <div className="px-6 py-4" style={{ borderBottom: "1px solid #1c1c1c" }}>
          <p
            className="text-[10px] uppercase tracking-[0.15em] font-semibold"
            style={{ color: "#555" }}
          >
            Price history
          </p>
        </div>
        {history.length === 0 ? (
          <p className="px-6 py-6 text-xs" style={{ color: "#555" }}>
            No history recorded.
          </p>
        ) : (
          <ul>
            {history.map((h, idx) => (
              <li
                key={`${h.date}-${idx}`}
                className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-3 text-sm"
                style={{ borderBottom: "1px solid #141414", color: "#cfcfcf" }}
              >
                <span className="truncate" style={{ color: "#777" }}>
                  {h.note ?? "—"}
                </span>
                <span className="text-xs tabular-nums" style={{ color: "#555" }}>
                  {fmtDate(h.date)}
                </span>
                <span className="tabular-nums">{fmt(h.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{ background: "#111", border: "1px solid #1a1a1a" }}
    >
      <p className="text-[9px] uppercase tracking-[0.12em]" style={{ color: "#555" }}>
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold" style={{ color: color ?? "#f0f0f0" }}>
        {value}
      </p>
    </div>
  );
}
