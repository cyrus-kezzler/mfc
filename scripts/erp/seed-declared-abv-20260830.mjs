/**
 * Backfill `skus.declared_abv` — the figure printed on the physical label.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-declared-abv-20260830.mjs [--apply]
 *
 * Source: Projects/Cocktails/Back Bar/`2026-08-30 declared_abv - the build
 * brief and the recovered label figures [Brief].md`, the table headed
 * "COMPLETE, 30 Aug 2026". That table supersedes the eight-row one below it in
 * the same file, which is kept there only as history.
 *
 * SAFETY PROPERTY, load-bearing: this script NEVER reads a computed ABV. The
 * only numbers it can write are the literals in DECLARED below, transcribed
 * from the brief. It is therefore structurally incapable of committing the
 * mistake the column exists to prevent — filling a declared figure by copying
 * the computed one — which is what happened to seventeen Shopify metafields
 * at 14:53:08 on 14 Aug 2026 and cost nine drinks their label number.
 *
 * A drink absent from DECLARED stays NULL. NULL means "nobody has read the
 * bottle" and is the correct, safe state; it is never an assertion of
 * agreement.
 *
 * Scope: MFC's own SKUs only (client `mfc`). The Fortnum's and Cripps SKUs are
 * deliberately left NULL — they are partner bottles under their own
 * client-scoped recipes, and nobody has read those labels. Same reasoning,
 * applied honestly rather than conveniently.
 *
 * Within MFC every size of a drink takes the same figure: the 50ml mini and
 * the 700ml are filled from one batch of one liquid, so the printed strength
 * is a property of the drink, not of the bottle it went into.
 *
 * Idempotent. Re-running writes the same values. Dry-run by default.
 */

import { neon } from "@neondatabase/serverless";

const FROM_14_AUG = { source: "14 Aug 2026 correction record", noted: "2026-08-14" };
const FROM_CYRUS = { source: "Cyrus, 30 Aug 2026", noted: "2026-08-30" };

/**
 * drink slug -> declared ABV as printed on the label, and where it came from.
 *
 * Two names in the brief are not the names Back Bar uses:
 *   "Cuban Manhattan"          -> baby-otis      (shopify baby-otis-cuban-rum-manhattan)
 *   "Corpse Reviver No. Blue"  -> corpse-reviver (shopify corpse-reviver-no-blue)
 *
 * One row of the brief's twenty is NOT here and cannot be: "Negroni Starter"
 * is a £20 gift box of six 50ml bottles spanning three different Negronis
 * (myattsfields.london/products/negroni-starter). It has no recipe, no
 * computed ABV and no drink or SKU record in Back Bar, so there is nothing to
 * attach a declared figure to and nothing for Gate 1 to compare against. Its
 * 27.6/27.9 pair in the brief is a Shopify metafield on a bundle product.
 * Recorded here rather than dropped silently, because the difference between
 * "left out on purpose" and "forgotten" is the whole point of this column.
 */
const DECLARED = [
  ["naked-and-famous", 17.1, FROM_14_AUG],
  ["corpse-reviver", 15.0, FROM_14_AUG],
  ["gibson-martini", 39.5, FROM_14_AUG],
  ["baby-otis", 24.5, FROM_14_AUG],
  ["sakura-martini", 19.0, FROM_14_AUG],
  ["vesper", 38.2, FROM_14_AUG],
  ["lychee-martini", 31.0, FROM_CYRUS],
  ["red-hook", 32.0, FROM_CYRUS],
  ["espresso-martini", 20.0, FROM_CYRUS],
  ["tuxedo", 29.1, FROM_CYRUS],
  ["margarita", 28.0, FROM_CYRUS],
  ["trident", 24.5, FROM_14_AUG],
  ["desert-negroni", 26.9, FROM_CYRUS],
  ["pisco-martini", 28.6, FROM_CYRUS],
  ["dempsey", 40.0, FROM_CYRUS],
  ["manhattan", 35.5, FROM_CYRUS],
  ["rum-old-fashioned", 35.0, FROM_14_AUG],
  ["cold-brew-negroni", 27.6, FROM_14_AUG],
  ["negroni", 27.6, FROM_CYRUS],
];

const apply = process.argv.includes("--apply");
const sql = neon(process.env.DATABASE_URL);

const [mfc] = await sql`select id from clients where slug = 'mfc'`;
if (!mfc) throw new Error("No client with slug 'mfc'");

let skuTotal = 0;
const missing = [];

for (const [slug, declared, prov] of DECLARED) {
  const [drink] = await sql`select id, name from drinks where slug = ${slug}`;
  if (!drink) {
    missing.push(slug);
    console.log(`  MISSING DRINK  ${slug}`);
    continue;
  }
  const targets = await sql`
    select id, code from skus where drink_id = ${drink.id} and client_id = ${mfc.id} order by size_ml`;
  if (apply) {
    await sql`
      update skus
         set declared_abv = ${declared},
             declared_abv_source = ${prov.source},
             declared_abv_noted = ${prov.noted},
             updated_at = now()
       where drink_id = ${drink.id} and client_id = ${mfc.id}`;
  }
  skuTotal += targets.length;
  console.log(
    `  ${drink.name.padEnd(24)} declared ${String(declared.toFixed(1)).padStart(5)}%  ` +
      `-> ${String(targets.length).padStart(2)} MFC skus  [${prov.source}]`,
  );
}

console.log(
  `\n${apply ? "APPLIED" : "DRY RUN"}: ${DECLARED.length} drinks, ${skuTotal} SKU rows.` +
    (missing.length ? `  MISSING: ${missing.join(", ")}` : ""),
);
if (!apply) console.log("Re-run with --apply to write.");
