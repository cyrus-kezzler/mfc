/**
 * Data-integrity audit across EVERY recipe in Back Bar. READ-ONLY.
 *
 *   npx tsx --env-file=.env.local scripts/erp/audit-recipes.ts
 *
 * Built 28 Aug 2026 after two of two recipes entered on 15 Jul 2026 (Apples &
 * Pears, Christmas Gingertini) were found materially wrong: the recipe was
 * never compared against anything at the moment it was written, and nobody
 * had checked the rest. See
 * `Projects/Cocktails/Back Bar/2026-08-28 How the recipe error happened, and
 * the four checks that would have caught it [Assessment].md` in Canon.
 *
 * This script runs SELECTs only. It never writes to the database.
 *
 * For every recipe row (every version, current or not, every client) it
 * reports:
 *   - drink name, client, recipe id, version, is_current
 *   - every component line with its percentage and the component's ABV
 *   - whether the percentages sum to 100 (flagged if off by more than 0.01)
 *   - the COMPUTED ABV
 *   - the DECLARED ABV on the drink or SKU record, if one exists
 *   - the GAP between computed and declared, FAIL if it exceeds 0.3 points
 *     (the legal tolerance for spirit drinks)
 *   - any component line with a NULL abv (silently understates computed ABV)
 *   - the water percentage, flagged if outside 8-17%
 *
 * ON THE ABV FORMULA: this script does NOT reimplement the sum-of-percentages
 * arithmetic blind. For every CURRENT recipe it calls the app's own
 * `abvComputed()` and `waterPct()` from src/lib/erp/canon.ts directly and
 * treats their output as ground truth, per the brief's instruction to reuse
 * the real function where it can be called from a script (it can: canon.ts
 * has no framework dependency, just drizzle + the schema).
 *
 * canon.ts's exported functions only resolve the CURRENT recipe for a given
 * (drinkId, clientSlug) pair, because that is all the app ever needs. This
 * audit also has to walk every non-current version (six drinks were rev'd to
 * v2 on 14 Aug 2026 and the v1 rows are still in the table), which canon.ts
 * cannot address directly by recipe id. So for every recipe row this script
 * REPLICATES canon.ts's formulas exactly, line for line:
 *   - ABV: sum of (component.abv * line.percentage / 100), skipping any line
 *     whose component.abv is NULL and recording that component's name rather
 *     than treating the null as zero (canon.ts abvComputed, lines 167-194).
 *   - water %: sum of (line.percentage * waterFraction(component)), where
 *     waterFraction is 1 for the component literally named "Water", 0 for any
 *     other ingredient, and recurses into component_recipes for a sub_recipe
 *     component, quantity-weighted over its batch_yield (canon.ts waterPct,
 *     lines 212-278, including the same depth cap against a cycle).
 * As a self-check, the script then calls the REAL abvComputed()/waterPct()
 * for every current recipe and asserts they agree with this script's own
 * replicated numbers to 4 decimal places. Any disagreement is printed loudly
 * and would mean this script's replication has drifted from the app's logic.
 *
 * ON DECLARED ABV — CORRECTED 4 Sept 2026. When this script was first written
 * on 28 Aug 2026 no declared-ABV column existed, and it said so loudly. Two
 * days later `skus.declared_abv` landed (commit ecddd68, 30 Aug), along with
 * `declared_abv_source` and `declared_abv_noted`. The script was not updated,
 * so for five days the tool whose job is to prove the data is correct was
 * itself reporting "NOT IN DB" for all 40 recipes while 95 of 104 SKUs
 * carried a declared figure. That is the exact failure mode this script was
 * built to catch, committed inside the catcher. It now reads the column.
 *
 * A recipe is (drink, client); SKUs carry both drink_id and client_id, so the
 * declared figures for a recipe are those of its matching SKUs. Sizes of the
 * same drink should agree, so a disagreement between them is itself reported.
 *
 * NULL is not a pass. Per the schema's own note, NULL declared_abv means
 * NOBODY HAS READ THE BOTTLE — it does not mean "agrees with computed", and
 * it must never be filled by copying the computed value, which is the single
 * act the column exists to prevent. Such a recipe is reported UNVERIFIED and
 * is not counted as passing.
 */

import { db } from "../../src/db";
import {
  clients,
  components,
  componentRecipes,
  drinks,
  recipes,
  recipeLines,
  skus,
  type Client,
  type Drink,
  type Recipe,
  type RecipeLine,
} from "../../src/db/schema";
import {
  abvComputed,
  waterPct as canonWaterPct,
  gateOne,
  GATE_1_TOLERANCE_POINTS,
} from "../../src/lib/erp/canon";

const PCT_SUM_TOLERANCE = 0.01;
/** The app owns this number; the audit must not keep a second copy of it. */
const ABV_GAP_FAIL_THRESHOLD = GATE_1_TOLERANCE_POINTS;
const WATER_MIN = 8;
const WATER_MAX = 17;
const SUB_RECIPE_DEPTH_CAP = 8;

function n(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function round(x: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

function pad(s: unknown, w: number): string {
  const t = String(s ?? "");
  return t.length > w ? t.slice(0, w - 1) + "…" : t.padEnd(w);
}

interface LineReport {
  componentId: number;
  componentName: string;
  percentage: number;
  abv: number | null;
}

interface RecipeReport {
  recipe: Recipe;
  drink: Drink;
  client: Client;
  lines: LineReport[];
  pctSum: number;
  pctSumOffByMoreThan001: boolean;
  computedAbv: number;
  nullAbvComponents: string[];
  waterPct: number;
  waterOutOfRange: boolean;
  /** Read from skus.declared_abv on the SKUs for this (drink, client). */
  declaredAbv: number | null;
  /** SKU codes carrying that figure, for traceability back to a bottle. */
  declaredFromSkus: string[];
  /** True when sizes of the same drink disagree about the label figure. */
  declaredDisagrees: boolean;
  /** How many matching SKUs have no declared figure at all. */
  skusMissingDeclared: number;
  /** |computed − declared|, or null when nobody has read the bottle. */
  gap: number | null;
  /** null means UNVERIFIED (no declared figure), not pass. */
  gapFail: boolean | null;
  crossCheck: "not-current" | "match" | "MISMATCH";
}

async function main() {
  const [allDrinks, allClients, allComponents, allRecipes, allLines, allChildRows, allSkus] =
    await Promise.all([
      db.select().from(drinks),
      db.select().from(clients),
      db.select().from(components),
      db.select().from(recipes),
      db.select().from(recipeLines),
      db.select().from(componentRecipes),
      db.select().from(skus),
    ]);

  const drinkById = new Map(allDrinks.map((d) => [d.id, d]));
  const clientById = new Map(allClients.map((c) => [c.id, c]));
  const compById = new Map(allComponents.map((c) => [c.id, c]));
  const linesByRecipe = new Map<number, RecipeLine[]>();
  for (const l of allLines) {
    const list = linesByRecipe.get(l.recipeId) ?? [];
    list.push(l);
    linesByRecipe.set(l.recipeId, list);
  }
  const childrenByParent = new Map<number, { childComponentId: number; quantity: string }[]>();
  for (const row of allChildRows) {
    const list = childrenByParent.get(row.parentComponentId) ?? [];
    list.push(row);
    childrenByParent.set(row.parentComponentId, list);
  }

  // Declared (label) ABV, keyed by the (drink, client) pair a recipe is for.
  // A drink sold in several sizes has several SKUs; they should all carry the
  // same label figure, so a disagreement is recorded rather than averaged away.
  interface DeclaredGroup {
    values: number[];
    codes: string[];
    missing: number;
  }
  const declaredByDrinkClient = new Map<string, DeclaredGroup>();
  const dcKey = (drinkId: number, clientId: number) => `${drinkId}|${clientId}`;

  for (const s of allSkus) {
    if (s.drinkId === null || s.clientId === null) continue;
    const key = dcKey(s.drinkId, s.clientId);
    const g = declaredByDrinkClient.get(key) ?? { values: [], codes: [], missing: 0 };
    if (s.declaredAbv === null) {
      g.missing++;
    } else {
      g.values.push(n(s.declaredAbv));
      g.codes.push(s.code);
    }
    declaredByDrinkClient.set(key, g);
  }

  const skusWithDeclared = allSkus.filter((s) => s.declaredAbv !== null).length;

  function waterFraction(componentId: number, depth: number, problems: string[]): number {
    const c = compById.get(componentId);
    if (!c) {
      problems.push(`water resolution hit missing component ${componentId}`);
      return 0;
    }
    if (c.name === "Water") return 1;
    if (c.type !== "sub_recipe") return 0;
    if (depth >= SUB_RECIPE_DEPTH_CAP) {
      problems.push(`sub-recipe nesting under "${c.name}" exceeds depth ${SUB_RECIPE_DEPTH_CAP}`);
      return 0;
    }
    const children = childrenByParent.get(componentId) ?? [];
    if (children.length === 0) return 0;
    const qtySum = children.reduce((s, ch) => s + n(ch.quantity), 0);
    let denom = n(c.batchYield);
    if (denom <= 0) denom = qtySum;
    if (denom <= 0) return 0;
    let water = 0;
    for (const ch of children) {
      water += n(ch.quantity) * waterFraction(ch.childComponentId, depth + 1, problems);
    }
    return water / denom;
  }

  const reports: RecipeReport[] = [];

  for (const recipe of allRecipes) {
    const drink = drinkById.get(recipe.drinkId);
    const client = clientById.get(recipe.clientId);
    if (!drink || !client) continue;

    const rlines = (linesByRecipe.get(recipe.id) ?? []).slice().sort((a, b) => a.displayOrder - b.displayOrder);
    const lineReports: LineReport[] = [];
    const nullAbvComponents: string[] = [];
    let pctSum = 0;
    let abv = 0;
    let waterPctTotal = 0;
    const waterProblems: string[] = [];

    for (const line of rlines) {
      const c = compById.get(line.componentId);
      const pct = n(line.percentage);
      pctSum += pct;
      const cabv = c && c.abv !== null ? n(c.abv) : null;
      lineReports.push({
        componentId: line.componentId,
        componentName: c?.name ?? `MISSING COMPONENT ${line.componentId}`,
        percentage: pct,
        abv: cabv,
      });
      if (!c) continue;
      if (c.abv === null) {
        nullAbvComponents.push(c.name);
      } else {
        abv += (cabv! * pct) / 100;
      }
      waterPctTotal += pct * waterFraction(line.componentId, 0, waterProblems);
    }

    abv = round(abv);
    waterPctTotal = round(waterPctTotal);

    let crossCheck: RecipeReport["crossCheck"] = "not-current";
    if (recipe.isCurrent) {
      const real = await abvComputed(recipe.drinkId, client.slug);
      const realWater = await canonWaterPct(recipe.drinkId, client.slug);
      const abvAgrees = real.problems.length === 0 && round(real.abv) === abv;
      const waterAgrees = realWater.problems.length === 0 && round(realWater.waterPct) === waterPctTotal;
      crossCheck = abvAgrees && waterAgrees ? "match" : "MISMATCH";
      if (crossCheck === "MISMATCH") {
        console.error(
          `CROSS-CHECK MISMATCH recipe ${recipe.id} (${drink.name}/${client.slug}): ` +
            `replicated abv=${abv} vs canon.ts abv=${round(real.abv)}; ` +
            `replicated water=${waterPctTotal} vs canon.ts water=${round(realWater.waterPct)}`,
        );
      }
    }

    // Gate 1: the computed ABV against what the bottle actually says.
    //
    // The verdict comes from the app's own gateOne, never from arithmetic
    // repeated here. gateOne rounds both figures to label precision (1dp)
    // before comparing, because that is the precision a label is printed at
    // and declared_abv is stored at. An earlier version of this script
    // compared at 2dp and reported seven failures that gateOne does not:
    // a tool that is stricter than the gate it reports on is just as wrong
    // as one that is more lenient.
    const declared = declaredByDrinkClient.get(dcKey(recipe.drinkId, recipe.clientId));
    const distinct = [...new Set((declared?.values ?? []).map((v) => round(v, 1)))];
    const declaredAbv = distinct.length > 0 ? distinct[0] : null;
    const verdict = gateOne(abv, declaredAbv);
    const gap = verdict.gap;

    reports.push({
      recipe,
      drink,
      client,
      lines: lineReports,
      pctSum: round(pctSum, 3),
      pctSumOffByMoreThan001: Math.abs(pctSum - 100) > PCT_SUM_TOLERANCE,
      computedAbv: abv,
      nullAbvComponents,
      waterPct: waterPctTotal,
      waterOutOfRange: waterPctTotal < WATER_MIN || waterPctTotal > WATER_MAX,
      declaredAbv,
      declaredFromSkus: declared?.codes ?? [],
      declaredDisagrees: distinct.length > 1,
      skusMissingDeclared: declared?.missing ?? 0,
      gap,
      gapFail: verdict.status === "unverified" ? null : verdict.status === "fail",
      crossCheck,
    });
  }

  // Worst first: percentage-sum failures (by size of the error), then Gate 1
  // ABV failures (by size of the gap), then recipes with null-ABV components,
  // then water out of range, then the rest, each group sorted by drink name
  // for stability.
  reports.sort((a, b) => {
    const aBad = Math.abs(a.pctSum - 100);
    const bBad = Math.abs(b.pctSum - 100);
    if (a.pctSumOffByMoreThan001 !== b.pctSumOffByMoreThan001) {
      return a.pctSumOffByMoreThan001 ? -1 : 1;
    }
    if (a.pctSumOffByMoreThan001 && bBad !== aBad) return bBad - aBad;
    if (!!a.gapFail !== !!b.gapFail) return a.gapFail ? -1 : 1;
    if (a.gapFail && b.gapFail && a.gap !== b.gap) return (b.gap ?? 0) - (a.gap ?? 0);
    const aNull = a.nullAbvComponents.length > 0;
    const bNull = b.nullAbvComponents.length > 0;
    if (aNull !== bNull) return aNull ? -1 : 1;
    if (a.waterOutOfRange !== b.waterOutOfRange) return a.waterOutOfRange ? -1 : 1;
    return `${a.drink.name}|${a.client.slug}|${a.recipe.version}`.localeCompare(
      `${b.drink.name}|${b.client.slug}|${b.recipe.version}`,
    );
  });

  console.log("=".repeat(100));
  console.log("BACK BAR RECIPE AUDIT — read-only, run " + new Date().toISOString());
  console.log("=".repeat(100));
  console.log(
    `\nGATE 1 — computed ABV vs the printed label, tolerance ${ABV_GAP_FAIL_THRESHOLD} points.` +
      `\nDeclared figures read from skus.declared_abv: ${skusWithDeclared} of ${allSkus.length} SKUs carry one.` +
      `\nA recipe with no declared figure is UNVERIFIED, not passing: nobody has read that bottle.`,
  );

  console.log(`\nTotal recipe rows in the database: ${allRecipes.length} (across ${allDrinks.length} drinks, ${allSkus.length} SKUs)\n`);

  const widths = { drink: 26, client: 7, id: 4, ver: 4, cur: 4, abv: 9, water: 9, pct: 10, nullc: 5, xchk: 8 };
  console.log(
    pad("drink", widths.drink) +
      pad("client", widths.client) +
      pad("id", widths.id) +
      pad("ver", widths.ver) +
      pad("cur", widths.cur) +
      pad("pct sum", widths.pct) +
      pad("comp ABV", widths.abv) +
      pad("water%", widths.water) +
      pad("null-abv", widths.nullc) +
      pad("x-check", widths.xchk) +
      "declared ABV / gap / FAIL",
  );
  console.log("-".repeat(130));

  let pctFailCount = 0;
  let nullAbvRecipeCount = 0;
  let waterOutCount = 0;
  let currentCount = 0;
  let mismatchCount = 0;
  let gateCheckedCount = 0;
  let gateFailCount = 0;
  let gateUnverifiedCount = 0;
  let declaredDisagreeCount = 0;

  for (const r of reports) {
    if (r.pctSumOffByMoreThan001) pctFailCount++;
    if (r.nullAbvComponents.length > 0) nullAbvRecipeCount++;
    if (r.waterOutOfRange) waterOutCount++;
    if (r.recipe.isCurrent) currentCount++;
    if (r.crossCheck === "MISMATCH") mismatchCount++;
    if (r.gapFail === null) gateUnverifiedCount++;
    else {
      gateCheckedCount++;
      if (r.gapFail) gateFailCount++;
    }
    if (r.declaredDisagrees) declaredDisagreeCount++;

    const pctFlag = r.pctSumOffByMoreThan001 ? " !!" : "";
    const waterFlag = r.waterOutOfRange ? " !!" : "";
    console.log(
      pad(r.drink.name, widths.drink) +
        pad(r.client.slug, widths.client) +
        pad(r.recipe.id, widths.id) +
        pad(r.recipe.version, widths.ver) +
        pad(r.recipe.isCurrent ? "Y" : "n", widths.cur) +
        pad(r.pctSum.toFixed(3) + pctFlag, widths.pct) +
        pad(r.computedAbv.toFixed(2) + "%", widths.abv) +
        pad(r.waterPct.toFixed(1) + "%" + waterFlag, widths.water) +
        pad(r.nullAbvComponents.length || "", widths.nullc) +
        pad(r.crossCheck === "not-current" ? "-" : r.crossCheck, widths.xchk) +
        (r.declaredAbv === null
          ? "UNVERIFIED — no label figure on any SKU"
          : `${r.declaredAbv.toFixed(1)}% / ${r.gap!.toFixed(2)} / ${r.gapFail ? "FAIL" : "pass"}`),
    );
    if (r.nullAbvComponents.length > 0) {
      console.log(`${" ".repeat(widths.drink)}  null-ABV components: ${r.nullAbvComponents.join(", ")}`);
    }
    if (r.declaredDisagrees) {
      console.log(
        `${" ".repeat(widths.drink)}  !! SKU sizes disagree on the label ABV: ${r.declaredFromSkus.join(", ")}`,
      );
    }
    if (r.declaredAbv !== null && r.skusMissingDeclared > 0) {
      console.log(
        `${" ".repeat(widths.drink)}  ${r.skusMissingDeclared} further SKU(s) for this drink carry no label figure`,
      );
    }
  }

  console.log("\n" + "=".repeat(100));
  console.log("COUNTS");
  console.log("=".repeat(100));
  console.log(`Total recipe rows audited: ${reports.length} (${currentCount} current, ${reports.length - currentCount} historical/non-current)`);
  console.log(`Percentage-sum failures (off by more than ${PCT_SUM_TOLERANCE} points): ${pctFailCount}`);
  console.log(`Recipes with at least one NULL-ABV component (computed ABV is understated): ${nullAbvRecipeCount}`);
  console.log(`Recipes with water % outside ${WATER_MIN}-${WATER_MAX}%: ${waterOutCount}`);
  console.log(`Recipes with a declared ABV to check against, read from skus.declared_abv: ${gateCheckedCount} of ${reports.length}`);
  console.log(`Recipes UNVERIFIED (no label figure on any matching SKU — nobody has read the bottle): ${gateUnverifiedCount}`);
  console.log(`Recipes that FAIL the ${ABV_GAP_FAIL_THRESHOLD}-point Gate 1 test: ${gateFailCount} of ${gateCheckedCount} checked`);
  console.log(`Drinks whose SKU sizes disagree with each other on the label ABV: ${declaredDisagreeCount}`);
  console.log(`Cross-check of this script's replicated formulas against the app's real canon.ts, on all ${currentCount} current recipes: ${currentCount - mismatchCount} matched, ${mismatchCount} MISMATCH`);

  if (mismatchCount > 0) {
    console.log("\n!!! At least one recipe's replicated ABV/water disagreed with canon.ts. See CROSS-CHECK MISMATCH lines above. !!!");
    process.exitCode = 1;
  }
  if (pctFailCount > 0) {
    console.log(`\n!!! ${pctFailCount} recipe(s) do not sum to 100%. !!!`);
    process.exitCode = 1;
  }
  if (gateFailCount > 0) {
    console.log(
      `\n!!! ${gateFailCount} recipe(s) fail Gate 1: the computed ABV is more than ${ABV_GAP_FAIL_THRESHOLD} points\n` +
        "from what the label says. Either the recipe is wrong or the bottle is mislabelled. !!!",
    );
    process.exitCode = 1;
  }
  if (declaredDisagreeCount > 0) {
    console.log(`\n!!! ${declaredDisagreeCount} drink(s) have sizes claiming different label ABVs. !!!`);
    process.exitCode = 1;
  }

  process.exit(process.exitCode ?? 0);
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
