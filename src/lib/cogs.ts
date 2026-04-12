/**
 * COGS derivation — computes cost of goods for every SKU from the ingredient
 * master and recipe ratios, and reconciles against the hardcoded values in
 * pricing-data.ts.
 *
 * This is the bridge between Phase 1 (ingredients) and Phase 2 (channel P&L).
 */

import { RECIPES } from "@/data/recipes";
import { PRICING_PRODUCTS, PricingProduct } from "@/lib/pricing-data";
import {
  INGREDIENTS,
  RECIPE_INGREDIENT_MAP,
  IngredientMaster,
  getIngredient,
  pricePerMl,
  computeLiquidCogs,
} from "@/lib/ingredients";
import { Recipe } from "@/types";

/**
 * Pricing products use slightly different names from recipes.
 * This map handles the exceptions; everything else matches exactly.
 */
const PRODUCT_TO_RECIPE_NAME: Record<string, string> = {
  Vesper: "Vesper Martini",
};

/** Find the matching MFC recipe for a pricing product. */
export function getRecipeForProduct(product: PricingProduct): Recipe | undefined {
  const recipeName = PRODUCT_TO_RECIPE_NAME[product.name] ?? product.name;
  return RECIPES.find(
    (r) =>
      r.name === recipeName &&
      r.clients.includes("Myatt's Fields"),
  );
}

// ─── Per-ingredient cost breakdown ─────────────────────────────────────────

export interface IngredientCostLine {
  recipeIngredientName: string;
  ingredientId: string | null; // null = unmapped
  ingredient: IngredientMaster | null;
  parts: number;
  sharePct: number; // 0-100
  mlInBottle: number;
  cost: number; // £
  mapped: boolean;
}

export interface SkuCostBreakdown {
  productId: string;
  productName: string;
  size: string;
  bottleSizeMl: number;
  recipeName: string | null;
  hardcodedCogs: number;
  derivedLiquidCogs: number;
  delta: number; // derived - hardcoded
  deltaPct: number; // as percentage of hardcoded
  unmappedPct: number; // % of parts that are unmapped
  unmappedIngredients: string[];
  lines: IngredientCostLine[];
  status: "match" | "close" | "gap" | "no-recipe";
}

function bottleSizeMlFromString(size: string): number {
  if (size === "set") return 250; // Martini Flight — 6×250ml, price per unit
  const match = size.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 500;
}

export function computeSkuBreakdown(product: PricingProduct): SkuCostBreakdown {
  const recipe = getRecipeForProduct(product);
  const bottleSizeMl = bottleSizeMlFromString(product.size);

  if (!recipe) {
    return {
      productId: product.id,
      productName: product.name,
      size: product.size,
      bottleSizeMl,
      recipeName: null,
      hardcodedCogs: product.cogs,
      derivedLiquidCogs: 0,
      delta: -product.cogs,
      deltaPct: -100,
      unmappedPct: 100,
      unmappedIngredients: [],
      lines: [],
      status: "no-recipe",
    };
  }

  const totalParts = recipe.ingredients.reduce((s, i) => s + (i.parts ?? 0), 0);
  if (totalParts === 0) {
    return {
      productId: product.id,
      productName: product.name,
      size: product.size,
      bottleSizeMl,
      recipeName: recipe.name,
      hardcodedCogs: product.cogs,
      derivedLiquidCogs: 0,
      delta: -product.cogs,
      deltaPct: -100,
      unmappedPct: 100,
      unmappedIngredients: [],
      lines: [],
      status: "no-recipe",
    };
  }

  let derivedTotal = 0;
  let unmappedParts = 0;
  const unmappedNames: string[] = [];
  const lines: IngredientCostLine[] = [];

  for (const ri of recipe.ingredients) {
    const parts = ri.parts ?? 0;
    if (parts === 0) continue;

    const sharePct = (parts / totalParts) * 100;
    const mlInBottle = (parts / totalParts) * bottleSizeMl;

    const mappedId = RECIPE_INGREDIENT_MAP[ri.ingredientName] ?? undefined;
    const ing = mappedId ? getIngredient(mappedId) : undefined;
    const mapped = !!ing;
    const cost = ing ? mlInBottle * pricePerMl(ing) : 0;

    if (!mapped) {
      unmappedParts += parts;
      unmappedNames.push(ri.ingredientName);
    } else {
      derivedTotal += cost;
    }

    lines.push({
      recipeIngredientName: ri.ingredientName,
      ingredientId: mappedId ?? null,
      ingredient: ing ?? null,
      parts,
      sharePct,
      mlInBottle,
      cost,
      mapped,
    });
  }

  const unmappedPct = (unmappedParts / totalParts) * 100;
  const delta = derivedTotal - product.cogs;
  const deltaPct = product.cogs > 0 ? (delta / product.cogs) * 100 : 0;

  // Status: if unmapped ingredients are a big share, mark as gap regardless
  let status: SkuCostBreakdown["status"];
  if (unmappedPct > 15) {
    status = "gap";
  } else if (Math.abs(deltaPct) < 3) {
    status = "match";
  } else if (Math.abs(deltaPct) < 10) {
    status = "close";
  } else {
    status = "gap";
  }

  return {
    productId: product.id,
    productName: product.name,
    size: product.size,
    bottleSizeMl,
    recipeName: recipe.name,
    hardcodedCogs: product.cogs,
    derivedLiquidCogs: Math.round(derivedTotal * 100) / 100,
    delta: Math.round(delta * 100) / 100,
    deltaPct: Math.round(deltaPct * 10) / 10,
    unmappedPct: Math.round(unmappedPct * 10) / 10,
    unmappedIngredients: unmappedNames,
    lines,
    status,
  };
}

/** Compute all SKU breakdowns, sorted by product name then size. */
export function computeAllSkuBreakdowns(): SkuCostBreakdown[] {
  return PRICING_PRODUCTS.map(computeSkuBreakdown).sort((a, b) => {
    const nameCompare = a.productName.localeCompare(b.productName);
    if (nameCompare !== 0) return nameCompare;
    return b.bottleSizeMl - a.bottleSizeMl; // 500 before 250
  });
}

// ─── Summary stats ──────────────────────────────────────────────────────────

export interface CogsSummary {
  totalSkus: number;
  matched: number;
  close: number;
  gap: number;
  noRecipe: number;
  totalHardcodedCogs: number;
  totalDerivedCogs: number;
  totalDelta: number;
  unmappedIngredients: string[]; // deduplicated
}

export function computeSummary(breakdowns: SkuCostBreakdown[]): CogsSummary {
  const unmappedSet = new Set<string>();
  let matched = 0,
    close = 0,
    gap = 0,
    noRecipe = 0;
  let totalHC = 0,
    totalDerived = 0;

  for (const b of breakdowns) {
    totalHC += b.hardcodedCogs;
    totalDerived += b.derivedLiquidCogs;
    b.unmappedIngredients.forEach((n) => unmappedSet.add(n));
    if (b.status === "match") matched++;
    else if (b.status === "close") close++;
    else if (b.status === "gap") gap++;
    else noRecipe++;
  }

  return {
    totalSkus: breakdowns.length,
    matched,
    close,
    gap,
    noRecipe,
    totalHardcodedCogs: Math.round(totalHC * 100) / 100,
    totalDerivedCogs: Math.round(totalDerived * 100) / 100,
    totalDelta: Math.round((totalDerived - totalHC) * 100) / 100,
    unmappedIngredients: Array.from(unmappedSet).sort(),
  };
}
