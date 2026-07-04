/**
 * UOM display helpers — the single place the two-unit model (spec §5.2, decision
 * §13 #7) turns into human-readable strings.
 *
 * Every component is *bought* in a purchase_uom (bottle, case, roll, bag, …) and
 * *consumed* in a consumption uom (ml, g, each, m), with pack_size as the bridge
 * (pack_size = how many consumption-uom units are in one purchase unit). These
 * helpers render both sides so operators never do the maths in their head, and
 * so Slice 2's Inbounds and stock surfaces can speak both languages from day one.
 *
 * Pure functions — safe in both server and client components. No React here.
 */

export type ConsumptionUom = "ml" | "g" | "each" | "m";
export type PurchaseUom = "bottle" | "case" | "pouch" | "roll" | "bag" | "each";

/** Thousands-separated integer/decimal for display, e.g. 8400 → "8,400". */
export function formatQty(n: number, maxFractionDigits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-GB", { maximumFractionDigits: maxFractionDigits });
}

const PLURALS: Record<PurchaseUom, string> = {
  bottle: "bottles",
  case: "cases",
  pouch: "pouches",
  roll: "rolls",
  bag: "bags",
  each: "each", // uncountable — "12 each", not "12 eaches"
};

/** "bottle" / "bottles" by count. `each` never inflects. */
export function pluralizePurchaseUom(uom: PurchaseUom, count: number): string {
  return count === 1 ? uom : PLURALS[uom];
}

/**
 * The purchase label shown next to a component. Uses the operator's override if
 * present, otherwise derives from purchase_uom + pack_size + consumption uom:
 *   bottle + 700 + ml  → "bottle (700ml)"
 *   roll   + 250 + each → "roll (250 each)"
 *   each   + 1   + each → "each"
 */
export function derivePurchaseLabel(opts: {
  purchaseUom: PurchaseUom | null;
  purchaseLabel?: string | null;
  packSize: number | null;
  consumptionUom: ConsumptionUom;
}): string {
  const { purchaseUom, purchaseLabel, packSize, consumptionUom } = opts;
  if (purchaseLabel && purchaseLabel.trim()) return purchaseLabel.trim();
  if (!purchaseUom) return "—";

  const size = packSize ?? 1;
  // A one-to-one each/each component (a bottle, a box) reads as just "each".
  if (purchaseUom === "each" && size === 1) return "each";

  const inner =
    consumptionUom === "each" || consumptionUom === "m"
      ? `${formatQty(size)} ${consumptionUom === "each" ? "each" : "m"}`
      : `${formatQty(size)}${consumptionUom}`;
  return `${purchaseUom} (${inner})`;
}

/** £ per consumption uom, derived from £ per purchase unit ÷ pack size. */
export function costPerConsumptionUom(
  packCost: number | null,
  packSize: number | null,
): number | null {
  if (packCost == null || packSize == null || packSize <= 0) return null;
  return packCost / packSize;
}

/** "≈ £0.0225/ml" — the muted derived per-consumption-uom cost. */
export function formatDerivedUnitCost(
  packCost: number | null,
  packSize: number | null,
  consumptionUom: ConsumptionUom,
): string {
  const c = costPerConsumptionUom(packCost, packSize);
  if (c == null) return "—";
  return `≈ £${c.toFixed(4)}/${consumptionUom}`;
}

/**
 * Dual-UOM stock display, the spec's headline convention (§5.4):
 * "8,400 ml ≈ 12 bottles". Given a quantity in consumption uom plus the pack
 * size + purchase uom, renders both. When pack size is unknown or 1:1, only the
 * consumption side is shown. Stubbed here for Slice 1.1; Slice 2 feeds it real
 * stock-on-hand once Inbounds lands.
 */
export function formatStockDual(opts: {
  consumptionQty: number;
  consumptionUom: ConsumptionUom;
  packSize: number | null;
  purchaseUom: PurchaseUom | null;
}): string {
  const { consumptionQty, consumptionUom, packSize, purchaseUom } = opts;
  const left = `${formatQty(consumptionQty)} ${consumptionUom}`;
  if (!purchaseUom || packSize == null || packSize <= 1) return left;
  const purchaseQty = consumptionQty / packSize;
  return `${left} ≈ ${formatQty(purchaseQty)} ${pluralizePurchaseUom(purchaseUom, purchaseQty)}`;
}
