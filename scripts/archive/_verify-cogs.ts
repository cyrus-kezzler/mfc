/**
 * Verification: reproduce the full build for a SKU from the live database and
 * show every line with its provenance. Read-only.
 *
 *   npx tsx --env-file=.env.local scripts/erp/_verify-cogs.ts espresso-martini-700-cripps
 *   npx tsx --env-file=.env.local scripts/erp/_verify-cogs.ts --all
 */

import { eq } from "drizzle-orm";

import { db } from "../../src/db";
import { skus } from "../../src/db/schema";
import { computeSkuCost, computeAllSkuCosts } from "../../src/lib/erp/cogs";

function money(x: number, dp = 4): string {
  return x.toFixed(dp).padStart(9);
}
function pad(s: unknown, n: number): string {
  const str = String(s ?? "");
  return str.length > n ? str.slice(0, n - 1) + "…" : str.padEnd(n);
}

async function one(code: string) {
  const [sku] = await db.select().from(skus).where(eq(skus.code, code));
  if (!sku) {
    console.error(`No SKU with code "${code}"`);
    process.exit(1);
  }
  const c = await computeSkuCost(sku.id);

  console.log(`\n=== ${c.skuCode} ===`);
  console.log(`${c.drinkName} for ${c.clientName}, ${c.sizeMl}ml\n`);

  console.log(`  ${pad("kind", 14)}${pad("component", 40)}${pad("unit £", 11)}${pad("qty", 10)}${pad("cost £", 10)}${pad("source", 10)}set`);
  console.log("  " + "-".repeat(100));
  for (const l of c.liquid) {
    console.log(
      `  ${pad(l.kind, 14)}${pad(l.name, 40)}${money(l.unitCost, 6)}  ${pad(l.quantity.toFixed(2), 10)}${money(l.cost, 4)} ${pad(l.source, 10)}${l.setAt ?? "-"}`,
    );
  }
  console.log(`  ${pad("", 14)}${pad("LIQUID SUBTOTAL", 40)}${pad("", 11)}${pad("", 10)}${money(c.liquidTotal, 4)}`);
  console.log("");
  for (const l of c.packaging) {
    console.log(
      `  ${pad(l.kind, 14)}${pad(l.name, 40)}${money(l.unitCost, 6)}  ${pad(l.quantity.toFixed(4), 10)}${money(l.cost, 4)} ${pad(l.source, 10)}${l.setAt ?? "-"}`,
    );
  }
  console.log(`  ${pad("", 14)}${pad("PACKAGING SUBTOTAL", 40)}${pad("", 11)}${pad("", 10)}${money(c.packagingTotal, 4)}`);

  if (c.excluded.length > 0) {
    // Two different reasons live in this bucket and they must not be blurred:
    // secondary packaging we DO pay for (mailers, carriage, Channel P&L), and
    // components the customer supplies that we never buy at all.
    console.log("\n  Excluded from COGS (secondary packaging, or customer-supplied):");
    for (const l of c.excluded) console.log(`    ${pad(l.name, 40)}${money(l.cost, 4)}`);
  }

  console.log("\n  " + "-".repeat(100));
  console.log(`  ${pad("", 14)}${pad("SUBTOTAL", 40)}${pad("", 21)}${money(c.subtotal, 4)}`);
  console.log(`  ${pad("", 14)}${pad(`WASTAGE @ ${(c.wastagePct * 100).toFixed(1)}%`, 40)}${pad("", 21)}${money(c.wastage, 4)}`);
  console.log(`  ${pad("", 14)}${pad("TOTAL COGS", 40)}${pad("", 21)}${money(c.total, 4)}`);

  console.log(`\n  Invoice-backed: ${c.invoiceBackedPct}% of subtotal`);
  if (c.unsourced.length > 0) {
    console.log("  NOT invoice-backed:");
    for (const u of c.unsourced) console.log(`    - ${u}`);
  }
  if (c.problems.length > 0) {
    console.log("  PROBLEMS:");
    for (const p of c.problems) console.log(`    ! ${p}`);
  }
}

async function all() {
  const rows = await computeAllSkuCosts();
  console.log(
    `\n  ${pad("sku", 32)}${pad("client", 17)}${pad("ml", 6)}${pad("liquid", 10)}${pad("pack", 10)}${pad("wastage", 10)}${pad("TOTAL", 10)}${pad("inv%", 7)}problems`,
  );
  console.log("  " + "-".repeat(112));
  for (const c of rows) {
    console.log(
      `  ${pad(c.skuCode, 32)}${pad(c.clientName, 17)}${pad(c.sizeMl, 6)}${pad(c.liquidTotal.toFixed(2), 10)}${pad(c.packagingTotal.toFixed(2), 10)}${pad(c.wastage.toFixed(2), 10)}${pad(c.total.toFixed(2), 10)}${pad(c.invoiceBackedPct, 7)}${c.problems.length || ""}`,
    );
  }
  const broken = rows.filter((r) => r.problems.length > 0);
  if (broken.length > 0) {
    console.log("\n  PROBLEMS:");
    for (const r of broken) for (const p of r.problems) console.log(`    ${r.skuCode}: ${p}`);
  }
}

async function main() {
  const arg = process.argv[2];
  if (!arg || arg === "--all") await all();
  else await one(arg);
  process.exit(0);
}

main().catch((e) => {
  console.error("VERIFY FAILED:", e);
  process.exit(1);
});
