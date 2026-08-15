/**
 * Canon derivation verify — every active drink, per client recipe, through
 * src/lib/erp/canon.ts (the real library, not a reimplementation: this script
 * exists to catch the library disagreeing with the figures verified by hand
 * on 14 Aug 2026, so it must exercise the same code the app will).
 *
 *   npx tsx --env-file=.env.local scripts/erp/_canon-verify.mjs
 *
 * Prints slug, client, computed ABV, water %, rest floor and any null-abv
 * components, then cross-checks against the 14 Aug figures and reports every
 * disagreement loudly. It never adjusts to match.
 */

import { eq } from "drizzle-orm";

// tsx compiles the app's TS to CJS (no "type": "module" here), so from this
// .mjs the named exports arrive on the default-import interop object.
import dbModule from "../../src/db/index.ts";
import schemaModule from "../../src/db/schema.ts";
import canonModule from "../../src/lib/erp/canon.ts";

const { db } = dbModule;
const { drinks, clients, recipes } = schemaModule;
const { canonReport } = canonModule;

// Verified by hand on 14 Aug 2026. Keys are "slug" (applies to every client's
// recipe of that drink) or "slug|client" where the figure is client-specific.
const EXPECTED_ABV = {
  "baby-otis": 28.4,
  "corpse-reviver": 20.8,
  trident: 25.0,
  "naked-and-famous": 23.5,
  "gibson-martini": 34.8,
  "vesper|mfc": 35.4,
  "vesper|fm": 34.7,
  "espresso-daiquiri": 18.6,
  "cold-brew-negroni": 27.6,
  "rum-old-fashioned": 35.2,
  "sakura-martini": 22.2,
  manhattan: 35.3,
  "negroni|mfc": 27.6,
};

// Verified 14 Aug 2026 alongside the serve-method investigation.
const EXPECTED_WATER = {
  "corpse-reviver": 23.2,
  margarita: 21.3,
  "naked-and-famous": 23.7,
  "gibson-martini": 10.0,
  "cold-brew-negroni": 0.0,
  "apples-and-pears": 30.8,
};

const r1 = (x) => Math.round(x * 10) / 10;

const activeDrinks = await db.select().from(drinks).where(eq(drinks.status, "active"));
const allClients = await db.select().from(clients);
const clientById = new Map(allClients.map((c) => [c.id, c]));
const currentRecipes = await db.select().from(recipes).where(eq(recipes.isCurrent, true));

const rows = [];
const disagreements = [];

for (const drink of activeDrinks.sort((a, b) => a.slug.localeCompare(b.slug))) {
  const pairs = currentRecipes
    .filter((r) => r.drinkId === drink.id)
    .map((r) => clientById.get(r.clientId))
    .filter(Boolean)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  if (pairs.length === 0) {
    rows.push({ slug: drink.slug, client: "—", abv: "", water: "", floor: "", nullAbv: "NO CURRENT RECIPE" });
    continue;
  }

  for (const client of pairs) {
    const report = await canonReport(drink.id, client.slug);
    const abv = r1(report.abv);
    const water = r1(report.waterPct);
    rows.push({
      slug: drink.slug,
      client: client.slug,
      abv,
      water,
      floor: report.restFloorWeeks ?? "",
      nullAbv:
        report.nullAbvComponents.map((c) => c.name).join(", ") +
        (report.problems.length ? ` [${report.problems.join("; ")}]` : ""),
    });

    const expAbv = EXPECTED_ABV[`${drink.slug}|${client.slug}`] ?? EXPECTED_ABV[drink.slug];
    if (expAbv !== undefined && abv !== expAbv) {
      disagreements.push(`ABV ${drink.slug}[${client.slug}]: computed ${abv}, expected ${expAbv}`);
    }
    const expWater = EXPECTED_WATER[`${drink.slug}|${client.slug}`] ?? EXPECTED_WATER[drink.slug];
    if (expWater !== undefined && water !== expWater) {
      disagreements.push(`WATER ${drink.slug}[${client.slug}]: computed ${water}, expected ${expWater}`);
    }
  }
}

const widths = { slug: 22, client: 7, abv: 6, water: 6, floor: 6 };
const pad = (v, w) => String(v).padEnd(w);
console.log(
  pad("slug", widths.slug) + pad("client", widths.client) + pad("abv", widths.abv) +
  pad("water", widths.water) + pad("floor", widths.floor) + "null-abv components / problems",
);
for (const row of rows) {
  console.log(
    pad(row.slug, widths.slug) + pad(row.client, widths.client) + pad(row.abv, widths.abv) +
    pad(row.water, widths.water) + pad(row.floor, widths.floor) + row.nullAbv,
  );
}

if (disagreements.length > 0) {
  console.log("\n!!! DISAGREEMENTS WITH THE 14 AUG 2026 VERIFIED FIGURES !!!");
  for (const d of disagreements) console.log("  " + d);
  process.exitCode = 1;
} else {
  console.log("\nAll cross-checked figures agree with the 14 Aug 2026 verification.");
}
