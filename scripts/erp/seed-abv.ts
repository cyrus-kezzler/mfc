/**
 * Fill component ABVs from published producer figures. Idempotent.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-abv.ts          (dry run)
 *   npx tsx --env-file=.env.local scripts/erp/seed-abv.ts --write
 *
 * ABV matters here because a recipe has to land on the ABV printed on the
 * label, and water is an ingredient with an ABV of zero. Without ABVs there is
 * no way to tell a recipe that is genuinely neat from one that is missing its
 * dilution line, which is the open question on the Manhattan.
 *
 * Only figures I can state with confidence are written. Anything brand
 * dependent, house made, or specific to a Myatt's Fields supply arrangement is
 * left null and reported, because a guessed ABV would silently validate a
 * broken recipe, which is worse than a blank.
 */

import { eq } from "drizzle-orm";

import { db } from "../../src/db";
import { components } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");

/** name -> [abv, source] */
const PUBLISHED: Record<string, [number, string]> = {
  // Non-alcoholic. Water is the one that matters: it is the dilution line.
  Water: [0, "water"],
  "1:1 Sugar Syrup": [0, "sugar and water"],
  "Agave Syrup": [0, "non-alcoholic"],
  "Clarified Apple Juice (house)": [0, "non-alcoholic"],
  "Cranberry & Hibiscus Syrup (house)": [0, "non-alcoholic"],
  "Espresso (house-brewed)": [0, "non-alcoholic"],
  "Maple Syrup": [0, "non-alcoholic"],
  "Monin Grenadine": [0, "non-alcoholic syrup"],
  "Oat Milk": [0, "non-alcoholic"],

  // Aperitifs, vermouths and fortified wine.
  Aperol: [11, "Campari Group, published"],
  "Carpano Antica Formula Vermouth": [16.5, "Fratelli Branca, published"],
  "Cocchi Americano": [16.5, "Giulio Cocchi, published"],
  Cynar: [16.5, "Campari Group, published"],
  "Lillet Blanc": [17, "Maison Lillet, published"],
  "Noilly Prat": [18, "Noilly Prat, published"],
  "Punt e Mes": [16, "Carpano, published"],
  "Fino Sherry": [15, "typical fino, published"],
  Manzanilla: [15, "La Guita, published"],
  "Jerez (Pedro Ximénez)": [17, "typical PX, published"],
  Suze: [20, "Pernod Ricard, published"],
  "Ginjo Sake": [15, "typical ginjo, published"],

  // Spirits.
  Calvados: [40, "typical calvados, published"],
  "Cotswold Whisky": [46, "Cotswolds Distillery single malt, published"],
  "Epsolon Blanco Tequila": [40, "Espolon Blanco, published"],
  "Tequila Reposado": [40, "Espolon Reposado, published"],
  "Havana Club 7": [40, "Havana Club 7, published"],
  "Mount Gay Rum": [40, "Mount Gay Eclipse, published"],
  "Mount Gay Black Barrel": [43, "Mount Gay Black Barrel, published"],
  Mezcal: [40, "typical mezcal, published"],
  "Pisco Aba": [40, "Pisco ABA, published"],
  "Somerset Cider Brandy": [42, "Somerset Cider Brandy Company 3 year, published"],
  Akvavit: [45, "Aalborg Taffel, published"],

  // Liqueurs.
  "Fernet Branca": [39, "Fratelli Branca, published"],
  "Heering Cherry": [24, "Cherry Heering, published"],
  "Luxardo Maraschino": [32, "Luxardo, published"],
  "Lychee Liqueur": [20, "Kwai Feh, published"],
  "Mozart Chocolate Liqueur": [17, "Mozart Distillerie, published"],
  Passoã: [17, "Passoa, published"],
  "Triple Sec": [40, "Cointreau, published"],
  "Yellow Chartreuse": [43, "Chartreuse Diffusion, published"],
  "Belle de Brillet (pear liqueur)": [30, "Maison Brillet, published"],
  "La Fée Absinthe": [68, "La Fee Parisienne, published"],
};

/** Left blank on purpose, with the reason. */
const DEFERRED: Record<string, string> = {
  "Myatt's Sours": "house recipe, and Cyrus says it is largely water, so its ABV drives the dilution maths",
  "Blue Curaçao": "brand dependent, ranges roughly 20 to 25",
  "Chinotto Nero": "brand dependent, no reliable published figure",
  "Gin (Amalthea)": "partner gin, ABV is a Myatt's Fields supply fact",
  "Ginger Amalthea Gin": "short-run botanical variant of the above",
  "Ginger Liqueur": "brand dependent, ranges roughly 20 to 41",
  "Old Tom Gin": "brand dependent, ranges roughly 40 to 47",
  "Scratch (white rum)": "duty-paid bulk from Canebrake, ABV is on the invoice not a label",
  "Shipwreck Rum": "brand dependent, no reliable published figure",
};

async function main() {
  console.log(WRITE ? "=== WRITE MODE ===" : "=== DRY RUN (pass --write to commit) ===\n");

  const all = await db.select().from(components);
  const byName = new Map(all.map((c) => [c.name, c]));

  let written = 0;
  let already = 0;
  const notFound: string[] = [];

  for (const [name, [abv, source]] of Object.entries(PUBLISHED)) {
    const c = byName.get(name);
    if (!c) {
      notFound.push(name);
      continue;
    }
    if (c.abv !== null && c.abv !== undefined) {
      already++;
      continue;
    }
    console.log(`  ${WRITE ? "SET" : "WOULD SET"} ${name.padEnd(38)} ${String(abv).padStart(5)}%   ${source}`);
    if (WRITE) {
      await db
        .update(components)
        .set({ abv: abv.toFixed(2), updatedAt: new Date() })
        .where(eq(components.id, c.id));
    }
    written++;
  }

  console.log(`\n${WRITE ? "Wrote" : "Would write"} ${written}. Already had an ABV: ${already}.`);

  if (notFound.length > 0) {
    console.log(`\nNamed here but not in the database (${notFound.length}):`);
    for (const n of notFound) console.log(`   ${n}`);
  }

  console.log("\n=== LEFT BLANK, NEEDS CYRUS ===");
  for (const [name, why] of Object.entries(DEFERRED)) {
    const present = byName.has(name) ? "" : "  [not in DB]";
    console.log(`   ${name.padEnd(34)} ${why}${present}`);
  }

  const stillBlank = (await db.select().from(components)).filter(
    (c) => c.active && (c.abv === null || c.abv === undefined),
  );
  console.log(`\nActive components still without an ABV: ${stillBlank.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("SEED FAILED:", e);
  process.exit(1);
});
