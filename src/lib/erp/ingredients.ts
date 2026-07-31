/**
 * The ingredient register, read from the database.
 *
 * Replaces src/lib/ingredients.ts (which read src/data/ingredients.json) and
 * src/data/ingredients.ts (MASTER_INGREDIENTS). Those were two of the four
 * disagreeing registers: 45 and 72 entries respectively against the database's
 * 93, joined to each other by matching names as strings, which is why they
 * drifted apart and why the same ingredient could cost two different amounts
 * depending on which list a calculation happened to read.
 *
 * Everything here carries an id, a price, a date and a provenance, because a
 * number without those is not data.
 */

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { components, componentPriceHistory, type Component } from "@/db/schema";

export type PriceProvenance = "inbound" | "manual" | "placeholder" | "none";

export interface IngredientRow {
  id: number;
  name: string;
  type: Component["type"];
  uom: Component["uom"];
  /** How the supplier sells it, e.g. 700 (ml) at £15.17. */
  packSize: number | null;
  packCost: number | null;
  /** £ per UOM. The operative figure for costing. */
  unitCost: number;
  unitCostSetAt: string | null;
  abv: number | null;
  active: boolean;
  notes: string | null;
  provenance: PriceProvenance;
  /** True when this is a sub-recipe we make rather than buy. */
  isSubRecipe: boolean;
}

function n(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

/**
 * Cost per UOM. Prefers pack_cost / pack_size for bulk lines because pack_cost
 * is numeric(12,2) while the cached unit_cost is numeric(12,4): on a £15.41
 * litre that rounding is a fifth of a penny per 700ml bottle. For each-priced
 * dry goods the pack columns round sub-penny costs the wrong way, so the
 * cached unit cost wins there.
 */
export function perUomCost(c: {
  packSize: string | null;
  packCost: string | null;
  unitCost: string | null;
}): number {
  const size = n(c.packSize) ?? 0;
  const cost = n(c.packCost) ?? 0;
  if (size > 1 && cost > 0) return cost / size;
  return n(c.unitCost) ?? 0;
}

export async function listIngredients(opts?: { includeInactive?: boolean }): Promise<IngredientRow[]> {
  const all = await db.select().from(components);
  const history = await db.select().from(componentPriceHistory);

  const newestSource = new Map<number, PriceProvenance>();
  for (const h of history) {
    const prev = newestSource.get(h.componentId);
    if (!prev) newestSource.set(h.componentId, h.source as PriceProvenance);
  }
  // Re-walk in date order so the newest row wins.
  const byComponent = new Map<number, typeof history>();
  for (const h of history) {
    byComponent.set(h.componentId, [...(byComponent.get(h.componentId) ?? []), h]);
  }
  for (const [id, rows] of byComponent) {
    rows.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
    newestSource.set(id, rows[0].source as PriceProvenance);
  }

  return all
    .filter((c) => opts?.includeInactive || c.active)
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      uom: c.uom,
      packSize: n(c.packSize),
      packCost: n(c.packCost),
      unitCost: perUomCost(c),
      unitCostSetAt: c.unitCostSetAt ? c.unitCostSetAt.toISOString().slice(0, 10) : null,
      abv: n(c.abv),
      active: c.active,
      notes: c.notes,
      provenance: newestSource.get(c.id) ?? "none",
      isSubRecipe: c.type === "sub_recipe",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getIngredient(id: number): Promise<IngredientRow | null> {
  const rows = await listIngredients({ includeInactive: true });
  return rows.find((r) => r.id === id) ?? null;
}

export interface PriceHistoryRow {
  effectiveDate: string;
  unitCost: number;
  source: string;
  notes: string | null;
}

export async function getPriceHistory(componentId: number): Promise<PriceHistoryRow[]> {
  const rows = await db
    .select()
    .from(componentPriceHistory)
    .where(eq(componentPriceHistory.componentId, componentId))
    .orderBy(desc(componentPriceHistory.effectiveDate));
  return rows.map((r) => ({
    effectiveDate: r.effectiveDate,
    unitCost: Number(r.unitCost),
    source: r.source,
    notes: r.notes,
  }));
}

/** Ingredients with no sourced price, the standing gap list. */
export async function listUnsourced(): Promise<IngredientRow[]> {
  const rows = await listIngredients();
  return rows.filter((r) => r.provenance === "none" || r.provenance === "placeholder");
}
