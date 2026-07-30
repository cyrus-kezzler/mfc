/**
 * Batch instructions for a sub-recipe. Read-only.
 *
 *   npx tsx --env-file=.env.local scripts/erp/make-batch.ts "Myatt's Sours" 3000
 *   npx tsx --env-file=.env.local scripts/erp/make-batch.ts --list
 *
 * Quantity is in the sub-recipe's own unit of measure, so Sours takes
 * millilitres: 3000 for three litres.
 */

import { planBatch, listSubRecipes, type BatchPlan } from "../../src/lib/erp/sub-recipes";
import { db } from "../../src/db";
import { components } from "../../src/db/schema";
import { eq } from "drizzle-orm";

function qty(x: number, uom: string): string {
  // Grams always to 0.1: the acids drive the flavour balance and 83 g of citric
  // is not the same drink as 82.8 g. Millilitres of water can round.
  const dp = uom === "g" ? 1 : 0;
  return `${x.toFixed(dp)} ${uom}`;
}

function render(plan: BatchPlan, depth = 0) {
  const ind = "  ".repeat(depth);

  if (depth === 0) {
    console.log(`\n=== ${plan.name}: make ${qty(plan.target, plan.uom)} ===`);
    console.log(`base batch ${plan.batchYield} ${plan.uom}, scale x${plan.scale}\n`);
  }

  for (const step of plan.steps) {
    console.log(`${ind}STEP: make ${qty(step.target, step.uom)} of ${step.name} first`);
    render(step, depth + 1);
    console.log("");
  }

  console.log(`${ind}${plan.name}:`);
  for (const l of plan.lines) {
    const costTxt = l.cost === null ? "cost unknown" : `£${l.cost.toFixed(4)}`;
    console.log(`${ind}   ${qty(l.quantity, l.uom).padStart(12)}  ${l.name.padEnd(36)} ${costTxt}`);
  }

  if (depth === 0) {
    console.log("");
    if (plan.derivedUnitCost === null) {
      console.log(`  Derived cost: CANNOT BE COMPUTED. Unpriced inputs:`);
      for (const u of plan.unpriced) console.log(`     - ${u}`);
      console.log(`\n  Currently asserted in the register: £${plan.assertedUnitCost.toFixed(4)} per ${plan.uom} (hand-typed, unsourced)`);
      console.log(`  At that asserted rate this batch would be £${(plan.assertedUnitCost * plan.target).toFixed(2)}.`);
    } else {
      console.log(`  Derived cost: £${plan.derivedUnitCost.toFixed(6)} per ${plan.uom}, £${plan.derivedCost!.toFixed(2)} for this batch`);
      const asserted = plan.assertedUnitCost;
      if (asserted > 0) {
        const delta = ((plan.derivedUnitCost - asserted) / asserted) * 100;
        console.log(`  Asserted was £${asserted.toFixed(4)} per ${plan.uom}, so the derived figure is ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`);
      }
    }
    if (plan.method) console.log(`\n  Method:\n${plan.method.split("\n").map((l) => "    " + l).join("\n")}`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--list" || args.length === 0) {
    const subs = await listSubRecipes();
    console.log("Sub-recipes:");
    for (const s of subs) console.log(`   ${s.name} (yields ${s.batchYield ?? "?"} ${s.uom} per base batch)`);
    process.exit(0);
  }

  const name = args[0];
  const target = Number(args[1]);
  if (!Number.isFinite(target) || target <= 0) {
    console.error("Second argument must be a positive quantity.");
    process.exit(1);
  }

  const [c] = await db.select().from(components).where(eq(components.name, name));
  if (!c) {
    console.error(`No component named "${name}". Try --list.`);
    process.exit(1);
  }

  render(await planBatch(c.id, target));
  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e.message ?? e);
  process.exit(1);
});
