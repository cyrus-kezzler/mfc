/**
 * COGS derivation — computes cost of goods for every SKU from the ingredient
 * master, recipe ratios, and packaging costs, then reconciles against the
 * hardcoded values in pricing-data.ts.
 *
 * This is the bridge between Phase 1 (ingredients) and Phase 2 (channel P&L).
 */

import { RECIPES } from "@/data/recipes";
import { PRICING_PRODUCTS, PricingProduct } from "@/lib/pricing-data";
import {
  RECIPE_INGREDIENT_MAP,
  IngredientMaster,
  getIngredient,
  pricePerMl,
} from "@/lib/ingredients";
import {
  getPackagingCost,
  partnerGroupForProduct,
  PackagingCostBreakdown,
} from "@/lib/packaging";
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
  // Derived COGS = liquid + labour (what it costs to MAKE the bottle)
  derivedLiquidCogs: number;
  labour: number;
  derivedCogs: number; // liquid + labour
  // Packaging is tracked but NOT in COGS — belongs in Channel P&L
  packaging: PackagingCostBreakdown;
  // Comparison: derived COGS vs hardcoded
  delta: number;
  deltaPct: number;
  unmappedPct: number;
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
  const partnerGroup = partnerGroupForProduct(product.name);
  const pkg = getPackagingCost(product.name, product.size, partnerGroup);

  if (!recipe) {
    return {
      productId: product.id,
      productName: product.name,
      size: product.size,
      bottleSizeMl,
      recipeName: null,
      hardcodedCogs: product.cogs,
      derivedLiquidCogs: 0,
      labour: pkg.labourTotal,
      derivedCogs: pkg.labourTotal,
      packaging: pkg,
      delta: pkg.labourTotal - product.cogs,
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
      labour: pkg.labourTotal,
      derivedCogs: pkg.labourTotal,
      packaging: pkg,
      delta: pkg.labourTotal - product.cogs,
      deltaPct: -100,
      unmappedPct: 100,
      unmappedIngredients: [],
      lines: [],
      status: "no-recipe",
    };
  }

  let derivedLiquid = 0;
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
      derivedLiquid += cost;
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
  const labour = pkg.labourTotal;
  const derivedCogs = Math.round((derivedLiquid + labour) * 100) / 100;
  const delta = Math.round((derivedCogs - product.cogs) * 100) / 100;
  const deltaPct = product.cogs > 0 ? Math.round((delta / product.cogs) * 1000) / 10 : 0;

  // Status thresholds
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
    derivedLiquidCogs: Math.round(derivedLiquid * 100) / 100,
    labour,
    derivedCogs,
    packaging: pkg,
    delta,
    deltaPct,
    unmappedPct,
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

/**
 * Return all pricing products with COGS derived from the ingredient model
 * (liquid + labour). Falls back to the hardcoded cogs field only for
 * products without a matching recipe (e.g. Martini Flight).
 */
export function getPricingProductsWithLiveCogs(): PricingProduct[] {
  return PRICING_PRODUCTS.map((p) => {
    const recipe = getRecipeForProduct(p);
    if (!recipe) return p;
    const breakdown = computeSkuBreakdown(p);
    return { ...p, cogs: breakdown.derivedCogs };
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
  totalDerivedLiquidCogs: number;
  totalLabour: number;
  totalDerivedCogs: number; // liquid + labour
  totalDelta: number;
  unmappedIngredients: string[];
}

export function computeSummary(breakdowns: SkuCostBreakdown[]): CogsSummary {
  const unmappedSet = new Set<string>();
  let matched = 0,
    close = 0,
    gap = 0,
    noRecipe = 0;
  let totalHC = 0,
    totalLiquid = 0,
    totalLabour = 0;

  for (const b of breakdowns) {
    totalHC += b.hardcodedCogs;
    totalLiquid += b.derivedLiquidCogs;
    totalLabour += b.labour;
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
    totalDerivedLiquidCogs: Math.round(totalLiquid * 100) / 100,
    totalLabour: Math.round(totalLabour * 100) / 100,
    totalDerivedCogs: Math.round((totalLiquid + totalLabour) * 100) / 100,
    totalDelta: Math.round((totalLiquid + totalLabour - totalHC) * 100) / 100,
    unmappedIngredients: Array.from(unmappedSet).sort(),
  };
}
