"use client";

import { BatchCalculation } from "@/types";

interface Props {
  result: BatchCalculation;
  date?: string;
}

export default function PrintView({ result, date }: Props) {
  return (
    <div className="print-sheet" style={{ fontFamily: "Arial, sans-serif", color: "#000", background: "#fff", padding: "24px 32px", maxWidth: 700 }}>
      {/* Header */}
      <div style={{ borderBottom: "3px solid #2d6a4f", paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0a0a0a", margin: 0 }}>
              MFC Batch Calculator
            </h1>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#2d6a4f", margin: "4px 0 0" }}>
              Batch Sheet — {result.recipeName}
            </h2>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#666" }}>
            {date && <p style={{ margin: 0 }}>{date}</p>}
            <p style={{ margin: 0 }}>{result.targetLitres}L / {result.targetMl.toLocaleString()}ml</p>
          </div>
        </div>
      </div>

      {/* Jerry Cans */}
      {result.jerryCans.length > 0 && (
        <PrintSection title="Jerry Cans">
          {result.jerryCans.map((item) => (
            <PrintRow key={item.ingredientName} label={item.ingredientName} value={`${item.ml.toLocaleString()} ml`} />
          ))}
        </PrintSection>
      )}

      {/* Bottles */}
      {result.bottles.length > 0 && (
        <PrintSection title="Bottles">
          {result.bottles.map((item) => (
            <div key={item.ingredientName} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #eee" }}>
              <span style={{ fontWeight: 500 }}>{item.ingredientName}</span>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontWeight: 700 }}>{item.ml.toLocaleString()}ml</span>
                <span style={{ color: "#555", fontSize: 12, marginLeft: 8 }}>
                  {item.fullBottles > 0 ? (
                    `${item.fullBottles} × ${item.bottleSize}ml bottle${item.fullBottles !== 1 ? "s" : ""}${item.remainderMl > 0 ? ` + ${item.remainderMl}ml` : ""}`
                  ) : (
                    `${item.remainderMl}ml from ${item.bottleSize}ml bottle`
                  )}
                </span>
              </div>
            </div>
          ))}
        </PrintSection>
      )}

      {/* House-made */}
      {result.houseMade.length > 0 && (
        <PrintSection title="House-made">
          {result.houseMade.map((item) => (
            <div key={item.ingredientName}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #eee" }}>
                <span style={{ fontWeight: 500 }}>{item.ingredientName}</span>
                <span style={{ fontWeight: 700 }}>{item.ml.toLocaleString()}ml</span>
              </div>
              {item.subRecipeItems && item.subRecipeItems.length > 0 && (
                <div style={{ marginLeft: 16, marginBottom: 8, background: "#f9f9f9", border: "1px solid #ddd", borderRadius: 6, padding: "8px 12px" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#2d6a4f", margin: "0 0 8px" }}>
                    {item.ingredientName} sub-recipe
                  </p>
                  {item.subRecipeItems.map((sri) => (
                    <div key={sri.ingredientName}>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13 }}>
                        <span>{sri.ingredientName}</span>
                        <span style={{ fontWeight: 600 }}>{sri.amountG}g</span>
                      </div>
                      {sri.isPhosphoricSolution && sri.phosphoricBreakdown && (
                        <div style={{ marginLeft: 12, background: "#f0f7f0", borderRadius: 4, padding: "4px 8px", marginBottom: 4, fontSize: 12 }}>
                          <em>To prepare {sri.amountG}g of 1.25% solution:</em>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Phosphoric acid (75%)</span>
                            <span>{sri.phosphoricBreakdown.acidG}g</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Water</span>
                            <span>{sri.phosphoricBreakdown.waterG}g</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </PrintSection>
      )}

      {/* Dashes */}
      {result.dashes.length > 0 && (
        <PrintSection title="Bitters / Dashes">
          {result.dashes.map((item) => (
            <PrintRow key={item.ingredientName} label={item.ingredientName} value={`${item.totalDashes} dashes`} />
          ))}
        </PrintSection>
      )}

      {/* Footer */}
      <div style={{ marginTop: 32, borderTop: "2px solid #2d6a4f", paddingTop: 12, fontSize: 11, color: "#888", display: "flex", justifyContent: "space-between" }}>
        <span>MFC Batch Calculator</span>
        <span>All quantities confirmed pre-batch</span>
      </div>
    </div>
  );
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#2d6a4f", borderBottom: "2px solid #2d6a4f", paddingBottom: 4, marginBottom: 8 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function PrintRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #eee" }}>
      <span style={{ fontWeight: 500 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}
