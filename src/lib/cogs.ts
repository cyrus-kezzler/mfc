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
  // Derived costs
  derivedLiquidCogs: number;
  packaging: PackagingCostBreakdown;
  derivedTotalCogs: number; // liquid + packaging
  // Comparison
  delta: number; // derivedTotal - hardcoded
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
      packaging: pkg,
      derivedTotalCogs: pkg.total,
      delta: pkg.total - product.cogs,
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
      packaging: pkg,
      derivedTotalCogs: pkg.total,
      delta: pkg.total - product.cogs,
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
  const derivedTotal = Math.round((derivedLiquid + pkg.total) * 100) / 100;
  const delta = Math.round((derivedTotal - product.cogs) * 100) / 100;
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
    packaging: pkg,
    derivedTotalCogs: derivedTotal,
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

// ─── Summary stats ──────────────────────────────────────────────────────────

export interface CogsSummary {
  totalSkus: number;
  matched: number;
  close: number;
  gap: number;
  noRecipe: number;
  totalHardcodedCogs: number;
  totalDerivedLiquidCogs: number;
  totalPackagingCogs: number;
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
    totalLiquid = 0,
    totalPkg = 0;

  for (const b of breakdowns) {
    totalHC += b.hardcodedCogs;
    totalLiquid += b.derivedLiquidCogs;
    totalPkg += b.packaging.total;
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
    totalPackagingCogs: Math.round(totalPkg * 100) / 100,
    totalDerivedCogs: Math.round((totalLiquid + totalPkg) * 100) / 100,
    totalDelta: Math.round((totalLiquid + totalPkg - totalHC) * 100) / 100,
    unmappedIngredients: Array.from(unmappedSet).sort(),
  };
}
