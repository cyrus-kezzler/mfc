/**
 * Per-drink P&L — channel costs, cost scenarios, and the fulfilment math behind
 * the /finances/pnl page. Pure data + helpers, usable on server or client.
 *
 * COGS itself is derived live from the database (see lib/erp/cogs.ts). This
 * file layers the *channel* costs on top — fulfilment, freight, payment fees —
 * and the scenario deltas that surface what sunk inventory currently hides.
 *
 * Defaults marked "placeholder" are Cyrus-to-confirm; they live here so the
 * numbers refine in one place.
 */

export type Channel = "shopify" | "wholesale" | "amazon"; // amazon shown but not modelled
export type CostScenario = "today" | "true" | "forward";

export const COST_SCENARIOS: Record<CostScenario, { label: string; description: string }> = {
  today: {
    label: "Today's cost",
    description:
      "Current COGS including any written-off legacy inventory (e.g. zero-cost 50ml glass).",
  },
  true: {
    label: "True variable cost",
    description:
      "Every input priced at today's replacement cost. Surfaces what is hidden by sunk inventory.",
  },
  forward: {
    label: "Forward (rebrand)",
    description:
      "Post-rebrand product architecture. Placeholder until rebrand decisions land.",
  },
};

// Per-product scenario delta on top of derived COGS. Default zero. Cyrus populates
// as rebrand and replacement-cost decisions land (notably the 50ml glass).
export interface ProductScenarioAdj {
  productId: string;
  trueCostDelta: number;
  forwardCostDelta: number;
  notes?: string;
}
export const PRODUCT_SCENARIO_ADJUSTMENTS: ProductScenarioAdj[] = []; // populated as decisions land

// Shopify shipping (customer-paid = MFC cost, zero margin)
export const SHOPIFY_SHIPPING_TIERS = [
  { minBottles: 1, maxBottles: 1, size: "500ml" as const, cost: 2.95 },
  { minBottles: 2, maxBottles: 4, size: "500ml" as const, cost: 4.52 },
  { minBottles: 1, maxBottles: 4, size: "250ml" as const, cost: 2.95 },
  { minBottles: 5, maxBottles: 8, size: "any" as const, cost: 6.0 },
  { minBottles: 9, maxBottles: 15, size: "any" as const, cost: 9.69 },
];

// Boxes
export const BOX_OPTIONS = {
  smallSixBottle500: { label: "6 × 500ml box (current, dated)", cost: 1.9 },
  smallSixBottle700: { label: "6 × 700ml box (new, Cripps size)", cost: 0.93 },
};
export type BoxOptionKey = keyof typeof BOX_OPTIONS;

// Labour
export const PICK_AND_PACK = {
  labourRatePerHour: 20, // Clemency, default £20/hr — Cyrus to confirm
  singleBottleMinutes: 8,
  multiBottleMinutes: 12,
};

// Payment processing (Shopify Payments UK, blended) — placeholder
export const PAYMENT_PROCESSING = { percent: 0.02, fixedPerOrder: 0.25 };

// Wholesale freight allocation
export const WHOLESALE_FREIGHT = {
  palletCost: 60,
  casesPerPalletHigh: 90,
  casesPerPalletLow: 12,
  bottlesPerCase: 6,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function sizeBand(size: string): "250ml" | "500ml" | "any" {
  if (size.includes("250")) return "250ml";
  if (size.includes("500")) return "500ml";
  return "any";
}

/**
 * Carrier cost for a Shopify order of `bottles` of a given bottle size. The
 * customer pays this directly, so it nets to zero on contribution — it matters
 * only for the free-shipping hurdle. Falls back to the nearest higher tier.
 */
export function shopifyShippingCost(bottles: number, size: string): number {
  const band = sizeBand(size);
  const candidates = SHOPIFY_SHIPPING_TIERS.filter(
    (t) => bottles >= t.minBottles && bottles <= t.maxBottles && (t.size === band || t.size === "any"),
  );
  if (candidates.length) return Math.min(...candidates.map((t) => t.cost));
  // Above the table — extrapolate from the top tier.
  const top = SHOPIFY_SHIPPING_TIERS[SHOPIFY_SHIPPING_TIERS.length - 1];
  return top.cost;
}

/** Labour to pick and pack a whole order of `bottles` (per order, not per bottle). */
export function pickAndPackCost(bottles: number): number {
  const minutes = bottles <= 1 ? PICK_AND_PACK.singleBottleMinutes : PICK_AND_PACK.multiBottleMinutes;
  return round2((minutes / 60) * PICK_AND_PACK.labourRatePerHour);
}

/** Shipping-box cost for an order: one box per six bottles, of the chosen format. */
export function boxCost(bottles: number, box: BoxOptionKey = "smallSixBottle700"): number {
  const boxes = Math.max(1, Math.ceil(bottles / 6));
  return round2(boxes * BOX_OPTIONS[box].cost);
}

/** Card-processing fee on an order value (percent + fixed per order). */
export function paymentProcessingCost(orderValue: number): number {
  return round2(orderValue * PAYMENT_PROCESSING.percent + PAYMENT_PROCESSING.fixedPerOrder);
}

/** Per-bottle freight when shipping wholesale by the pallet. */
export function wholesaleFreightPerBottle(densityHigh: boolean): number {
  const cases = densityHigh ? WHOLESALE_FREIGHT.casesPerPalletHigh : WHOLESALE_FREIGHT.casesPerPalletLow;
  return round2(WHOLESALE_FREIGHT.palletCost / (cases * WHOLESALE_FREIGHT.bottlesPerCase));
}

/** Apply the active scenario's per-product delta to a base (today) COGS. */
export function scenarioCogs(baseCogs: number, productId: string, scenario: CostScenario): number {
  if (scenario === "today") return baseCogs;
  const adj = PRODUCT_SCENARIO_ADJUSTMENTS.find((a) => a.productId === productId);
  if (!adj) return baseCogs;
  const delta = scenario === "true" ? adj.trueCostDelta : adj.forwardCostDelta;
  return round2(baseCogs + delta);
}

// ─── Shopify per-bottle economics ─────────────────────────────────────────────

export interface ShopifyLine {
  rrpIncVat: number;
  vatAmount: number;
  revenueExVat: number;
  cogs: number;
  fulfilmentPerBottle: number; // box + pick&pack + payment, allocated across the basket
  boxPerBottle: number;
  pickPackPerBottle: number;
  paymentPerBottle: number;
  contribution: number;
  contributionPct: number;
}

/**
 * Contribution for one bottle of a drink sold inside a Shopify basket of
 * `bottles`. Carrier shipping is excluded (customer-paid, zero margin); inbound
 * shipping stays inside COGS this iteration, per the strategy note.
 */
export function shopifyLine(
  rrpIncVat: number,
  cogs: number,
  vat: number,
  bottles: number,
  box: BoxOptionKey = "smallSixBottle700",
): ShopifyLine {
  const n = Math.max(1, bottles);
  const revenueExVat = round2(rrpIncVat / vat);
  const vatAmount = round2(rrpIncVat - revenueExVat);
  const boxPerBottle = round2(boxCost(n, box) / n);
  const pickPackPerBottle = round2(pickAndPackCost(n) / n);
  const paymentPerBottle = round2(paymentProcessingCost(n * rrpIncVat) / n);
  const fulfilmentPerBottle = round2(boxPerBottle + pickPackPerBottle + paymentPerBottle);
  const contribution = round2(revenueExVat - cogs - fulfilmentPerBottle);
  const contributionPct = revenueExVat > 0 ? round2((contribution / revenueExVat) * 100) : 0;
  return {
    rrpIncVat,
    vatAmount,
    revenueExVat,
    cogs,
    fulfilmentPerBottle,
    boxPerBottle,
    pickPackPerBottle,
    paymentPerBottle,
    contribution,
    contributionPct,
  };
}

// ─── Wholesale per-bottle economics ───────────────────────────────────────────

export interface WholesaleLine {
  wholesale: number;
  cogs: number;
  freightPerBottle: number;
  contribution: number;
  contributionPct: number;
}

export function wholesaleLine(
  wholesale: number,
  cogs: number,
  densityHigh: boolean,
): WholesaleLine {
  const freightPerBottle = wholesaleFreightPerBottle(densityHigh);
  const contribution = round2(wholesale - cogs - freightPerBottle);
  const contributionPct = wholesale > 0 ? round2((contribution / wholesale) * 100) : 0;
  return { wholesale, cogs, freightPerBottle, contribution, contributionPct };
}
