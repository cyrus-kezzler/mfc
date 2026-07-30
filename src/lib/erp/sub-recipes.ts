/**
 * Sub-recipe scaling and costing.
 *
 * Answers two questions Back Bar could not previously answer:
 *   "I need three litres of Myatt's Sours, what do I weigh out?"
 *   "What does a litre of it actually cost?"
 *
 * Both come off component_recipes, so the recipe lives in one place and the
 * arithmetic is not repeated in a markdown file that nothing checks.
 *
 * Nested sub-recipes are handled: Sours consumes the phosphoric 1.25% stock,
 * which is itself made, so a batch plan carries the stock as a step to do
 * first, scaled to exactly what the batch needs.
 *
 * Costing refuses rather than guesses. If any leaf input has no price, the
 * derived cost is null and the unpriced inputs are named. A hand-typed unit
 * cost on the parent is reported separately as `assertedUnitCost` so the two
 * can never be confused.
 */

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { components, componentRecipes, type Component } from "@/db/schema";

export interface BatchLine {
  componentId: number;
  name: string;
  uom: string;
  /** Quantity in one base batch of the parent, in this component's UOM. */
  perBatch: number;
  /** Quantity needed for the requested batch size. */
  quantity: number;
  /** £ per UOM, or null if this input has no sourced price. */
  unitCost: number | null;
  cost: number | null;
  isSubRecipe: boolean;
}

export interface BatchPlan {
  componentId: number;
  name: string;
  uom: string;
  /** What was asked for, in the parent's UOM. */
  target: number;
  batchYield: number;
  /** target / batchYield. */
  scale: number;
  method: string | null;
  lines: BatchLine[];
  /** Nested sub-recipes to make first, already scaled to this batch's needs. */
  steps: BatchPlan[];
  /** £ per UOM derived from constituents, or null if anything is unpriced. */
  derivedUnitCost: number | null;
  /** Total £ for the requested quantity, or null. */
  derivedCost: number | null;
  /** The hand-typed figure currently on the component, for comparison only. */
  assertedUnitCost: number;
  /** Named inputs blocking a derived cost. */
  unpriced: string[];
}

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function round(x: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

/** True when the component has a price anybody stood behind. */
function hasSourcedPrice(c: Component): boolean {
  return c.unitCostSetAt !== null && c.unitCostSetAt !== undefined && n(c.unitCost) > 0;
}

/**
 * Cost per UOM for a component, deriving through sub-recipes.
 * Returns null when any leaf is unpriced, and pushes its name onto `unpriced`.
 */
async function unitCostOf(
  c: Component,
  unpriced: string[],
  seen: Set<number>,
): Promise<number | null> {
  if (c.type !== "sub_recipe") {
    if (hasSourcedPrice(c)) return n(c.unitCost);
    // Water is legitimately free and legitimately sourced at zero.
    if (n(c.unitCost) === 0 && /^water$/i.test(c.name)) return 0;
    unpriced.push(c.name);
    return null;
  }

  if (seen.has(c.id)) {
    unpriced.push(`${c.name} (circular sub-recipe reference)`);
    return null;
  }
  seen.add(c.id);

  const yieldQty = n(c.batchYield);
  if (yieldQty <= 0) {
    unpriced.push(`${c.name} (no batch yield recorded)`);
    return null;
  }

  const lines = await db
    .select()
    .from(componentRecipes)
    .where(eq(componentRecipes.parentComponentId, c.id));
  if (lines.length === 0) {
    unpriced.push(`${c.name} (sub-recipe with no constituents)`);
    return null;
  }

  let total = 0;
  let blocked = false;
  for (const l of lines) {
    const [child] = await db.select().from(components).where(eq(components.id, l.childComponentId));
    if (!child) {
      unpriced.push(`missing component ${l.childComponentId}`);
      blocked = true;
      continue;
    }
    const cu = await unitCostOf(child, unpriced, seen);
    if (cu === null) {
      blocked = true;
      continue;
    }
    total += cu * n(l.quantity);
  }

  return blocked ? null : total / yieldQty;
}

/**
 * Build a scaled batch plan.
 *
 * @param componentId a component of type sub_recipe
 * @param target      how much is wanted, in the component's own UOM
 */
export async function planBatch(componentId: number, target: number): Promise<BatchPlan> {
  const [parent] = await db.select().from(components).where(eq(components.id, componentId));
  if (!parent) throw new Error(`No component ${componentId}`);
  if (parent.type !== "sub_recipe") {
    throw new Error(`${parent.name} is a ${parent.type}, not a sub_recipe, so it is bought rather than made`);
  }

  const batchYield = n(parent.batchYield);
  if (batchYield <= 0) throw new Error(`${parent.name} has no batch yield recorded`);

  const scale = target / batchYield;

  const raw = await db
    .select()
    .from(componentRecipes)
    .where(eq(componentRecipes.parentComponentId, componentId));
  raw.sort((a, b) => a.displayOrder - b.displayOrder);

  const unpriced: string[] = [];
  const lines: BatchLine[] = [];
  const steps: BatchPlan[] = [];

  for (const l of raw) {
    const [child] = await db.select().from(components).where(eq(components.id, l.childComponentId));
    if (!child) continue;

    const perBatch = n(l.quantity);
    const quantity = perBatch * scale;
    const unitCost = await unitCostOf(child, unpriced, new Set([componentId]));

    lines.push({
      componentId: child.id,
      name: child.name,
      uom: child.uom,
      perBatch,
      quantity: round(quantity, 3),
      unitCost,
      cost: unitCost === null ? null : round(unitCost * quantity),
      isSubRecipe: child.type === "sub_recipe",
    });

    if (child.type === "sub_recipe") {
      steps.push(await planBatch(child.id, quantity));
    }
  }

  const derivedUnitCost = await unitCostOf(parent, [], new Set());
  const uniqueUnpriced = [...new Set(unpriced)];

  return {
    componentId: parent.id,
    name: parent.name,
    uom: parent.uom,
    target,
    batchYield,
    scale: round(scale, 6),
    method: parent.batchMethod,
    lines,
    steps,
    derivedUnitCost: derivedUnitCost === null ? null : round(derivedUnitCost, 6),
    derivedCost: derivedUnitCost === null ? null : round(derivedUnitCost * target),
    assertedUnitCost: n(parent.unitCost),
    unpriced: uniqueUnpriced,
  };
}

/** Every sub-recipe component. */
export async function listSubRecipes(): Promise<Component[]> {
  return db.select().from(components).where(eq(components.type, "sub_recipe"));
}
