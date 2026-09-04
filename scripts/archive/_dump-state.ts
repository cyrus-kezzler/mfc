/**
 * Read-only state dump. Scratch, safe to delete.
 *
 *   npx tsx --env-file=.env.local scripts/erp/_dump-state.ts
 *
 * Writes a full JSON snapshot to scripts/erp/_state-dump.json and prints a
 * compact summary. Makes no writes of any kind.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { db } from "../../src/db";
import {
  components,
  componentPriceHistory,
  systemSettings,
  suppliers,
  clients,
  drinks,
  recipes,
  recipeLines,
  skus,
} from "../../src/db/schema";

function pad(s: unknown, n: number): string {
  const str = String(s ?? "");
  return str.length > n ? str.slice(0, n - 1) + "…" : str.padEnd(n);
}

async function main() {
  const [
    allComponents,
    allHistory,
    allSettings,
    allSuppliers,
    allClients,
    allDrinks,
    allRecipes,
    allRecipeLines,
    allSkus,
  ] = await Promise.all([
    db.select().from(components),
    db.select().from(componentPriceHistory),
    db.select().from(systemSettings),
    db.select().from(suppliers),
    db.select().from(clients),
    db.select().from(drinks),
    db.select().from(recipes),
    db.select().from(recipeLines),
    db.select().from(skus),
  ]);

  const snapshot = {
    dumpedAt: new Date().toISOString(),
    counts: {
      components: allComponents.length,
      componentPriceHistory: allHistory.length,
      systemSettings: allSettings.length,
      suppliers: allSuppliers.length,
      clients: allClients.length,
      drinks: allDrinks.length,
      recipes: allRecipes.length,
      recipeLines: allRecipeLines.length,
      skus: allSkus.length,
    },
    components: allComponents,
    componentPriceHistory: allHistory,
    systemSettings: allSettings,
    suppliers: allSuppliers,
    clients: allClients,
    drinks: allDrinks,
    recipes: allRecipes,
    recipeLines: allRecipeLines,
    skus: allSkus,
  };

  const out = resolve(process.cwd(), "scripts/erp/_state-dump.json");
  writeFileSync(out, JSON.stringify(snapshot, null, 2));

  console.log("=== COUNTS ===");
  console.log(JSON.stringify(snapshot.counts, null, 2));

  console.log("\n=== SYSTEM SETTINGS ===");
  for (const s of allSettings) console.log(`  ${pad(s.key, 28)} ${s.value}`);

  console.log("\n=== CLIENTS ===");
  for (const c of allClients) console.log(`  ${JSON.stringify(c)}`);

  console.log("\n=== NON-INGREDIENT COMPONENTS (dry_good / packaging) ===");
  console.log(
    `  ${pad("id", 5)}${pad("name", 42)}${pad("type", 11)}${pad("uom", 6)}${pad("packSize", 10)}${pad("packCost", 10)}${pad("unitCost", 11)}${pad("setAt", 12)}act`,
  );
  for (const c of allComponents
    .filter((c) => c.type === "dry_good" || c.type === "packaging")
    .sort((a, b) => a.id - b.id)) {
    console.log(
      `  ${pad(c.id, 5)}${pad(c.name, 42)}${pad(c.type, 11)}${pad(c.uom, 6)}${pad(c.packSize, 10)}${pad(c.packCost, 10)}${pad(c.unitCost, 11)}${pad(String(c.unitCostSetAt ?? "").slice(0, 10), 12)}${c.active ? "Y" : "N"}`,
    );
  }

  console.log("\n=== SKUS ===");
  for (const s of allSkus) console.log(`  ${JSON.stringify(s)}`);

  console.log("\n=== DRINKS x RECIPES (client scoped) ===");
  const clientById = new Map(allClients.map((c) => [c.id, c]));
  const drinkById = new Map(allDrinks.map((d) => [d.id, d]));
  for (const r of allRecipes) {
    const d = drinkById.get(r.drinkId as never);
    const cl = clientById.get(r.clientId as never);
    const lineCount = allRecipeLines.filter((l) => l.recipeId === r.id).length;
    console.log(
      `  recipe=${pad(r.id, 38)} drink=${pad((d as { name?: string } | undefined)?.name, 30)} client=${pad((cl as { name?: string } | undefined)?.name, 20)} lines=${lineCount}`,
    );
  }

  console.log(`\nFull snapshot written to ${out}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("DUMP FAILED:", e);
  process.exit(1);
});
