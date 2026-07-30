/**
 * Speed Rail seed — Drinks / Recipes / SKUs layer.
 *
 * Runs as part of `npm run db:seed` (called from seed.ts after the component
 * and settings seed). Idempotent:
 *   - clients / drinks / skus upsert by their unique key (slug / code)
 *   - ingredient components upsert by name (case-insensitive)
 *   - a recipe is only created if the (drink, client) pair has no current
 *     recipe yet — re-running never bumps versions or duplicates lines
 *
 * Source: "Drinks, Recipes, and the Calculator rebuild" brief (2026-06-02).
 *
 * Ingredient prices/sizes are migrated from the legacy file-based master
 * (src/data/ingredient-price-history.json + ingredients.ts). The 11 net-new
 * components and Water carry the brief's placeholder prices — Cyrus corrects
 * these via the price-history page as real invoices land.
 */

import { eq, sql, and } from "drizzle-orm";

import { db } from "../../src/db";
import {
  clients,
  drinks,
  recipes,
  recipeLines,
  skus,
  components,
  componentPriceHistory,
  type NewComponent,
} from "../../src/db/schema";

// ─── Component master (every ingredient the recipes reference) ───────────────
// Names here are canonical — recipe lines below resolve against them. The eight
// that Slice 1's components.csv already seeds use the CSV's exact names so the
// idempotent upsert recognises them rather than creating duplicates.
//
// price = pack_cost over a full pack of pack_size ml. unit_cost derives as
// pack_cost / pack_size (£/ml), matching the foundation's cost engine.

type SeedComponent = {
  name: string;
  packSizeMl: number;
  packCost: number;
  abv?: number;
  notes?: string;
};

const INGREDIENTS: SeedComponent[] = [
  // — already in components.csv (canonical names kept identical) —
  { name: "Gin (in-house)", packSizeMl: 1000, packCost: 22.5, abv: 41.2 },
  { name: "Vodka (Bimber)", packSizeMl: 1000, packCost: 27.8, abv: 37.5 },
  { name: "Rye", packSizeMl: 700, packCost: 28.02, abv: 45.0 },
  { name: "Campari", packSizeMl: 700, packCost: 15.17, abv: 25.0 },
  { name: "Cocchi Torino", packSizeMl: 750, packCost: 18.05, abv: 16.5 },
  { name: "Lillet Blanc", packSizeMl: 750, packCost: 14.42 },
  { name: "Kahlua", packSizeMl: 700, packCost: 13.43, abv: 16.5 },
  { name: "Myatt's Sours", packSizeMl: 1000, packCost: 5.0 },

  // — migrated from the legacy master (real buying-spreadsheet prices) —
  { name: "Havana Club 7", packSizeMl: 700, packCost: 21.05 },
  { name: "Cocchi Americano", packSizeMl: 750, packCost: 19.8 },
  { name: "Coffee", packSizeMl: 1000, packCost: 4.0, notes: "Brewed coffee, per litre" },
  { name: "Blue Curaçao", packSizeMl: 700, packCost: 11.73 },
  { name: "Calvados", packSizeMl: 700, packCost: 18.95 },
  { name: "La Fée Absinthe", packSizeMl: 700, packCost: 45.99 },
  { name: "Monin Grenadine", packSizeMl: 1000, packCost: 9.35 },
  { name: "Epsolon Blanco Tequila", packSizeMl: 700, packCost: 23.8 },
  { name: "Noilly Prat", packSizeMl: 750, packCost: 12.77 },
  { name: "Lychee Liqueur", packSizeMl: 700, packCost: 17.85 },
  { name: "Carpano Antica Formula Vermouth", packSizeMl: 750, packCost: 24.7 },
  { name: "Triple Sec", packSizeMl: 700, packCost: 21.62 },
  { name: "Agave Syrup", packSizeMl: 1000, packCost: 6.0 },
  { name: "Mezcal", packSizeMl: 700, packCost: 35.8 },
  { name: "Yellow Chartreuse", packSizeMl: 700, packCost: 36.68 },
  { name: "Aperol", packSizeMl: 1000, packCost: 13.1 },
  { name: "Pisco Aba", packSizeMl: 700, packCost: 14.78 },
  { name: "Mount Gay Rum", packSizeMl: 700, packCost: 17.46 },
  { name: "Punt e Mes", packSizeMl: 750, packCost: 10.96 },
  { name: "Luxardo Maraschino", packSizeMl: 500, packCost: 27.03 },
  { name: "Ginjo Sake", packSizeMl: 300, packCost: 9.98 },
  { name: "Akvavit", packSizeMl: 700, packCost: 27.93 },
  { name: "Manzanilla", packSizeMl: 750, packCost: 9.75 },
  { name: "Cynar", packSizeMl: 700, packCost: 12.85 },
  { name: "Old Tom Gin", packSizeMl: 700, packCost: 20.74 },
  { name: "Fino Sherry", packSizeMl: 750, packCost: 9.64 },
  { name: "Cotswold Whisky", packSizeMl: 700, packCost: 20.0 },
  { name: "Chinotto Nero", packSizeMl: 750, packCost: 22.57 },
  { name: "Heering Cherry", packSizeMl: 750, packCost: 22.25 },

  // — net-new components (brief §3) — placeholder prices, Cyrus to correct —
  { name: "Scratch (white rum)", packSizeMl: 700, packCost: 25.0, notes: "New house white rum; placeholder until supplier deal lands" },
  { name: "Espresso", packSizeMl: 1000, packCost: 6.0, notes: "Priced per litre, fresh" },
  { name: "1:1 Sugar Syrup", packSizeMl: 1000, packCost: 2.0, notes: "House-made, per litre" },
  { name: "Mozart Chocolate Liqueur", packSizeMl: 500, packCost: 20.0 },
  { name: "Jerez (Pedro Ximénez)", packSizeMl: 750, packCost: 15.0 },
  { name: "Black Bottle Whisky", packSizeMl: 700, packCost: 25.0 },
  { name: "Apple Juice", packSizeMl: 1000, packCost: 3.0, notes: "Priced per litre" },
  { name: "Oat Milk", packSizeMl: 1000, packCost: 1.5, notes: "Priced per litre" },
  { name: "Shipwreck Rum", packSizeMl: 700, packCost: 22.0 },
  { name: "Fernet Branca", packSizeMl: 700, packCost: 18.0 },
  { name: "Maple Syrup", packSizeMl: 500, packCost: 8.0 },

  // F&M 2026 distillery editions (Cyrus recipes, 2026-07-15), placeholder prices
  { name: "Somerset Cider Brandy", packSizeMl: 500, packCost: 30.0, notes: "Apples & Pears. Placeholder price - correct via price page." },
  { name: "Belle de Brillet (pear liqueur)", packSizeMl: 700, packCost: 15.0, notes: "Apples & Pears. Poire Williams + cognac liqueur, ~30% ABV. Placeholder price (likely ~£30+), correct via price page." },
  { name: "Suze", packSizeMl: 700, packCost: 22.0, notes: "Apples & Pears. Gentian aperitif. Placeholder." },
  { name: "Clarified Apple Juice (house)", packSizeMl: 1000, packCost: 3.0, notes: "Apples & Pears. Per litre. Placeholder. Confirm vs 'Apple Juice'." },
  { name: "Angostura Bitters", packSizeMl: 148, packCost: 12.0, notes: "Apples & Pears bitters (label-confirmed 15 Jul; was Peychaud's from an old recipe). Placeholder." },
  { name: "Ginger Amalthea Gin", packSizeMl: 1000, packCost: 16.63, notes: "Christmas Gingertini. Confirm vs 'Gin (Amalthea)'. Placeholder." },
  { name: "Cranberry & Hibiscus Syrup (house)", packSizeMl: 1000, packCost: 4.0, notes: "Christmas Gingertini. House 1:2 syrup, cranberry & hibiscus (label-confirmed 15 Jul). Per litre. Placeholder." },
  { name: "Passoã", packSizeMl: 700, packCost: 14.0, notes: "Christmas Gingertini. Passionfruit liqueur. Placeholder." },
  { name: "Ginger Liqueur", packSizeMl: 500, packCost: 18.0, notes: "Christmas Gingertini. Placeholder. Not in F&M declaration - reconcile." },

  // — Water sentinel (£0) so the cost rollup needs no special-casing —
  { name: "Water", packSizeMl: 1000, packCost: 0.0, notes: "Dilution; £0 sentinel for cost rollup" },
];

// ─── Clients ─────────────────────────────────────────────────────────────────

const CLIENT_SEED = [
  { slug: "mfc", name: "Myatt's Fields", isDefault: true, displayOrder: 1 },
  { slug: "fm", name: "Fortnum & Mason", isDefault: false, displayOrder: 2 },
  { slug: "cripps", name: "Cripps", isDefault: false, displayOrder: 3 },
];

// ─── Drinks ──────────────────────────────────────────────────────────────────

type DrinkSeed = { slug: string; name: string; status: "active" | "archived" };

const DRINK_SEED: DrinkSeed[] = [
  { slug: "baby-otis", name: "Baby Otis", status: "active" },
  { slug: "cold-brew-negroni", name: "Cold Brew Negroni", status: "active" },
  { slug: "corpse-reviver", name: "Corpse Reviver", status: "active" },
  { slug: "dempsey", name: "Dempsey", status: "active" },
  { slug: "desert-negroni", name: "Desert Negroni", status: "active" },
  { slug: "espresso-martini", name: "Espresso Martini", status: "active" },
  { slug: "gibson-martini", name: "Gibson Martini", status: "active" },
  { slug: "lychee-martini", name: "Lychee Martini", status: "active" },
  { slug: "manhattan", name: "Manhattan", status: "active" },
  { slug: "margarita", name: "Margarita", status: "active" },
  { slug: "naked-and-famous", name: "Naked & Famous", status: "active" },
  { slug: "negroni", name: "Negroni", status: "active" },
  { slug: "pisco-martini", name: "Pisco Martini", status: "active" },
  { slug: "rum-old-fashioned", name: "Rum Old Fashioned", status: "active" },
  { slug: "red-hook", name: "Red Hook", status: "active" },
  { slug: "sakura-martini", name: "Sakura Martini", status: "active" },
  { slug: "trident", name: "Trident", status: "active" },
  { slug: "tuxedo", name: "Tuxedo", status: "active" },
  { slug: "vesper", name: "Vesper Martini", status: "active" },
  { slug: "espresso-daiquiri", name: "Espresso Daiquiri", status: "active" },
  { slug: "robin-roy", name: "Robin Roy", status: "active" },
  { slug: "clementini", name: "Clementini", status: "archived" },
  { slug: "griotte", name: "Griotte", status: "active" },
  { slug: "apple-crumble", name: "Apple Crumble", status: "active" },
  { slug: "autumn-nectar", name: "Autumn Nectar", status: "active" },
  { slug: "apples-and-pears", name: "Apples & Pears", status: "active" },
  { slug: "christmas-gingertini", name: "Christmas Gingertini", status: "active" },
];

// ─── Recipes (drink × client → percentage lines) ─────────────────────────────

type RecipeSeed = {
  drinkSlug: string;
  clientSlug: string;
  lines: [string, number][];
  method?: string;
};

const RECIPE_SEED: RecipeSeed[] = [
  // — MFC —
  { drinkSlug: "baby-otis", clientSlug: "mfc", lines: [["Havana Club 7", 50], ["Cocchi Torino", 25], ["Cocchi Americano", 25]] },
  {
    drinkSlug: "cold-brew-negroni",
    clientSlug: "mfc",
    lines: [["Gin (in-house)", 33], ["Cocchi Torino", 33], ["Campari", 33], ["Coffee", 1]],
    method: "Infuse with 3 coffee beans per 700ml for 20 minutes before production",
  },
  { drinkSlug: "corpse-reviver", clientSlug: "mfc", lines: [["Gin (in-house)", 25], ["Lillet Blanc", 25], ["Blue Curaçao", 25], ["Myatt's Sours", 25]] },
  { drinkSlug: "dempsey", clientSlug: "mfc", lines: [["Gin (in-house)", 48], ["Calvados", 48], ["La Fée Absinthe", 2], ["Monin Grenadine", 2]] },
  { drinkSlug: "desert-negroni", clientSlug: "mfc", lines: [["Epsolon Blanco Tequila", 33.3], ["Cocchi Torino", 33.3], ["Campari", 33.4]] },
  { drinkSlug: "espresso-martini", clientSlug: "mfc", lines: [["Vodka (Bimber)", 33], ["Kahlua", 33], ["Coffee", 34]] },
  {
    drinkSlug: "gibson-martini",
    clientSlug: "mfc",
    lines: [["Gin (in-house)", 80], ["Noilly Prat", 10], ["Water", 10]],
    method: "Infuse with one silverskin pickled onion per 700ml for two hours before production",
  },
  { drinkSlug: "lychee-martini", clientSlug: "mfc", lines: [["Gin (in-house)", 52.17], ["Lychee Liqueur", 26.09], ["Noilly Prat", 13.04], ["Water", 8.7]] },
  { drinkSlug: "manhattan", clientSlug: "mfc", lines: [["Rye", 66], ["Carpano Antica Formula Vermouth", 17], ["Cocchi Torino", 17]] },
  { drinkSlug: "margarita", clientSlug: "mfc", lines: [["Epsolon Blanco Tequila", 50], ["Myatt's Sours", 22.5], ["Triple Sec", 22.5], ["Agave Syrup", 5]] },
  { drinkSlug: "naked-and-famous", clientSlug: "mfc", lines: [["Mezcal", 25], ["Yellow Chartreuse", 25], ["Aperol", 25], ["Myatt's Sours", 25]] },
  { drinkSlug: "negroni", clientSlug: "mfc", lines: [["Gin (in-house)", 33.3], ["Carpano Antica Formula Vermouth", 16.5], ["Cocchi Torino", 16.5], ["Campari", 33.7]] },
  { drinkSlug: "pisco-martini", clientSlug: "mfc", lines: [["Gin (in-house)", 25], ["Pisco Aba", 25], ["Noilly Prat", 25], ["Cocchi Torino", 25]] },
  { drinkSlug: "rum-old-fashioned", clientSlug: "mfc", lines: [["Mount Gay Rum", 88], ["1:1 Sugar Syrup", 12]] },
  { drinkSlug: "red-hook", clientSlug: "mfc", lines: [["Rye", 61], ["Punt e Mes", 17], ["Luxardo Maraschino", 11], ["Water", 11]] },
  { drinkSlug: "sakura-martini", clientSlug: "mfc", lines: [["Ginjo Sake", 61], ["Gin (in-house)", 24], ["Luxardo Maraschino", 6], ["Water", 9]] },
  { drinkSlug: "trident", clientSlug: "mfc", lines: [["Akvavit", 33.3], ["Manzanilla", 33.3], ["Cynar", 33.4]] },
  { drinkSlug: "tuxedo", clientSlug: "mfc", lines: [["Old Tom Gin", 60], ["Noilly Prat", 15], ["Fino Sherry", 14], ["La Fée Absinthe", 1], ["Water", 10]] },
  { drinkSlug: "vesper", clientSlug: "mfc", lines: [["Gin (in-house)", 66.7], ["Vodka (Bimber)", 11.1], ["Lillet Blanc", 11.1], ["Cocchi Americano", 11.1]] },

  // — F&M —
  // F&M Vesper: ratio 6:1:1:1:1 (Gin:Vodka:Lillet:Cocchi:Water) = 10 parts × 10%.
  // Confirmed by Cyrus 2026-06-02.
  { drinkSlug: "vesper", clientSlug: "fm", lines: [["Gin (in-house)", 60], ["Vodka (Bimber)", 10], ["Lillet Blanc", 10], ["Cocchi Americano", 10], ["Water", 10]] },
  { drinkSlug: "espresso-daiquiri", clientSlug: "fm", lines: [["Scratch (white rum)", 33], ["Kahlua", 33], ["Espresso", 34]] },
  { drinkSlug: "robin-roy", clientSlug: "fm", lines: [["Cotswold Whisky", 56], ["Cocchi Torino", 28], ["Water", 16]] },
  { drinkSlug: "clementini", clientSlug: "fm", lines: [["Gin (in-house)", 45], ["Chinotto Nero", 25], ["Myatt's Sours", 25], ["Agave Syrup", 5]] },
  { drinkSlug: "griotte", clientSlug: "fm", lines: [["Mozart Chocolate Liqueur", 30], ["Heering Cherry", 20], ["Kahlua", 20], ["Jerez (Pedro Ximénez)", 30]] },
  { drinkSlug: "apple-crumble", clientSlug: "fm", lines: [["Black Bottle Whisky", 50], ["Apple Juice", 25], ["Oat Milk", 13], ["Water", 12]] },
  { drinkSlug: "autumn-nectar", clientSlug: "fm", lines: [["Shipwreck Rum", 70], ["Fernet Branca", 9], ["Maple Syrup", 9], ["Water", 12]] },

  // F&M 2026 distillery editions (Cyrus recipes, 2026-07-15)
  { drinkSlug: "apples-and-pears", clientSlug: "fm", lines: [["Somerset Cider Brandy", 15.385], ["Belle de Brillet (pear liqueur)", 15.385], ["Suze", 7.692], ["Clarified Apple Juice (house)", 30.769], ["Water", 30.769]], method: "Add 2 dashes Angostura bitters per 100ml of finished drink (11 dashes for a 550ml batch)." },
  { drinkSlug: "christmas-gingertini", clientSlug: "fm", lines: [["Ginger Amalthea Gin", 30.769], ["Cranberry & Hibiscus Syrup (house)", 15.385], ["Myatt's Sours", 30.769], ["Passoã", 15.385], ["Ginger Liqueur", 7.692]] },

  // — Cripps —
  { drinkSlug: "negroni", clientSlug: "cripps", lines: [["Gin (in-house)", 33.3], ["Carpano Antica Formula Vermouth", 16.5], ["Punt e Mes", 16.5], ["Campari", 33.7]] },
  { drinkSlug: "espresso-martini", clientSlug: "cripps", lines: [["Vodka (Bimber)", 33.3], ["Kahlua", 33.3], ["Espresso", 33.4]] },
];

// ─── SKUs (sellable bottle formats, migrated from the legacy GTIN map) ────────

type SkuSeed = { drinkSlug: string; sizeMl: number; gtin: string };

const SKU_SEED: SkuSeed[] = [
  { drinkSlug: "baby-otis", sizeMl: 250, gtin: "5060665000345" },
  { drinkSlug: "baby-otis", sizeMl: 500, gtin: "5060665000031" },
  { drinkSlug: "cold-brew-negroni", sizeMl: 250, gtin: "5060665000369" },
  { drinkSlug: "corpse-reviver", sizeMl: 250, gtin: "5060665000444" },
  { drinkSlug: "dempsey", sizeMl: 250, gtin: "5060665000291" },
  { drinkSlug: "dempsey", sizeMl: 500, gtin: "5060665000123" },
  { drinkSlug: "desert-negroni", sizeMl: 250, gtin: "5060665000314" },
  { drinkSlug: "desert-negroni", sizeMl: 500, gtin: "5060665000048" },
  { drinkSlug: "espresso-martini", sizeMl: 250, gtin: "5060665000246" },
  { drinkSlug: "espresso-martini", sizeMl: 500, gtin: "5060665000017" },
  { drinkSlug: "gibson-martini", sizeMl: 250, gtin: "5060665000352" },
  { drinkSlug: "lychee-martini", sizeMl: 250, gtin: "5060665000406" },
  { drinkSlug: "manhattan", sizeMl: 250, gtin: "5060665000277" },
  { drinkSlug: "manhattan", sizeMl: 500, gtin: "5060665000055" },
  { drinkSlug: "margarita", sizeMl: 250, gtin: "5060665000390" },
  { drinkSlug: "naked-and-famous", sizeMl: 250, gtin: "5060665000437" },
  { drinkSlug: "negroni", sizeMl: 250, gtin: "5060665000253" },
  { drinkSlug: "negroni", sizeMl: 500, gtin: "5060665000062" },
  { drinkSlug: "pisco-martini", sizeMl: 250, gtin: "5060665000260" },
  { drinkSlug: "pisco-martini", sizeMl: 500, gtin: "5060665000079" },
  { drinkSlug: "red-hook", sizeMl: 250, gtin: "5060665000420" },
  { drinkSlug: "rum-old-fashioned", sizeMl: 250, gtin: "5060665000307" },
  { drinkSlug: "rum-old-fashioned", sizeMl: 500, gtin: "5060665000086" },
  { drinkSlug: "sakura-martini", sizeMl: 250, gtin: "5060665000413" },
  { drinkSlug: "trident", sizeMl: 250, gtin: "5060665000338" },
  { drinkSlug: "trident", sizeMl: 500, gtin: "5060665000093" },
  { drinkSlug: "tuxedo", sizeMl: 250, gtin: "5060665000376" },
  { drinkSlug: "vesper", sizeMl: 250, gtin: "5060665000239" },
  { drinkSlug: "vesper", sizeMl: 500, gtin: "5060665000109" },
];

// ─── Seed logic ──────────────────────────────────────────────────────────────

function deriveUnitCost(packSizeMl: number, packCost: number): string {
  if (!Number.isFinite(packSizeMl) || packSizeMl <= 0) return "0";
  return (packCost / packSizeMl).toFixed(4);
}

/** Insert an ingredient component if no component with that name exists. */
async function upsertIngredient(c: SeedComponent): Promise<number> {
  const existing = await db
    .select({ id: components.id })
    .from(components)
    .where(sql`lower(${components.name}) = lower(${c.name})`)
    .limit(1);
  if (existing.length) return existing[0].id;

  const unitCost = deriveUnitCost(c.packSizeMl, c.packCost);
  const data: NewComponent = {
    name: c.name,
    type: "ingredient",
    uom: "ml",
    packSize: String(c.packSizeMl),
    packCost: c.packCost.toFixed(2),
    unitCost,
    unitCostSetAt: new Date(),
    abv: c.abv != null ? String(c.abv) : null,
    notes: c.notes ?? null,
  };
  const [inserted] = await db.insert(components).values(data).returning({ id: components.id });
  // Mirror the foundation's behaviour: every cost gets an initial history row.
  await db.insert(componentPriceHistory).values({
    componentId: inserted.id,
    unitCost,
    currency: "GBP",
    uom: "ml",
    effectiveDate: new Date().toISOString().slice(0, 10),
    source: "manual",
    notes: `Seed: pack ${c.packSizeMl}ml @ £${c.packCost.toFixed(2)}`,
  });
  return inserted.id;
}

export async function seedRecipeLayer() {
  // 1. Clients — upsert by slug, keep name / order current.
  for (const c of CLIENT_SEED) {
    await db
      .insert(clients)
      .values(c)
      .onConflictDoUpdate({
        target: clients.slug,
        set: { name: c.name, isDefault: c.isDefault, displayOrder: c.displayOrder, updatedAt: new Date() },
      });
  }
  console.log(`✓ Clients: ${CLIENT_SEED.length} upserted (mfc, fm, cripps).`);

  // 2. Drinks — upsert by slug, keep name / status current.
  for (const d of DRINK_SEED) {
    await db
      .insert(drinks)
      .values(d)
      .onConflictDoUpdate({
        target: drinks.slug,
        set: { name: d.name, status: d.status, updatedAt: new Date() },
      });
  }
  console.log(`✓ Drinks: ${DRINK_SEED.length} upserted (${DRINK_SEED.filter((d) => d.status === "archived").length} archived).`);

  // 3. Ingredient components — idempotent by name; build a name → id index.
  const componentIdByName = new Map<string, number>();
  for (const c of INGREDIENTS) {
    componentIdByName.set(c.name.toLowerCase(), await upsertIngredient(c));
  }
  console.log(`✓ Components: ${INGREDIENTS.length} ingredients ensured (incl. Water + 11 net-new).`);

  // Index clients / drinks by slug for FK resolution.
  const clientRows = await db.select({ id: clients.id, slug: clients.slug }).from(clients);
  const drinkRows = await db.select({ id: drinks.id, slug: drinks.slug }).from(drinks);
  const clientIdBySlug = new Map(clientRows.map((r) => [r.slug, r.id]));
  const drinkIdBySlug = new Map(drinkRows.map((r) => [r.slug, r.id]));

  // 4. Recipes — only create a v1 when (drink, client) has no current recipe.
  let created = 0;
  let skipped = 0;
  let backfilled = 0;
  for (const r of RECIPE_SEED) {
    const drinkId = drinkIdBySlug.get(r.drinkSlug);
    const clientId = clientIdBySlug.get(r.clientSlug);
    if (drinkId == null) throw new Error(`Recipe references unknown drink slug: ${r.drinkSlug}`);
    if (clientId == null) throw new Error(`Recipe references unknown client slug: ${r.clientSlug}`);

    const sum = Math.round(r.lines.reduce((a, [, p]) => a + p, 0) * 1000) / 1000;
    if (Math.abs(sum - 100) > 0.05) {
      throw new Error(`Recipe ${r.drinkSlug}/${r.clientSlug} lines sum to ${sum}, not 100`);
    }

    const current = await db
      .select({ id: recipes.id, method: recipes.method })
      .from(recipes)
      .where(and(eq(recipes.drinkId, drinkId), eq(recipes.clientId, clientId), eq(recipes.isCurrent, true)))
      .limit(1);
    if (current.length) {
      // Recipe already present — leave its lines untouched, but backfill the
      // seed's method onto the current row if it has none yet. Only fills NULLs,
      // so a method entered/edited in the UI is never clobbered by a re-seed.
      if (r.method && current[0].method == null) {
        await db.update(recipes).set({ method: r.method, updatedAt: new Date() }).where(eq(recipes.id, current[0].id));
        backfilled++;
      }
      skipped++;
      continue;
    }

    const [recipe] = await db
      .insert(recipes)
      .values({ drinkId, clientId, version: 1, isCurrent: true, method: r.method ?? null, createdBy: "seed" })
      .returning({ id: recipes.id });

    await db.insert(recipeLines).values(
      r.lines.map(([name, pct], i) => {
        const componentId = componentIdByName.get(name.toLowerCase());
        if (componentId == null) throw new Error(`Recipe ${r.drinkSlug}/${r.clientSlug} references unknown component: ${name}`);
        return { recipeId: recipe.id, componentId, percentage: pct.toFixed(3), displayOrder: i };
      }),
    );
    created++;
  }
  console.log(`✓ Recipes: ${created} created, ${skipped} already present (idempotent), ${backfilled} method backfilled.`);

  // 5. SKUs — upsert by code, wire drink_id.
  for (const s of SKU_SEED) {
    const drinkId = drinkIdBySlug.get(s.drinkSlug) ?? null;
    const code = `${s.drinkSlug}-${s.sizeMl}`;
    await db
      .insert(skus)
      .values({ code, drinkId, sizeMl: s.sizeMl, gtin: s.gtin })
      .onConflictDoUpdate({
        target: skus.code,
        set: { drinkId, sizeMl: s.sizeMl, gtin: s.gtin, updatedAt: new Date() },
      });
  }
  console.log(`✓ SKUs: ${SKU_SEED.length} upserted (drink_id wired; Martini Flight excluded — it's a set).`);
}
