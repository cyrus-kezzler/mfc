/**
 * DB-backed COGS engine.
 *
 * Replaces the file-shadow engine in src/lib/cogs.ts, which read three
 * disagreeing JSON masters, computed liquid only, and could not see any
 * partner SKU at all.
 *
 * COGS rule (Cyrus, 30 Jul 2026): liquid, bottle, cap, label and box are ALL
 * in. Carriage is the only thing out, because the delivery method flexes
 * between hand delivery, pallet and Royal Mail. The include_in_cogs flag on
 * each bill-of-materials row is what decides, so the rule lives in the data
 * and not buried in this file.
 *
 * Every figure carries its provenance. A cost sourced from a supplier invoice
 * is 'inbound'; one typed in by hand is 'manual'. The rollup reports the split
 * so nobody can mistake a hand-loaded April figure for a verified one.
 */

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  components,
  componentPriceHistory,
  clients,
  drinks,
  recipes,
  recipeLines,
  skus,
  skuComponents,
  systemSettings,
  SETTING_KEYS,
} from "@/db/schema";

export type CostSource = "inbound" | "manual" | "placeholder" | "unsourced";

export interface CostLine {
  /** 'liquid' for recipe ingredients, otherwise the bill-of-materials role. */
  kind: string;
  componentId: number;
  name: string;
  /** £ per unit of measure (per ml for liquid, per each for dry goods). */
  unitCost: number;
  /** ml for liquid lines, count for dry goods. */
  quantity: number;
  cost: number;
  source: CostSource;
  setAt: string | null;
}

export interface SkuCost {
  skuId: number;
  skuCode: string;
  drinkName: string | null;
  clientName: string | null;
  sizeMl: number;

  liquid: CostLine[];
  liquidTotal: number;

  packaging: CostLine[];
  packagingTotal: number;

  /** Bill-of-materials rows deliberately excluded from COGS, e.g. carriage. */
  excluded: CostLine[];

  subtotal: number;
  wastagePct: number;
  wastage: number;
  total: number;

  /** Share of `subtotal` that traces to a supplier invoice, 0 to 100. */
  invoiceBackedPct: number;
  /** Lines whose cost is hand-typed or missing. Named, never silently absorbed. */
  unsourced: string[];
  /**
   * Lines standing on a placeholder. Separated from `unsourced` because a
   * placeholder is a known stand-in with someone actively working on it, not
   * an oversight, and the two deserve different attention.
   */
  placeholders: string[];
  /** Structural problems, e.g. no current recipe for this client. */
  problems: string[];
}

function n(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function round(x: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

/**
 * Cost per unit of measure for a component.
 *
 * Prefers pack_cost / pack_size for anything sold in bulk, because pack_cost is
 * numeric(12,2) while the derived unit_cost is numeric(12,4): for a £15.41
 * litre of vodka the cached unit cost rounds 0.01541 to 0.0154, which is a
 * fifth of a penny adrift on a 700ml bottle. For dry goods sold as each, the
 * pack columns round sub-penny costs the other way, so unit_cost wins there.
 */
function perUomCost(c: {
  packSize: string | null;
  packCost: string | null;
  unitCost: string | null;
}): number {
  const size = n(c.packSize);
  const cost = n(c.packCost);
  if (size > 1 && cost > 0) return cost / size;
  return n(c.unitCost);
}

async function wastagePct(): Promise<number> {
  const rows = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, SETTING_KEYS.WASTAGE_PCT));
  return rows.length > 0 ? n(rows[0].value) : 0;
}

/** Newest price-history source for each component id in the set. */
async function sourcesFor(ids: number[]): Promise<Map<number, { source: CostSource; setAt: string | null }>> {
  const out = new Map<number, { source: CostSource; setAt: string | null }>();
  if (ids.length === 0) return out;
  const rows = await db.select().from(componentPriceHistory);
  for (const r of rows) {
    if (!ids.includes(r.componentId)) continue;
    const prev = out.get(r.componentId);
    if (!prev || (prev.setAt ?? "") < r.effectiveDate) {
      out.set(r.componentId, { source: r.source as CostSource, setAt: r.effectiveDate });
    }
  }
  return out;
}

export async function computeSkuCost(skuId: number): Promise<SkuCost> {
  const problems: string[] = [];

  const [sku] = await db.select().from(skus).where(eq(skus.id, skuId));
  if (!sku) throw new Error(`No SKU with id ${skuId}`);

  const [drink] = sku.drinkId
    ? await db.select().from(drinks).where(eq(drinks.id, sku.drinkId))
    : [undefined];
  const [client] = sku.clientId
    ? await db.select().from(clients).where(eq(clients.id, sku.clientId))
    : [undefined];

  const allComponents = await db.select().from(components);
  const compById = new Map(allComponents.map((c) => [c.id, c]));

  // ── Liquid ───────────────────────────────────────────────────────────────
  const liquid: CostLine[] = [];
  let liquidTotal = 0;

  if (sku.drinkId && sku.clientId) {
    const recipeRows = await db
      .select()
      .from(recipes)
      .where(
        and(
          eq(recipes.drinkId, sku.drinkId),
          eq(recipes.clientId, sku.clientId),
          eq(recipes.isCurrent, true),
        ),
      );

    if (recipeRows.length === 0) {
      problems.push(
        `No current recipe for drink ${sku.drinkId} under client ${sku.clientId}, so liquid cost is zero`,
      );
    } else {
      const lines = await db
        .select()
        .from(recipeLines)
        .where(eq(recipeLines.recipeId, recipeRows[0].id));

      const pctTotal = lines.reduce((s, l) => s + n(l.percentage), 0);
      if (Math.abs(pctTotal - 100) > 0.01) {
        problems.push(`Recipe lines sum to ${round(pctTotal, 3)}%, not 100%`);
      }

      for (const l of lines) {
        const c = compById.get(l.componentId);
        if (!c) {
          problems.push(`Recipe line references missing component ${l.componentId}`);
          continue;
        }
        const ml = (n(l.percentage) / 100) * sku.sizeMl;
        const unit = perUomCost(c);
        const cost = ml * unit;
        liquidTotal += cost;
        liquid.push({
          kind: "liquid",
          componentId: c.id,
          name: c.name,
          unitCost: unit,
          quantity: ml,
          cost,
          source: "unsourced",
          setAt: c.unitCostSetAt ? c.unitCostSetAt.toISOString().slice(0, 10) : null,
        });
      }
    }
  } else {
    problems.push("SKU has no drink or no client, so no recipe can be resolved");
  }

  // ── Packaging ────────────────────────────────────────────────────────────
  const bom = await db.select().from(skuComponents).where(eq(skuComponents.skuId, skuId));
  const packaging: CostLine[] = [];
  const excluded: CostLine[] = [];
  let packagingTotal = 0;

  for (const b of bom) {
    const c = compById.get(b.componentId);
    if (!c) {
      problems.push(`Bill of materials references missing component ${b.componentId}`);
      continue;
    }
    const unit = perUomCost(c);
    const qty = n(b.quantity);
    const cost = unit * qty;
    const line: CostLine = {
      kind: b.role,
      componentId: c.id,
      name: c.name,
      unitCost: unit,
      quantity: qty,
      cost,
      source: "unsourced",
      setAt: c.unitCostSetAt ? c.unitCostSetAt.toISOString().slice(0, 10) : null,
    };
    if (b.includeInCogs) {
      packagingTotal += cost;
      packaging.push(line);
    } else {
      excluded.push(line);
    }
  }

  // ── Provenance ───────────────────────────────────────────────────────────
  const all = [...liquid, ...packaging, ...excluded];
  const srcMap = await sourcesFor(all.map((l) => l.componentId));
  for (const l of all) {
    const s = srcMap.get(l.componentId);
    if (s) {
      l.source = s.source;
      l.setAt = s.setAt;
    }
  }

  const inCogs = [...liquid, ...packaging];
  const subtotal = liquidTotal + packagingTotal;
  const invoiceBacked = inCogs
    .filter((l) => l.source === "inbound")
    .reduce((s, l) => s + l.cost, 0);
  const unsourced = inCogs
    .filter((l) => l.source !== "inbound" && l.source !== "placeholder")
    .map((l) => `${l.name} (${l.source}, £${round(l.cost, 2).toFixed(2)})`);
  const placeholders = inCogs
    .filter((l) => l.source === "placeholder")
    .map((l) => `${l.name} (£${round(l.cost, 2).toFixed(2)})`);

  const pct = await wastagePct();
  const wastage = subtotal * pct;

  return {
    skuId: sku.id,
    skuCode: sku.code,
    drinkName: drink?.name ?? null,
    clientName: client?.name ?? null,
    sizeMl: sku.sizeMl,
    liquid,
    liquidTotal: round(liquidTotal),
    packaging,
    packagingTotal: round(packagingTotal),
    excluded,
    subtotal: round(subtotal),
    wastagePct: pct,
    wastage: round(wastage),
    total: round(subtotal + wastage),
    invoiceBackedPct: subtotal > 0 ? round((invoiceBacked / subtotal) * 100, 1) : 0,
    unsourced,
    placeholders,
    problems,
  };
}

/** Every active SKU, costed. */
export async function computeAllSkuCosts(): Promise<SkuCost[]> {
  const rows = await db.select().from(skus).where(eq(skus.active, true));
  const out: SkuCost[] = [];
  for (const r of rows) out.push(await computeSkuCost(r.id));
  return out.sort(
    (a, b) =>
      (a.clientName ?? "").localeCompare(b.clientName ?? "") ||
      (a.drinkName ?? "").localeCompare(b.drinkName ?? "") ||
      b.sizeMl - a.sizeMl,
  );
}
