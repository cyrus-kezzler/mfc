"use client";

/**
 * Pack-size + pack-cost entry with a live unit-cost preview.
 *
 * Operators think in "a 700ml bottle of X for £15.86", not "£0.0227 per ml".
 * They enter the pack format; the system derives £/UOM for the recipe engine
 * and shows the result live so they can sanity-check before saving.
 */

import { useId, useState } from "react";
import { COLOR, FONT } from "@/lib/design";
import { inputStyle, labelStyle } from "../_components/forms";

type Props = {
  uom: "ml" | "g" | "each" | "m";
  defaultPackSize?: string | null;
  defaultPackCost?: string | null;
};

export function PackPricer({ uom, defaultPackSize, defaultPackCost }: Props) {
  const sizeId = useId();
  const costId = useId();
  const [size, setSize] = useState(defaultPackSize ?? (uom === "each" || uom === "m" ? "1" : ""));
  const [cost, setCost] = useState(defaultPackCost ?? "");

  const sizeNum = Number(size);
  const costNum = Number(cost);
  const ready =
    Number.isFinite(sizeNum) && sizeNum > 0 && Number.isFinite(costNum) && costNum >= 0;
  const unitCost = ready ? costNum / sizeNum : 0;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <label htmlFor={sizeId} style={{ display: "block" }}>
          <span style={labelStyle}>Pack size ({uom})</span>
          <input
            id={sizeId}
            name="packSize"
            type="number"
            step={uom === "each" || uom === "m" ? "1" : "0.001"}
            min="0"
            required
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder={uom === "ml" ? "e.g. 700" : uom === "g" ? "e.g. 500" : "e.g. 1"}
            style={inputStyle}
          />
        </label>
        <label htmlFor={costId} style={{ display: "block" }}>
          <span style={labelStyle}>Pack cost (£)</span>
          <input
            id={costId}
            name="packCost"
            type="number"
            step="0.01"
            min="0"
            required
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="e.g. 15.86"
            style={inputStyle}
          />
        </label>
      </div>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          color: ready ? COLOR.accent : COLOR.mutedLight,
          padding: "6px 0",
        }}
      >
        {ready ? (
          <>
            = <strong style={{ fontWeight: 600 }}>£{unitCost.toFixed(4)}</strong> per {uom}
            {sizeNum !== 1 && (
              <>
                {" "}
                <span style={{ color: COLOR.muted }}>
                  ({size}
                  {uom} @ £{costNum.toFixed(2)})
                </span>
              </>
            )}
          </>
        ) : (
          <>Enter pack size and cost to see unit cost.</>
        )}
      </div>
    </div>
  );
}
