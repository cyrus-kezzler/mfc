/**
 * Packaging cost model.
 *
 * Per-bottle dry goods: glass bottle + stopper, label, hygiene label.
 * Labels default by partner group but can be overridden per drink.
 * Shipping packaging and fulfilment are separate (used in Channel P&L,
 * not in base COGS).
 */

import packagingData from "@/data/packaging.json";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BottleSpec {
  id: string;
  name: string;
  sizeMl: number;
  cost: number;
  costSetAt: string;
  notes?: string;
}

export interface LabelDefault {
  id: string;
  group: string; // "Myatt's Fields" | "Fortnum & Mason" | "Cripps & Co."
  cost: number;
  costSetAt: string;
}

export interface LabelOverride {
  drinkName: string;
  group: string;
  cost: number;
  costSetAt: string;
  note?: string; // e.g. "Still using 2020 stock — zero value"
}

export interface HygieneLabel {
  id: string;
  group: string;
  cost: number;
  costSetAt: string;
}

// ─── Data ───────────────────────────────────────────────────────────────────

export const BOTTLES: BottleSpec[] = packagingData.bottles as BottleSpec[];
export const LABEL_DEFAULTS: LabelDefault[] = packagingData.labelDefaults as LabelDefault[];
export const LABEL_OVERRIDES: LabelOverride[] = packagingData.labelOverrides as LabelOverride[];
export const HYGIENE_LABELS: HygieneLabel[] = packagingData.hygieneLabels as HygieneLabel[];

// ─── Lookups ────────────────────────────────────────────────────────────────

/**
 * Determine which partner group a product belongs to, based on the product
 * name or the recipe's client. For the MFC range (what's in pricing-data.ts)
 * everything is "Myatt's Fields" unless it's an F&M or Cripps product.
 */
export function partnerGroupForProduct(productName: string): string {
  const lower = productName.toLowerCase();
  if (lower.includes("f&m") || lower.includes("fortnum")) return "Fortnum & Mason";
  if (lower.includes("cripps")) return "Cripps & Co.";
  return "Myatt's Fields";
}

/**
 * Find the bottle spec for a given format size string (e.g. "500ml", "250ml",
 * "set"). Falls back to closest match by ml.
 */
export function getBottle(sizeStr: string, partnerGroup?: string): BottleSpec | undefined {
  // Special partner bottles
  if (partnerGroup === "Fortnum & Mason") {
    return BOTTLES.find((b) => b.id === "350ml-fm");
  }
  if (partnerGroup === "Cripps & Co.") {
    return BOTTLES.find((b) => b.id === "700ml-cripps");
  }

  // Parse ml from string
  const match = sizeStr.match(/(\d+)/);
  if (!match) return undefined;
  const ml = parseInt(match[1], 10);

  // Exact match on standard bottles
  return BOTTLES.find((b) => b.sizeMl === ml && !b.id.includes("-"));
}

/**
 * Get the label cost for a specific drink in a partner group.
 * Checks overrides first, falls back to group default.
 */
export function getLabelCost(drinkName: string, partnerGroup: string): number {
  // Check per-drink override
  const override = LABEL_OVERRIDES.find(
    (o) => o.drinkName === drinkName && o.group === partnerGroup,
  );
  if (override) return override.cost;

  // Group default
  const groupDefault = LABEL_DEFAULTS.find((d) => d.group === partnerGroup);
  return groupDefault?.cost ?? 0;
}

/** Get hygiene label cost for a partner group. */
export function getHygieneLabelCost(partnerGroup: string): number {
  const hl = HYGIENE_LABELS.find((h) => h.group === partnerGroup);
  return hl?.cost ?? 0;
}

// ─── Total per-bottle packaging cost ────────────────────────────────────────

export interface PackagingCostBreakdown {
  bottle: number;
  label: number;
  hygieneLabel: number;
  total: number;
  bottleSpec: BottleSpec | null;
  labelSource: "override" | "default" | "none";
}

/**
 * Total per-bottle packaging cost (glass + label + hygiene label).
 * Does NOT include shipping packaging or fulfilment — those vary by
 * channel and belong in the Channel P&L.
 */
export function getPackagingCost(
  drinkName: string,
  sizeStr: string,
  partnerGroup: string = "Myatt's Fields",
): PackagingCostBreakdown {
  const bottleSpec = getBottle(sizeStr, partnerGroup) ?? null;
  const bottleCost = bottleSpec?.cost ?? 0;

  const labelOverride = LABEL_OVERRIDES.find(
    (o) => o.drinkName === drinkName && o.group === partnerGroup,
  );
  const labelCost = labelOverride
    ? labelOverride.cost
    : (LABEL_DEFAULTS.find((d) => d.group === partnerGroup)?.cost ?? 0);

  const hygieneCost = getHygieneLabelCost(partnerGroup);

  return {
    bottle: bottleCost,
    label: labelCost,
    hygieneLabel: hygieneCost,
    total: bottleCost + labelCost + hygieneCost,
    bottleSpec,
    labelSource: labelOverride ? "override" : labelCost > 0 ? "default" : "none",
  };
}
