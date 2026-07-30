/** Read-only: implied ABV per recipe from component ABVs, to find missing water. */
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { components, drinks, clients, recipes, recipeLines } from "../../src/db/schema";

function pad(s: unknown, n: number) {
  const t = String(s ?? "");
  return t.length > n ? t.slice(0, n - 1) + "…" : t.padEnd(n);
}

async function main() {
  const [allDrinks, allClients, allComponents, allRecipes, allLines] = await Promise.all([
    db.select().from(drinks),
    db.select().from(clients),
    db.select().from(components),
    db.select().from(recipes).where(eq(recipes.isCurrent, true)),
    db.select().from(recipeLines),
  ]);
  const compById = new Map(allComponents.map((c) => [c.id, c]));
  const drinkById = new Map(allDrinks.map((d) => [d.id, d]));
  const clientById = new Map(allClients.map((c) => [c.id, c]));

  const withAbv = allComponents.filter((c) => c.abv !== null && c.abv !== undefined);
  console.log(`Components: ${allComponents.length} total, ${withAbv.length} carry an ABV\n`);

  console.log(`${pad("drink", 28)}${pad("client", 17)}${pad("impliedABV", 12)}${pad("missingABV", 12)}water?`);
  console.log("-".repeat(82));

  const rows = allRecipes
    .map((r) => {
      const lines = allLines.filter((l) => l.recipeId === r.id);
      let abvSum = 0;
      const missing: string[] = [];
      let hasWaterish = false;
      for (const l of lines) {
        const c = compById.get(l.componentId);
        if (!c) continue;
        if (/water|sours/i.test(c.name)) hasWaterish = true;
        if (c.abv === null || c.abv === undefined) {
          missing.push(c.name);
          continue;
        }
        abvSum += (Number(l.percentage) / 100) * Number(c.abv);
      }
      return {
        drink: drinkById.get(r.drinkId)?.name ?? "?",
        client: clientById.get(r.clientId)?.name ?? "?",
        implied: abvSum,
        missing,
        hasWaterish,
      };
    })
    .sort((a, b) => b.implied - a.implied);

  for (const r of rows) {
    console.log(
      `${pad(r.drink, 28)}${pad(r.client, 17)}${pad(r.implied.toFixed(1) + "%", 12)}${pad(r.missing.length || "", 12)}${r.hasWaterish ? "yes" : ""}`,
    );
  }

  const allMissing = new Set<string>();
  rows.forEach((r) => r.missing.forEach((m) => allMissing.add(m)));
  if (allMissing.size > 0) {
    console.log(`\nComponents used in recipes with NO ABV recorded (${allMissing.size}):`);
    for (const m of [...allMissing].sort()) console.log(`   ${m}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
