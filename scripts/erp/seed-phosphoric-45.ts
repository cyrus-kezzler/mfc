/**
 * Switch the phosphoric stock from the old 75% bottle to the new 45% product.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-phosphoric-45.ts --write
 *
 * Cyrus, 30 Jul 2026: the 45% arrived from APC Pure and is now the supply. The
 * old 75% bottle is nearly out and its source is not remembered, so it stays in
 * the register as legacy stock with no price, the same treatment the Bimber
 * vodka got.
 *
 * The dilution is rebalanced so the stock delivers identical pure acid:
 *   75% product: 1.2500 g + 100.0000 g water = 101.25 g stock, 0.9375 g H3PO4
 *   45% product: 2.0833 g +  99.1667 g water = 101.25 g stock, 0.9375 g H3PO4
 * So the Sours recipe is untouched: still 50 g of stock per base batch.
 */

import { eq, and } from "drizzle-orm";

import { db } from "../../src/db";
import { components, componentPriceHistory, componentRecipes } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");

const OLD = "Phosphoric acid 75% food grade";
const NEW = "Phosphoric acid 45% food grade (APC Pure)";
const STOCK = "Phosphoric acid 1.25% solution";
const STOCK_NEW_NAME = "Phosphoric acid dilution stock (0.93% H3PO4)";

/**
 * £ per gram. 2.5 L at £31.74 ex VAT. Density of 45% phosphoric acid is about
 * 1.29 g/ml, so 2.5 L is about 3,225 g, giving £0.00984/g.
 *
 * The density is a published property, not a measurement, and it is the one
 * assumption in this line. It is harmless: this component contributes about
 * 0.6p to a litre of Sours, so even a 10% density error moves nothing.
 */
const UNIT_COST = "0.0098";

const NEW_NOTE =
  "APC Pure invoice 187817, 29 Apr 2026. Phosphoric Acid 45% (GW), code GWN9315-F, 2.5 L at £31.74 ex VAT. Priced per gram using a density of about 1.29 g/ml for 45% phosphoric acid, so roughly 3,225 g in the container. Carriage of £18.98 covered three lines on that invoice and is not apportioned. Hard to source: treat a reorder as long lead time.";

const STOCK_METHOD = `Add 2.08 g of 45% food-grade phosphoric acid to 99.17 g of water, giving 101.25 g of stock.

LEGACY: with the old 75% bottle the figures were 1.25 g of acid to 100 g of water. Both make a stock of the same strength, so the Sours recipe is 50 g of stock either way. Use whichever bottle is open, with its own figure.

Made separately because a single 326 g batch of Sours needs under a gram of the neat product, which is too little to weigh accurately, and concentrated phosphoric acid is corrosive and syrupy. Pre-diluting means weighing convenient tens of grams, it mixes in uniformly, and the concentrated acid is handled once. The stock is shelf-stable, so making extra is fine.`;

async function main() {
  console.log(WRITE ? "=== WRITE MODE ===\n" : "=== DRY RUN ===\n");

  // 1. Mark the old bottle as legacy stock.
  const [oldC] = await db.select().from(components).where(eq(components.name, OLD));
  if (oldC) {
    console.log(`  ${WRITE ? "RENAMED" : "WOULD RENAME"} "${OLD}" to legacy stock (id ${oldC.id})`);
    if (WRITE) {
      await db
        .update(components)
        .set({
          name: "Phosphoric acid 75% (legacy stock, no reorder)",
          notes:
            "Old bottle, source not recorded, nearly out as of 30 Jul 2026. Superseded by the 45% APC Pure product. Kept unpriced and in the register only so a batch made from the remaining stock can still be described. Do not reorder.",
          active: true,
          updatedAt: new Date(),
        })
        .where(eq(components.id, oldC.id));
    }
  }

  // 2. Create the new one, priced.
  let newId: number;
  const [existingNew] = await db.select().from(components).where(eq(components.name, NEW));
  if (existingNew) {
    newId = existingNew.id;
    console.log(`  ${NEW} already present (id ${newId})`);
  } else if (!WRITE) {
    console.log(`  WOULD CREATE ${NEW} at £${UNIT_COST}/g`);
    newId = -1;
  } else {
    const [created] = await db
      .insert(components)
      .values({
        name: NEW,
        type: "ingredient",
        uom: "g",
        packSize: "3225.000",
        packCost: "31.74",
        unitCost: UNIT_COST,
        unitCostSetAt: new Date("2026-04-29T00:00:00Z"),
        abv: "0.00",
        notes: NEW_NOTE,
        active: true,
      })
      .returning();
    newId = created.id;
    await db.insert(componentPriceHistory).values({
      componentId: newId,
      unitCost: UNIT_COST,
      uom: "g",
      effectiveDate: "2026-04-29",
      source: "manual",
      notes: NEW_NOTE,
    });
    console.log(`  CREATED ${NEW} (id ${newId}) at £${UNIT_COST}/g`);
  }

  // 3. Repoint and rebalance the stock sub-recipe.
  const [stock] = await db.select().from(components).where(eq(components.name, STOCK));
  if (!stock) {
    console.log("  Stock component not found, nothing repointed.");
    process.exit(1);
  }

  const [water] = await db.select().from(components).where(eq(components.name, "Water"));

  if (WRITE && newId > 0) {
    // Drop the old acid line, add the new one at the rebalanced weight.
    if (oldC) {
      await db
        .delete(componentRecipes)
        .where(
          and(
            eq(componentRecipes.parentComponentId, stock.id),
            eq(componentRecipes.childComponentId, oldC.id),
          ),
        );
    }
    const [already] = await db
      .select()
      .from(componentRecipes)
      .where(
        and(
          eq(componentRecipes.parentComponentId, stock.id),
          eq(componentRecipes.childComponentId, newId),
        ),
      );
    if (!already) {
      await db.insert(componentRecipes).values({
        parentComponentId: stock.id,
        childComponentId: newId,
        quantity: "2.0833",
        displayOrder: 1,
        notes: "Rebalanced from 1.25 g of 75% so the stock delivers the same 0.9375 g of pure H3PO4.",
      });
    }
    if (water) {
      await db
        .update(componentRecipes)
        .set({ quantity: "99.1667", updatedAt: new Date() })
        .where(
          and(
            eq(componentRecipes.parentComponentId, stock.id),
            eq(componentRecipes.childComponentId, water.id),
          ),
        );
    }
    await db
      .update(components)
      .set({ name: STOCK_NEW_NAME, batchMethod: STOCK_METHOD, updatedAt: new Date() })
      .where(eq(components.id, stock.id));
  }

  console.log(`  ${WRITE ? "REPOINTED" : "WOULD REPOINT"} the stock to the 45% product, 2.0833 g acid to 99.1667 g water`);
  console.log(`  ${WRITE ? "RENAMED" : "WOULD RENAME"} the stock to "${STOCK_NEW_NAME}" (the old name described the 75% product's weight, not the acid)`);

  console.log(`\n${WRITE ? "WRITTEN" : "DRY RUN"}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
