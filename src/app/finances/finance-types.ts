/**
 * Plain serialisable shapes shared by the Finances server pages and their
 * client components. No imports: these must be safe on both sides of the
 * server/client boundary.
 *
 * The one distinction that matters everywhere here: `wholesale` and `rrp` are
 * AGREED prices, read from sku_prices, and are null when nothing has been
 * agreed. `rulePrice` is what the markup formula says today. They are never
 * interchangeable and no view may substitute one for the other.
 */

export type SkuRow = {
  skuId: number;
  code: string;
  name: string;
  clientName: string | null;
  size: string;
  sizeMl: number;
  gtin: string | null;

  /** Agreed wholesale price, ex VAT. Null when none has been agreed. */
  wholesale: number | null;
  wholesaleEffectiveFrom: string | null;
  /** Agreed RRP, inc VAT. Null when none has been agreed. */
  rrp: number | null;
  /** Per-bottle shipping assumed when the wholesale price was agreed. */
  shipping: number;

  /** Full COGS: liquid + primary packaging + wastage. */
  cogs: number;
  /** COGS x markup + shipping at the stored config. Computed, never stored. */
  rulePrice: number;

  /** Cost lines with no invoice or manual entry behind them. */
  unsourced: string[];
  /** Cost lines standing on a declared placeholder. */
  placeholders: string[];
  /** Structural problems, e.g. no current recipe. */
  problems: string[];
};

export type PricingConfigView = {
  markup: number;
  retailerMargin: number;
  vat: number;
  listEffectiveFrom: string | null;
};
