/**
 * Move agreed prices out of pricing-data.ts and into the database. Idempotent.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-sku-prices.ts          (dry run)
 *   npx tsx --env-file=.env.local scripts/erp/seed-sku-prices.ts --write
 *
 * What is being preserved is the price that has actually been quoted, not a
 * recalculation. Wholesale prices are reissued once a year after the duty rise
 * (Cyrus, 30 Jul 2026), so the figure a retailer is holding is a commitment,
 * and it must survive the COGS rebuild untouched.
 *
 * The formula price is deliberately NOT seeded. It is computed live from the
 * database so the gap between agreed and rule price stays visible, because that
 * gap is the margin erosion since the last review.
 */

import { eq, and, isNull } from "drizzle-orm";

import { db } from "../../src/db";
import { skus, skuPrices, systemSettings, SETTING_KEYS } from "../../src/db/schema";
import { PRICING_PRODUCTS, DEFAULT_CONFIG } from "../../src/lib/pricing-data";

const WRITE = process.argv.includes("--write");

/**
 * The file header says "Confirmed May 2026" while DEFAULT_CONFIG.lastUpdated
 * says 2026-04-05. They disagree. Taking the config date because it is the
 * machine-readable one, and flagging it rather than picking silently.
 */
const EFFECTIVE_FROM = DEFAULT_CONFIG.lastUpdated;

/**
 * No aliases. This map briefly contained espresso-martini-700 to
 * espresso-martini-700-cripps, which was wrong and would have been expensive:
 * the file's 700ml rows are all marked "Trade format (Macknade pilot). Delivery
 * included", so espresso-martini-700 is a £17.67 Macknade quote, not the £15.02
 * Cripps price. Writing it in would have silently restated the agreed price of
 * the single biggest product in the business.
 *
 * The Cripps and Fortnum's prices are not in this file at all and must come
 * from Cyrus.
 */
const CODE_ALIASES: Record<string, string> = {};

async function main() {
  console.log(WRITE ? "=== WRITE MODE ===\n" : "=== DRY RUN ===\n");
  console.log(`Effective from ${EFFECTIVE_FROM} (DEFAULT_CONFIG.lastUpdated).`);
  console.log(`NOTE: the file header says "Confirmed May 2026", which disagrees. Flagged, not resolved.\n`);

  const allSkus = await db.select().from(skus);
  const byCode = new Map(allSkus.map((s) => [s.code, s]));

  let wholesaleWritten = 0;
  let rrpWritten = 0;
  const unmatchedFile: string[] = [];

  for (const p of PRICING_PRODUCTS) {
    const code = CODE_ALIASES[p.id] ?? p.id;
    const sku = byCode.get(code);
    if (!sku) {
      unmatchedFile.push(`${p.id} (${p.name} ${p.size})`);
      continue;
    }

    const wholesale = p.wholesaleOverride ?? p.cogs * DEFAULT_CONFIG.markup + p.shipping;
    const wholesaleNote = p.wholesaleOverride
      ? `Agreed price, carried across from pricing-data.ts where it was an explicit override. ${p.notes ?? ""}`.trim()
      : `Agreed price, carried across from pricing-data.ts. It was derived there as hand-typed COGS £${p.cogs} x ${DEFAULT_CONFIG.markup} + shipping £${p.shipping}. The COGS behind it was never sourced; the price itself is what retailers hold. ${p.notes ?? ""}`.trim();

    for (const [type, amount, note] of [
      ["wholesale", wholesale, wholesaleNote],
      ["rrp", p.rrp, `RRP inc VAT, carried across from pricing-data.ts. ${p.notes ?? ""}`.trim()],
    ] as const) {
      const [existing] = await db
        .select()
        .from(skuPrices)
        .where(
          and(
            eq(skuPrices.skuId, sku.id),
            eq(skuPrices.priceType, type),
            isNull(skuPrices.effectiveTo),
          ),
        );
      if (existing) continue;

      if (WRITE) {
        await db.insert(skuPrices).values({
          skuId: sku.id,
          priceType: type,
          amount: amount.toFixed(2),
          effectiveFrom: EFFECTIVE_FROM,
          shipping: type === "wholesale" ? p.shipping.toFixed(4) : null,
          notes: note,
        });
      }
      if (type === "wholesale") wholesaleWritten++;
      else rrpWritten++;
    }
  }

  console.log(`${WRITE ? "Wrote" : "Would write"} ${wholesaleWritten} wholesale and ${rrpWritten} RRP rows.`);

  if (unmatchedFile.length > 0) {
    console.log(`\nIn pricing-data.ts but no SKU in the database (${unmatchedFile.length}):`);
    for (const u of unmatchedFile) console.log(`   ${u}`);
  }

  const priced = new Set((await db.select().from(skuPrices)).map((r) => r.skuId));
  const unpricedSkus = allSkus.filter((s) => !priced.has(s.id));
  if (!WRITE) console.log("\n(dry run, so the list below reflects pre-existing rows only)");
  console.log(`\nSKUs in the database with no price row (${unpricedSkus.length}):`);
  for (const s of unpricedSkus) console.log(`   ${s.code}`);

  console.log("\nPricing config into system_settings:");
  const settings: Array<[string, string]> = [
    [SETTING_KEYS.PRICING_MARKUP, String(DEFAULT_CONFIG.markup)],
    [SETTING_KEYS.PRICING_RETAILER_MARGIN, String(DEFAULT_CONFIG.retailerMargin)],
    [SETTING_KEYS.PRICING_VAT, String(DEFAULT_CONFIG.vat)],
    [SETTING_KEYS.PRICING_LIST_EFFECTIVE_FROM, EFFECTIVE_FROM],
  ];
  for (const [key, value] of settings) {
    console.log(`   ${key.padEnd(32)} ${value}`);
    if (!WRITE) continue;
    const [existing] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    if (existing) {
      await db.update(systemSettings).set({ value, updatedAt: new Date() }).where(eq(systemSettings.key, key));
    } else {
      await db.insert(systemSettings).values({ key, value });
    }
  }

  console.log(`\n${WRITE ? "WRITTEN" : "DRY RUN"}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
