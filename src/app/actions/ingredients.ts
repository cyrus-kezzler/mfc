"use server";

/**
 * Server Action for updating ingredient prices.
 *
 * Writes to the database, not to a JSON file: the `components` row is updated
 * (pack cost, cached unit cost, set-at stamp) and a `component_price_history`
 * row is appended with source "manual", so the append-only audit trail lives
 * in the same place as the price itself.
 */

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  components,
  componentPriceHistory,
  type NewComponentPriceHistoryRow,
} from "@/db/schema";

export interface UpdatedIngredient {
  id: number;
  name: string;
  packSize: number | null;
  packCost: number | null;
  unitCost: number;
  unitCostSetAt: string;
}

export type UpdatePriceResult =
  | { ok: true; ingredient: UpdatedIngredient }
  | { ok: false; error: string };

/**
 * Set a new price for a component.
 *
 * `newPrice` is the PACK cost when the component has a pack size greater than
 * one (e.g. £15.17 for a 700ml bottle), otherwise it is the unit cost
 * directly (each-priced dry goods). The cached per-UOM unit cost is re-derived
 * and a manual price-history row is appended either way.
 */
export async function updateIngredientPrice(
  componentId: number,
  newPrice: number,
  note?: string,
): Promise<UpdatePriceResult> {
  if (!Number.isInteger(componentId) || componentId <= 0) {
    return { ok: false, error: "componentId must be a positive integer." };
  }
  if (!Number.isFinite(newPrice) || newPrice < 0) {
    return { ok: false, error: "Price must be a non-negative number." };
  }

  try {
    const [existing] = await db
      .select()
      .from(components)
      .where(eq(components.id, componentId));
    if (!existing) {
      return { ok: false, error: `No component with id ${componentId}.` };
    }

    const packSize = Number(existing.packSize ?? 0);
    const pricedByPack = Number.isFinite(packSize) && packSize > 1;

    const rounded = Math.round(newPrice * 10000) / 10000;
    const newPackCost = pricedByPack ? rounded : null;
    const newUnitCost = pricedByPack ? rounded / packSize : rounded;
    const unitCostStr = newUnitCost.toFixed(4);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    await db
      .update(components)
      .set({
        ...(pricedByPack ? { packCost: rounded.toFixed(2) } : {}),
        unitCost: unitCostStr,
        unitCostSetAt: now,
        updatedAt: now,
      })
      .where(eq(components.id, componentId));

    const before = pricedByPack
      ? `pack £${Number(existing.packCost ?? 0).toFixed(2)}`
      : `£${Number(existing.unitCost ?? 0).toFixed(4)}/${existing.uom}`;
    const after = pricedByPack
      ? `pack £${rounded.toFixed(2)}`
      : `£${unitCostStr}/${existing.uom}`;

    const historyRow: NewComponentPriceHistoryRow = {
      componentId,
      supplierId: existing.defaultSupplierId ?? null,
      unitCost: unitCostStr,
      currency: "GBP",
      uom: existing.uom,
      effectiveDate: today,
      source: "manual",
      notes: [note?.trim(), `Back Bar ingredient editor: ${before} to ${after}`]
        .filter(Boolean)
        .join(" | "),
    };
    await db.insert(componentPriceHistory).values(historyRow);

    revalidatePath("/finances/ingredients");
    revalidatePath("/finances/pricing");
    revalidatePath("/finances/profitability");
    revalidatePath("/finances/pnl");
    revalidatePath("/finances/rrp");
    revalidatePath("/erp/components");

    return {
      ok: true,
      ingredient: {
        id: existing.id,
        name: existing.name,
        packSize: pricedByPack ? packSize : null,
        packCost: newPackCost,
        unitCost: newUnitCost,
        unitCostSetAt: today,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
