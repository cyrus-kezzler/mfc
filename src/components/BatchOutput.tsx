"use client";

import { BatchCalculation } from "@/types";

interface Props {
  result: BatchCalculation;
}

export default function BatchOutput({ result }: Props) {
  const hasJerryCans = result.jerryCans.length > 0;
  const hasBottles = result.bottles.length > 0;
  const hasHouseMade = result.houseMade.length > 0;
  const hasDashes = result.dashes.length > 0;

  // Collect all ingredient notes with their ingredient name
  const allNotes: { ingredientName: string; note: string }[] = [
    ...result.jerryCans,
    ...result.bottles,
    ...result.houseMade,
    ...result.dashes,
  ]
    .filter((item) => item.note)
    .map((item) => ({ ingredientName: item.ingredientName, note: item.note! }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: "#1e1e1e", borderColor: "#2d2d2d" }}
      >
        <div className="p-5">
          <h2 className="text-xl font-semibold" style={{ color: "#c9a227" }}>
            {result.recipeName}
          </h2>
          <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>
            {result.targetLitres}L batch — {result.targetMl.toLocaleString()}ml total
          </p>
        </div>

        {/* Production notes — prominently below the title */}
        {allNotes.length > 0 && (
          <div
            className="px-5 py-4 border-t"
            style={{ background: "#1a1408", borderColor: "#3d2e0a" }}
          >
            <p
              className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: "#c9a227" }}
            >
              Before you start
            </p>
            <ul className="space-y-2">
              {allNotes.map(({ ingredientName, note }) => (
                <li key={ingredientName} className="flex gap-2 items-start">
                  <span className="mt-0.5 text-sm" style={{ color: "#c9a227" }}>⚠</span>
                  <p className="text-sm leading-snug" style={{ color: "#e5c97a" }}>
                    <span className="font-semibold">{ingredientName}:</span>{" "}
                    {note}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Jerry Cans */}
      {hasJerryCans && (
        <Section title="Jerry Cans" color="#52b788" icon="🧃">
          {result.jerryCans.map((item) => (
            <div key={item.ingredientName} className="py-3 border-b last:border-b-0" style={{ borderColor: "#2d2d2d" }}>
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-white">{item.ingredientName}</span>
                <span style={{ color: "#52b788" }} className="font-mono font-semibold">
                  {item.ml.toLocaleString()} ml
                </span>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Bottles */}
      {hasBottles && (
        <Section title="Bottles" color="#c9a227" icon="🍾">
          {result.bottles.map((item) => (
            <div key={item.ingredientName} className="py-3 border-b last:border-b-0" style={{ borderColor: "#2d2d2d" }}>
              <div className="flex items-start justify-between gap-4">
                <span className="font-medium text-white">{item.ingredientName}</span>
                <div className="text-right">
                  <span style={{ color: "#c9a227" }} className="font-mono font-semibold block">
                    {item.ml.toLocaleString()} ml
                  </span>
                  <span className="text-xs mt-0.5 block" style={{ color: "#9ca3af" }}>
                    {item.fullBottles > 0 ? (
                      <>
                        <span style={{ color: "#e0b840" }}>{item.fullBottles}</span>
                        {" "}full {item.bottleSize}ml bottle{item.fullBottles !== 1 ? "s" : ""}
                        {item.remainderMl > 0 && (
                          <> + <span style={{ color: "#e0b840" }}>{item.remainderMl}ml</span> remaining</>
                        )}
                      </>
                    ) : (
                      <>
                        <span style={{ color: "#e0b840" }}>{item.remainderMl}ml</span>
                        {" "}from a {item.bottleSize}ml bottle
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* House-made */}
      {hasHouseMade && (
        <Section title="House-made" color="#40916c" icon="⚗️">
          {result.houseMade.map((item) => (
            <div key={item.ingredientName} className="py-3 border-b last:border-b-0" style={{ borderColor: "#2d2d2d" }}>
              <div className="flex items-start justify-between gap-4">
                <span className="font-medium text-white">{item.ingredientName}</span>
                <span style={{ color: "#52b788" }} className="font-mono font-semibold">
                  {item.ml.toLocaleString()} ml
                </span>
              </div>

              {/* Sub-recipe expansion */}
              {item.subRecipeItems && item.subRecipeItems.length > 0 && (
                <div
                  className="mt-3 ml-3 rounded-lg p-4 space-y-2"
                  style={{ background: "#0f1f17", border: "1px solid #1a3d29" }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#40916c" }}>
                    Sub-recipe: {item.ingredientName} breakdown
                  </p>
                  {item.subRecipeItems.map((sri) => (
                    <div key={sri.ingredientName}>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-sm" style={{ color: "#d1d5db" }}>
                          {sri.ingredientName}
                        </span>
                        <span className="font-mono text-sm font-medium" style={{ color: "#52b788" }}>
                          {sri.amountG}g
                        </span>
                      </div>
                      {/* Phosphoric acid breakdown */}
                      {sri.isPhosphoricSolution && sri.phosphoricBreakdown && (
                        <div
                          className="mt-1 ml-3 p-2 rounded text-xs space-y-1"
                          style={{ background: "#0a1a10", border: "1px solid #1a3020" }}
                        >
                          <p className="font-semibold mb-1" style={{ color: "#40916c" }}>
                            To prepare {sri.amountG}g of 1.25% phosphoric solution:
                          </p>
                          <div className="flex justify-between">
                            <span style={{ color: "#9ca3af" }}>
                              Food-grade phosphoric acid (75%)
                            </span>
                            <span className="font-mono font-medium" style={{ color: "#52b788" }}>
                              {sri.phosphoricBreakdown.acidG}g
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: "#9ca3af" }}>Water</span>
                            <span className="font-mono font-medium" style={{ color: "#52b788" }}>
                              {sri.phosphoricBreakdown.waterG}g
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Dashes */}
      {hasDashes && (
        <Section title="Bitters / Dashes" color="#c9a227" icon="💧">
          {result.dashes.map((item) => (
            <div key={item.ingredientName} className="py-3 border-b last:border-b-0" style={{ borderColor: "#2d2d2d" }}>
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-white">{item.ingredientName}</span>
                <span style={{ color: "#c9a227" }} className="font-mono font-semibold">
                  {item.totalDashes} dashes
                </span>
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  color,
  icon,
  children,
}: {
  title: string;
  color: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#141414", borderColor: "#2d2d2d" }}>
      <div className="px-5 py-3 border-b flex items-center gap-2" style={{ background: "#1a1a1a", borderColor: "#2d2d2d" }}>
        <span className="text-base">{icon}</span>
        <h3 className="font-semibold text-sm uppercase tracking-wider" style={{ color }}>
          {title}
        </h3>
      </div>
      <div className="px-5">
        {children}
      </div>
    </div>
  );
}

