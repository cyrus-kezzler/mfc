/** Read-only: try the anchored batch on the Sakura Martini. */
import { listAnchorOptions, planBatchFromAnchor } from "../../src/lib/erp/batch";

async function main() {
  const client = process.argv[2] ?? "mfc";
  const drink = process.argv[3] ?? "sakura-martini";

  const opts = await listAnchorOptions(client, drink);
  console.log(`\nAnchor options for ${drink} [${client}]:`);
  for (const o of opts) {
    console.log(
      `   ${String(o.componentId).padStart(3)} ${o.name.padEnd(32)} ${String(o.percentage).padStart(7)}%   pack ${o.packSize ?? "unknown"} ${o.uom}`,
    );
  }
  if (opts.length === 0) {
    console.log("   none, check the client and drink slugs");
    process.exit(1);
  }

  const anchor = opts.find((o) => /sake/i.test(o.name)) ?? opts[opts.length - 1];
  const bottles = Number(process.argv[4] ?? 1);

  const plan = await planBatchFromAnchor(client, drink, anchor.componentId, bottles);
  if (!plan) {
    console.log("\nNo plan produced.");
    process.exit(1);
  }

  console.log(
    `\n=== ${plan.drinkName} [${plan.clientName}], anchored on ${bottles} x ${plan.anchorName} ===`,
  );
  console.log(
    `${plan.anchorQuantity} of ${plan.anchorName} at ${plan.lines.find((l) => l.isAnchor)!.percentage}% makes ${plan.batchLitres} litres\n`,
  );
  console.log(`   ${"ingredient".padEnd(34)}${"share".padStart(8)}${"need".padStart(11)}${"open".padStart(7)}${"left".padStart(9)}${"cost".padStart(9)}`);
  console.log("   " + "-".repeat(78));
  for (const l of plan.lines) {
    console.log(
      `   ${(l.name + (l.isAnchor ? "  <-- anchor" : "")).padEnd(34)}${(l.percentage + "%").padStart(8)}${(l.quantity + " " + l.uom).padStart(11)}${String(l.bottlesToOpen ?? "-").padStart(7)}${String(l.leftover ?? "-").padStart(9)}${("£" + l.cost.toFixed(2)).padStart(9)}`,
    );
  }
  console.log(`\n   Batch cost £${plan.totalCost.toFixed(2)}, £${plan.costPerLitre.toFixed(2)} per litre`);
  console.log(`\n   Yields:`);
  for (const y of plan.yields) {
    console.log(`      ${y.wholeBottles} x ${y.sizeMl}ml (${y.code}), ${y.remainderMl}ml over`);
  }
  if (plan.warnings.length) {
    console.log(`\n   Warnings:`);
    for (const w of plan.warnings) console.log(`      ${w}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
