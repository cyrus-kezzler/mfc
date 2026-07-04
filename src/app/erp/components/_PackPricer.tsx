"use client";

/**
 * Purchase-size + purchase-unit-cost entry with a live derived-cost preview.
 *
 * Operators think in "a 700ml bottle of X for £15.86", not "£0.0227 per ml".
 * They enter the purchase size (in consumption uom) and the cost per purchase
 * unit; the system derives £/consumption-uom for the recipe engine and shows it
 * live so they can sanity-check before saving.
 *
 * Column names: `packSize` ≡ spec purchase_size, `packCost` ≡ spec unit_cost
 * (£ per purchase_uom). See src/db/schema.ts for the mapping.
 */

import { useId, useState } from "react";
import { COLOR, FONT } from "@/lib/design";
import type { ConsumptionUom, PurchaseUom } from "@/lib/uom";
import { inputStyle, labelStyle } from "../_components/forms";

type Props = {
  uom: ConsumptionUom;
  purchaseUom: PurchaseUom;
  defaultPackSize?: string | null;
  defaultPackCost?: string | null;
};

export function PackPricer({ uom, purchaseUom, defaultPackSize, defaultPackCost }: Props) {
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
          <span style={labelStyle}>Purchase size ({uom})</span>
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
          <span style={labelStyle}>Unit cost (£ per {purchaseUom})</span>
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
            = <strong style={{ fontWeight: 600 }}>≈ £{unitCost.toFixed(4)}</strong> per {uom}
            {" "}
            <span style={{ color: COLOR.muted }}>
              (£{costNum.toFixed(2)} per {purchaseUom} of {formatSize(sizeNum)}
              {uom === "each" || uom === "m" ? ` ${uom}` : uom})
            </span>
          </>
        ) : (
          <>Enter purchase size and unit cost to see the derived per-{uom} cost.</>
        )}
      </div>
    </div>
  );
}

function formatSize(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}
