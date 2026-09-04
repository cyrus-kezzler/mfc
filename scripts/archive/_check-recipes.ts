/** Read-only: show recipe lines for named drinks, to check for a dilution line. */
import { eq, and } from "drizzle-orm";
import { db } from "../../src/db";
import { components, drinks, clients, recipes, recipeLines } from "../../src/db/schema";

const TARGETS = ["Manhattan", "Negroni", "Espresso Martini", "Vesper Martini", "Baby Otis"];

async function main() {
  const allDrinks = await db.select().from(drinks);
  const allClients = await db.select().from(clients);
  const allComponents = await db.select().from(components);
  const compById = new Map(allComponents.map((c) => [c.id, c]));
  const clientById = new Map(allClients.map((c) => [c.id, c]));

  for (const name of TARGETS) {
    const d = allDrinks.find((x) => x.name === name);
    if (!d) continue;
    const rs = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.drinkId, d.id), eq(recipes.isCurrent, true)));
    for (const r of rs) {
      const lines = await db.select().from(recipeLines).where(eq(recipeLines.recipeId, r.id));
      const total = lines.reduce((s, l) => s + Number(l.percentage), 0);
      console.log(`\n${name} [${clientById.get(r.clientId)?.name}] recipe ${r.id}, lines sum ${total}%`);
      for (const l of lines.sort((a, b) => Number(b.percentage) - Number(a.percentage))) {
        const c = compById.get(l.componentId);
        const per = Number(c?.packSize) > 1 ? Number(c?.packCost) / Number(c?.packSize) : Number(c?.unitCost);
        console.log(
          `   ${String(l.percentage).padStart(8)}%  ${(c?.name ?? "?").padEnd(36)} £${per.toFixed(6)}/${c?.uom}  type=${c?.type}`,
        );
      }
    }
  }

  console.log("\n=== ANY COMPONENT THAT LOOKS LIKE WATER OR DILUTION ===");
  for (const c of allComponents) {
    if (/water|dilut|saline|syrup|sours/i.test(c.name)) {
      const per = Number(c.packSize) > 1 ? Number(c.packCost) / Number(c.packSize) : Number(c.unitCost);
      console.log(`   ${String(c.id).padStart(3)} ${c.name.padEnd(40)} £${per.toFixed(6)}/${c.uom} active=${c.active}`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
