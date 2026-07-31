/** Read-only: is there one object per ingredient yet? Compares all four masters. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "../../src/db";
import { components } from "../../src/db/schema";
import { MASTER_INGREDIENTS } from "../../src/data/ingredients";
import { RECIPE_INGREDIENT_MAP } from "../../src/lib/ingredients";

type JsonIng = { id: string; name: string; bottleSizeMl: number; currentPrice: number; currentPriceSetAt: string };

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

async function main() {
  const dbRows = await db.select().from(components);
  const jsonRows: JsonIng[] = JSON.parse(
    readFileSync(resolve(process.cwd(), "src/data/ingredients.json"), "utf8"),
  );

  const dbByNorm = new Map<string, typeof dbRows>();
  for (const c of dbRows) {
    const k = norm(c.name);
    dbByNorm.set(k, [...(dbByNorm.get(k) ?? []), c]);
  }

  console.log(`COUNTS`);
  console.log(`  DB components          ${dbRows.length}`);
  console.log(`  ingredients.json       ${jsonRows.length}`);
  console.log(`  MASTER_INGREDIENTS     ${MASTER_INGREDIENTS.length}`);
  console.log(`  RECIPE_INGREDIENT_MAP  ${Object.keys(RECIPE_INGREDIENT_MAP).length}`);

  console.log(`\nDUPLICATE-LOOKING NAMES INSIDE THE DB`);
  let dupes = 0;
  for (const [k, rows] of dbByNorm) {
    if (rows.length > 1) {
      dupes++;
      console.log(`  ${k}: ${rows.map((r) => `${r.id} "${r.name}"`).join(" | ")}`);
    }
  }
  if (dupes === 0) console.log("  none");

  console.log(`\nIN ingredients.json BUT NOT MATCHED IN THE DB`);
  let jsonMissing = 0;
  for (const j of jsonRows) {
    if (!dbByNorm.has(norm(j.name))) {
      jsonMissing++;
      console.log(`  ${j.name.padEnd(34)} £${j.currentPrice} / ${j.bottleSizeMl}ml  (set ${j.currentPriceSetAt})`);
    }
  }
  if (jsonMissing === 0) console.log("  none");

  console.log(`\nPRICE DISAGREEMENTS, json versus DB (per ml or per each)`);
  let disagree = 0;
  for (const j of jsonRows) {
    const rows = dbByNorm.get(norm(j.name));
    if (!rows || rows.length !== 1) continue;
    const c = rows[0];
    const jsonPerMl = j.currentPrice / j.bottleSizeMl;
    const dbPerUom =
      Number(c.packSize) > 1 && Number(c.packCost) > 0
        ? Number(c.packCost) / Number(c.packSize)
        : Number(c.unitCost);
    if (dbPerUom === 0 && jsonPerMl === 0) continue;
    const diffPct = dbPerUom === 0 ? 100 : ((jsonPerMl - dbPerUom) / dbPerUom) * 100;
    if (Math.abs(diffPct) > 1) {
      disagree++;
      console.log(
        `  ${j.name.padEnd(34)} json ${jsonPerMl.toFixed(6)}  db ${dbPerUom.toFixed(6)}  ${diffPct > 0 ? "+" : ""}${diffPct.toFixed(1)}%`,
      );
    }
  }
  if (disagree === 0) console.log("  none");

  console.log(`\nIN MASTER_INGREDIENTS BUT NOT MATCHED IN THE DB`);
  let miMissing = 0;
  for (const m of MASTER_INGREDIENTS) {
    if (!dbByNorm.has(norm(m.name))) {
      miMissing++;
      console.log(`  ${m.name}`);
    }
  }
  if (miMissing === 0) console.log("  none");

  console.log(`\nRECIPE_INGREDIENT_MAP TARGETS NOT IN ingredients.json`);
  const jsonIds = new Set(jsonRows.map((j) => j.id));
  let mapBroken = 0;
  for (const [k, v] of Object.entries(RECIPE_INGREDIENT_MAP)) {
    if (v && !jsonIds.has(v)) {
      mapBroken++;
      console.log(`  ${k} -> ${v}`);
    }
  }
  if (mapBroken === 0) console.log("  none");

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
