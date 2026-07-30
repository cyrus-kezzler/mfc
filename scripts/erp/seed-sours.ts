/**
 * Make Myatt's Sours a real managed sub-recipe. Idempotent.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-sours.ts          (dry run)
 *   npx tsx --env-file=.env.local scripts/erp/seed-sours.ts --write
 *
 * Source of the recipe: the myatts-sours skill. That markdown is currently the
 * only place the recipe exists, which is the failure mode this rebuild keeps
 * finding, a truth in a file that nothing checks. After this runs, Back Bar
 * holds it and the skill should point here.
 *
 * Deliberately NOT done: inventing prices for the acids. They are created
 * unpriced and reported, so the derived cost of Sours refuses to compute until
 * real invoices land. Until then Sours keeps its hand-typed £0.005/ml, clearly
 * marked as unsourced.
 */

import { eq, and } from "drizzle-orm";

import { db } from "../../src/db";
import { components, componentRecipes, type NewComponent } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");

const log: string[] = [];
function note(s: string) {
  log.push(s);
  console.log(`  ${s}`);
}

/** Raw inputs that have to exist before either sub-recipe can be described. */
const RAW: Array<{ name: string; uom: "g" | "ml"; notes: string }> = [
  { name: "Citric acid powder", uom: "g", notes: "Myatt's Sours input. UNPRICED, needs a supplier invoice." },
  { name: "Malic acid powder", uom: "g", notes: "Myatt's Sours input. UNPRICED, needs a supplier invoice." },
  { name: "Tartaric acid powder", uom: "g", notes: "Myatt's Sours input. UNPRICED, needs a supplier invoice." },
  { name: "Salt", uom: "g", notes: "Myatt's Sours input. UNPRICED, needs a supplier invoice." },
  {
    name: "Phosphoric acid 75% food grade",
    uom: "g",
    notes:
      "Neat 75% product, corrosive and syrupy. Never used directly in a batch: it is diluted to the 1.25% stock first. UNPRICED, needs a supplier invoice.",
  },
];

const STOCK_NAME = "Phosphoric acid 1.25% solution";
const SOURS_NAME = "Myatt's Sours";

const STOCK_METHOD = `Add 1.25 g of 75% food-grade phosphoric acid to 100 g of water, giving about 101.25 g of stock.

Made separately because a single 326 g batch of Sours needs only about 0.62 g of the 75% product, which is too little to weigh accurately, and neat 75% phosphoric acid is corrosive and syrupy. Pre-diluting means weighing convenient tens of grams, it mixes in uniformly, and the concentrated acid is handled once. The stock is shelf-stable, so making extra is fine.`;

const SOURS_METHOD = `Dissolve the acids and the salt in the water, add the phosphoric acid stock, stir or whisk until fully dissolved, then bottle.

Report the acids to 0.1 g, they drive the flavour balance. Water and the phosphoric stock can be rounded to the nearest gram.

The solution is roughly 95% water, so density is about 1 g per ml. A batch comes out around 2% under its nominal volume; top up with a splash of water if the exact volume matters.`;

async function ensure(spec: {
  name: string;
  type: NewComponent["type"];
  uom: NewComponent["uom"];
  notes?: string;
  batchYield?: string;
  batchMethod?: string;
  abv?: string;
}): Promise<number> {
  const [existing] = await db.select().from(components).where(eq(components.name, spec.name));

  if (existing) {
    const needsUpdate =
      (spec.type && existing.type !== spec.type) ||
      (spec.batchYield && existing.batchYield !== spec.batchYield) ||
      (spec.batchMethod && existing.batchMethod !== spec.batchMethod);
    if (needsUpdate) {
      if (WRITE) {
        await db
          .update(components)
          .set({
            type: spec.type,
            batchYield: spec.batchYield ?? existing.batchYield,
            batchMethod: spec.batchMethod ?? existing.batchMethod,
            updatedAt: new Date(),
          })
          .where(eq(components.id, existing.id));
      }
      note(`${WRITE ? "UPDATED" : "WOULD UPDATE"} ${spec.name} (id ${existing.id}) type=${spec.type} yield=${spec.batchYield ?? "-"}`);
    } else {
      note(`${spec.name} already correct (id ${existing.id})`);
    }
    return existing.id;
  }

  if (!WRITE) {
    note(`WOULD CREATE ${spec.name} (${spec.type}, ${spec.uom})`);
    return -1;
  }
  const [created] = await db
    .insert(components)
    .values({
      name: spec.name,
      type: spec.type,
      uom: spec.uom,
      packSize: "1.000",
      packCost: null,
      unitCost: "0",
      unitCostSetAt: null,
      notes: spec.notes,
      batchYield: spec.batchYield,
      batchMethod: spec.batchMethod,
      abv: spec.abv,
      active: true,
    })
    .returning();
  note(`CREATED ${spec.name} (id ${created.id}, ${spec.type}, ${spec.uom}) UNPRICED`);
  return created.id;
}

async function link(parentId: number, childId: number, quantity: string, order: number, notes?: string) {
  if (parentId < 0 || childId < 0) return;
  const [existing] = await db
    .select()
    .from(componentRecipes)
    .where(
      and(
        eq(componentRecipes.parentComponentId, parentId),
        eq(componentRecipes.childComponentId, childId),
      ),
    );
  if (existing) {
    if (existing.quantity !== quantity) {
      if (WRITE) {
        await db
          .update(componentRecipes)
          .set({ quantity, updatedAt: new Date() })
          .where(eq(componentRecipes.id, existing.id));
      }
      note(`${WRITE ? "UPDATED" : "WOULD UPDATE"} line ${parentId}->${childId} qty ${existing.quantity} to ${quantity}`);
    }
    return;
  }
  if (!WRITE) {
    note(`WOULD LINK ${parentId} -> ${childId} qty ${quantity}`);
    return;
  }
  await db.insert(componentRecipes).values({
    parentComponentId: parentId,
    childComponentId: childId,
    quantity,
    displayOrder: order,
    notes,
  });
  note(`LINKED ${parentId} -> ${childId} qty ${quantity}`);
}

async function main() {
  console.log(WRITE ? "=== WRITE MODE ===\n" : "=== DRY RUN (pass --write to commit) ===\n");

  console.log("1. Raw inputs");
  const rawIds: Record<string, number> = {};
  for (const r of RAW) {
    rawIds[r.name] = await ensure({ name: r.name, type: "ingredient", uom: r.uom, notes: r.notes, abv: "0.00" });
  }

  const [water] = await db.select().from(components).where(eq(components.name, "Water"));
  if (!water) throw new Error("No Water component, cannot proceed");
  note(`Water is component ${water.id} (${water.uom}). Density is 1, so grams and millilitres are interchangeable here.`);

  console.log("\n2. Phosphoric acid 1.25% stock, a sub-recipe in its own right");
  const stockId = await ensure({
    name: STOCK_NAME,
    type: "sub_recipe",
    uom: "g",
    batchYield: "101.2500",
    batchMethod: STOCK_METHOD,
    abv: "0.00",
    notes: "Diluted stock consumed by Myatt's Sours. Cost derives from the neat 75% acid, never from the stock weight.",
  });
  await link(stockId, rawIds["Phosphoric acid 75% food grade"], "1.2500", 1);
  await link(stockId, water.id, "100.0000", 2, "100 g of water, taken as 100 ml at density 1");

  console.log("\n3. Myatt's Sours");
  const soursId = await ensure({
    name: SOURS_NAME,
    type: "sub_recipe",
    uom: "ml",
    batchYield: "326.2000",
    batchMethod: SOURS_METHOD,
  });
  await link(soursId, rawIds["Citric acid powder"], "9.0000", 1);
  await link(soursId, rawIds["Malic acid powder"], "6.0000", 2);
  await link(soursId, rawIds["Tartaric acid powder"], "0.2000", 3);
  await link(soursId, stockId, "50.0000", 4);
  await link(soursId, water.id, "260.0000", 5, "260 g of water, taken as 260 ml at density 1");
  await link(soursId, rawIds["Salt"], "1.0000", 6);

  console.log("\n4. Sense check");
  const declared = 326.2;
  const summed = 9 + 6 + 0.2 + 50 + 260 + 1;
  console.log(
    `  base batch declared ${declared} g, constituents sum to ${summed} g, ${Math.abs(declared - summed) < 0.001 ? "MATCH" : "MISMATCH"}`,
  );

  const unpriced = (await db.select().from(components)).filter(
    (c) => c.active && c.type !== "packaging" && (c.unitCostSetAt === null || c.unitCostSetAt === undefined) && Number(c.unitCost) === 0,
  );
  console.log(`\n  Unpriced active components after this run: ${unpriced.length}`);
  for (const c of unpriced) console.log(`    ${String(c.id).padStart(3)} ${c.name}`);

  console.log(`\n${WRITE ? "WRITTEN" : "DRY RUN, nothing written"}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("SEED FAILED:", e);
  process.exit(1);
});
