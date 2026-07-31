/**
 * Correct the prices seeded from pricing-data.ts without reading the override
 * layer that sat on top of it. Idempotent.
 *
 *   npx tsx --env-file=.env.local scripts/erp/fix-override-prices.ts --write
 *
 * The mistake: src/data/wholesale-overrides.json and rrp-overrides.json were
 * written by the app AFTER pricing-data.ts was authored, so where they carry a
 * value it is the newer agreed price and pricing-data's is stale. The seed read
 * pricing-data's own `wholesaleOverride` field but not these files.
 *
 * Both corrections are independently confirmed: QuickBooks carries the Espresso
 * Martini wholesale prices at 9.00 and 15.00, and Shopify carries all four
 * corrected RRPs.
 */

import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../src/db";
import { skus, skuPrices } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");
const TODAY = "2026-07-31";

const WHOLESALE: Record<string, number> = {
  "espresso-martini-250": 9,
  "espresso-martini-500": 15,
};

const RRP: Record<string, number> = {
  "manhattan-500": 43,
  "manhattan-250": 23,
  "red-hook-250": 21,
  "margarita-250": 19.5,
};

const NOTE =
  "Corrected 31 Jul 2026. The initial migration seeded from pricing-data.ts and missed the override layer in src/data/wholesale-overrides.json and rrp-overrides.json, which the app had written later and which held the newer agreed figure. Wholesale corrections cross-checked against the QuickBooks item list; RRP corrections cross-checked against live Shopify variant prices.";

async function apply(code: string, type: "wholesale" | "rrp", amount: number) {
  const [sku] = await db.select().from(skus).where(eq(skus.code, code));
  if (!sku) {
    console.log(`  NO SKU ${code}`);
    return;
  }
  const [current] = await db
    .select()
    .from(skuPrices)
    .where(
      and(eq(skuPrices.skuId, sku.id), eq(skuPrices.priceType, type), isNull(skuPrices.effectiveTo)),
    );

  if (current && Number(current.amount) === amount) {
    console.log(`  ${code} ${type} already ${amount}`);
    return;
  }

  console.log(
    `  ${WRITE ? "CORRECT" : "WOULD CORRECT"} ${code.padEnd(26)} ${type.padEnd(10)} ${current ? current.amount : "none"} -> ${amount}`,
  );
  if (!WRITE) return;

  if (current) {
    // Close the wrong row rather than editing it, so the error stays visible.
    await db
      .update(skuPrices)
      .set({ effectiveTo: TODAY, updatedAt: new Date() })
      .where(eq(skuPrices.id, current.id));
  }
  await db.insert(skuPrices).values({
    skuId: sku.id,
    priceType: type,
    amount: amount.toFixed(2),
    effectiveFrom: TODAY,
    shipping: current?.shipping ?? null,
    notes: NOTE,
  });
}

async function main() {
  console.log(WRITE ? "=== WRITE MODE ===\n" : "=== DRY RUN ===\n");
  console.log("Wholesale:");
  for (const [code, amount] of Object.entries(WHOLESALE)) await apply(code, "wholesale", amount);
  console.log("RRP:");
  for (const [code, amount] of Object.entries(RRP)) await apply(code, "rrp", amount);
  console.log(`\n${WRITE ? "WRITTEN" : "DRY RUN"}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
