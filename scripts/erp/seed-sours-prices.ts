/**
 * Price the Myatt's Sours inputs. Idempotent.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-sours-prices.ts --write
 *
 * Phosphoric acid is deliberately NOT priced here: the APC Pure invoice is for
 * a 45% product while the recipe assumes 75%, and that has to be resolved
 * before either the price or the stock dilution can be trusted.
 */

import { eq } from "drizzle-orm";

import { db } from "../../src/db";
import { components, componentPriceHistory } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");

type Row = {
  name: string;
  /** £ per gram. */
  unitCost: string;
  packSize: string;
  packCost: string;
  effectiveDate: string;
  note: string;
};

const ROWS: Row[] = [
  {
    name: "Citric acid powder",
    // 2.5 kg for £35.83 ex VAT = £14.332/kg = £0.014332/g
    unitCost: "0.0143",
    packSize: "2500.000",
    packCost: "35.83",
    effectiveDate: "2026-04-29",
    note: "APC Pure invoice 187817, 29 Apr 2026. Citric Acid Crystals Anhydrous 99.5-100.5% BP/USP/FCC, 2.5 kg at £35.83 ex VAT, so £14.332/kg. Carriage of £18.98 on that invoice covers three lines and is not apportioned here.",
  },
  {
    name: "Tartaric acid powder",
    // 1 kg for £21.26 ex VAT = £0.02126/g
    unitCost: "0.0213",
    packSize: "1000.000",
    packCost: "21.26",
    effectiveDate: "2026-04-29",
    note: "APC Pure invoice 187817, 29 Apr 2026. L(+) Tartaric Acid 99.7-100.5% Ph Eur/BP/ACS/USP, 1 kg at £21.26 ex VAT. Carriage not apportioned.",
  },
  {
    name: "Malic acid powder",
    // 1 kg for £9.70 = £0.0097/g
    unitCost: "0.0097",
    packSize: "1000.000",
    packCost: "9.70",
    effectiveDate: "2026-07-30",
    note: "Retail, BuyWholefoodsOnline, 1 kg food grade at £9.70, checked 30 Jul 2026. Cyrus buys this at retail (Holland & Barrett or Amazon), so a retail figure is the right basis. Re-check on next purchase.",
  },
  {
    name: "Salt",
    // ~£1.00/kg retail table salt
    unitCost: "0.0010",
    packSize: "1000.000",
    packCost: "1.00",
    effectiveDate: "2026-07-30",
    note: "Retail estimate, ordinary table salt at about £1.00/kg, 30 Jul 2026. Approximate on purpose: at 1 g per 326 ml base batch this line is about 0.3p per litre of Sours, so precision here cannot move any drink's cost. Flagged rather than hidden.",
  },
];

async function main() {
  console.log(WRITE ? "=== WRITE MODE ===\n" : "=== DRY RUN ===\n");

  for (const r of ROWS) {
    const [c] = await db.select().from(components).where(eq(components.name, r.name));
    if (!c) {
      console.log(`  NOT FOUND: ${r.name}`);
      continue;
    }
    console.log(`  ${WRITE ? "SET" : "WOULD SET"} ${r.name.padEnd(26)} £${r.unitCost}/g   (${r.effectiveDate})`);
    if (!WRITE) continue;

    await db
      .update(components)
      .set({
        unitCost: r.unitCost,
        packSize: r.packSize,
        packCost: r.packCost,
        unitCostSetAt: new Date(`${r.effectiveDate}T00:00:00Z`),
        notes: r.note,
        updatedAt: new Date(),
      })
      .where(eq(components.id, c.id));

    await db.insert(componentPriceHistory).values({
      componentId: c.id,
      unitCost: r.unitCost,
      uom: "g",
      effectiveDate: r.effectiveDate,
      source: "manual",
      notes: r.note,
    });
  }

  console.log("\n  HELD: Phosphoric acid, pending the 45% versus 75% question.");
  console.log(`\n${WRITE ? "WRITTEN" : "DRY RUN"}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
