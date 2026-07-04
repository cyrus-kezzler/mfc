"use client";

/**
 * Shared form body for component create + edit.
 * Client component because PackPricer needs live calculation as the
 * operator types pack size and cost.
 */

import { useState } from "react";
import Link from "next/link";
import { COLOR } from "@/lib/design";
import { Field, Textarea, Select, buttonPrimary, buttonGhost, inputStyle, labelStyle } from "../_components/forms";
import type { Component } from "@/db/schema";
import { derivePurchaseLabel, type ConsumptionUom, type PurchaseUom } from "@/lib/uom";
import { PackPricer } from "./_PackPricer";

const TYPE_OPTIONS = [
  { value: "ingredient", label: "Ingredient" },
  { value: "sub_recipe", label: "Sub-recipe (treat as ingredient in MVP)" },
  { value: "dry_good", label: "Dry good" },
  { value: "packaging", label: "Packaging" },
];

const UOM_OPTIONS = [
  { value: "ml", label: "ml" },
  { value: "g", label: "g" },
  { value: "each", label: "each" },
  { value: "m", label: "m (length)" },
];

const PURCHASE_UOM_OPTIONS = [
  { value: "bottle", label: "bottle" },
  { value: "case", label: "case" },
  { value: "pouch", label: "pouch" },
  { value: "roll", label: "roll" },
  { value: "bag", label: "bag" },
  { value: "each", label: "each" },
];

type Uom = ConsumptionUom;

/** Sensible purchase-uom default when creating: bought-in liquids are bottles,
 *  countable items are each. Operator can override. */
function defaultPurchaseUom(uom: Uom): PurchaseUom {
  return uom === "ml" || uom === "g" ? "bottle" : "each";
}

export function ComponentFormBody({
  component,
  suppliers,
}: {
  component?: Component;
  suppliers: { id: number; name: string }[];
}) {
  const supplierOptions = suppliers.map((s) => ({ value: String(s.id), label: s.name }));
  const [uom, setUom] = useState<Uom>((component?.uom as Uom) ?? "ml");
  const [purchaseUom, setPurchaseUom] = useState<PurchaseUom>(
    (component?.purchaseUom as PurchaseUom) ?? defaultPurchaseUom((component?.uom as Uom) ?? "ml"),
  );

  const derivedLabel = derivePurchaseLabel({
    purchaseUom,
    packSize: component?.packSize != null ? Number(component.packSize) : null,
    consumptionUom: uom,
  });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Field label="Name" name="name" defaultValue={component?.name} required autoFocus />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Select label="Type" name="type" defaultValue={component?.type ?? "ingredient"} required options={TYPE_OPTIONS} />
        <label style={{ display: "block" }}>
          <span style={labelStyle}>
            Consumption unit <span style={{ color: COLOR.flag, marginLeft: 4 }}>*</span>
          </span>
          <select
            name="uom"
            defaultValue={component?.uom ?? "ml"}
            required
            onChange={(e) => setUom(e.target.value as Uom)}
            style={{ ...inputStyle, fontFamily: "inherit" }}
          >
            {UOM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>
            Purchase unit <span style={{ color: COLOR.flag, marginLeft: 4 }}>*</span>
          </span>
          <select
            name="purchaseUom"
            value={purchaseUom}
            required
            onChange={(e) => setPurchaseUom(e.target.value as PurchaseUom)}
            style={{ ...inputStyle, fontFamily: "inherit" }}
          >
            {PURCHASE_UOM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Purchase label (optional)"
          name="purchaseLabel"
          defaultValue={component?.purchaseLabel ?? ""}
          placeholder={derivedLabel}
        />
      </div>
      <p style={{ fontSize: 11, color: COLOR.muted, marginTop: -6 }}>
        How it&apos;s bought &amp; received. Leave the label blank to show the derived{" "}
        <span style={{ color: COLOR.ink }}>&ldquo;{derivedLabel}&rdquo;</span>.
      </p>

      <PackPricer
        uom={uom}
        purchaseUom={purchaseUom}
        defaultPackSize={component?.packSize ?? null}
        defaultPackCost={component?.packCost ?? null}
      />

      <Select
        label="Default supplier"
        name="defaultSupplierId"
        defaultValue={component?.defaultSupplierId ? String(component.defaultSupplierId) : ""}
        options={supplierOptions}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <Field
          label={`Reorder at (${purchaseUom}s)`}
          name="reorderThreshold"
          type="number"
          step="0.001"
          min="0"
          defaultValue={component?.reorderThreshold ?? ""}
        />
        <Field
          label={`Reorder qty (${purchaseUom}s)`}
          name="reorderQuantity"
          type="number"
          step="0.001"
          min="0"
          defaultValue={component?.reorderQuantity ?? ""}
        />
        <Field
          label="Lead time (days)"
          name="leadTimeDays"
          type="number"
          min="0"
          defaultValue={component?.leadTimeDays ?? ""}
        />
      </div>
      <Field
        label="Storage location"
        name="storageLocation"
        placeholder="e.g. dry store, cold store, spirits cage"
        defaultValue={component?.storageLocation ?? ""}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field
          label="ABV % (ingredients only)"
          name="abv"
          type="number"
          step="0.01"
          min="0"
          defaultValue={component?.abv ?? ""}
        />
        <Field
          label="Shelf life (days)"
          name="shelfLifeDays"
          type="number"
          min="0"
          defaultValue={component?.shelfLifeDays ?? ""}
        />
      </div>
      <Textarea label="Notes" name="notes" rows={3} defaultValue={component?.notes ?? ""} />

      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button type="submit" style={buttonPrimary}>
          {component ? "Save changes" : "Create component"}
        </button>
        <Link
          href="/erp/components"
          style={{ ...buttonGhost, textDecoration: "none", display: "inline-block" }}
        >
          Cancel
        </Link>
      </div>

      <p style={{ fontSize: 11, color: COLOR.muted, marginTop: 4 }}>
        Editing pack cost or size stamps a price-history entry automatically.
      </p>
    </div>
  );
}
