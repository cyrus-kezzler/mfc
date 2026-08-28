/**
 * MCP tools: recipes (read).
 *
 * Cyrus has ruled that recipe confidentiality is not a concern (28 Aug 2026):
 * the full component breakdown, by percentage, is fine to expose to Claude.
 * This mirrors what the Back Bar recipe screens already show a signed-in
 * user, so nothing here is a new capability, only a new surface for it.
 *
 * Backed by the database `recipes` and `recipe_lines` tables. A recipe is
 * versioned and client-scoped (drink x client): editing creates a new row and
 * flips the old one's is_current to false, so by default this returns the
 * CURRENT version only. Pass include_history to also return past versions.
 *
 * ABV reuses abvComputed() from src/lib/erp/canon.ts rather than re-summing
 * component abv x line percentage here. That function is defined only for
 * the CURRENT recipe of a drink+client, so a historical (non-current) version
 * is returned with abv: null rather than a second, slightly different sum.
 */

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { clients, components, drinks, recipeLines, recipes, skus } from "@/db/schema";
import { abvComputed, type NullAbvComponent } from "@/lib/erp/canon";
import type { ToolArgs, ToolDefinition } from "../types";

function str(args: ToolArgs, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function id(args: ToolArgs, key: string): number | null {
  const v = args[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

function round(x: number, dp = 3): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

interface RecipeLineView {
  componentId: number;
  name: string;
  percentage: number;
  /** The component's own ABV, or null when unmeasured. */
  componentAbv: number | null;
}

interface RecipeView {
  recipeId: number;
  drinkId: number;
  drinkName: string;
  clientSlug: string;
  clientName: string;
  version: number;
  isCurrent: boolean;
  method: string | null;
  lines: RecipeLineView[];
  percentageTotal: number;
  /** Summed from the current recipe only (see file header); null for a past version. */
  abv: number | null;
  nullAbvComponents: NullAbvComponent[];
  /** SKUs that sell under this drink+client combination. */
  skuCodes: string[];
}

type RecipeRow = typeof recipes.$inferSelect;
type DrinkRow = typeof drinks.$inferSelect;
type ClientRow = typeof clients.$inferSelect;
type ComponentRow = typeof components.$inferSelect;
type SkuRow = typeof skus.$inferSelect;

async function buildRecipeView(
  recipe: RecipeRow,
  drinksById: Map<number, DrinkRow>,
  clientsById: Map<number, ClientRow>,
  componentsById: Map<number, ComponentRow>,
  allSkus: SkuRow[],
): Promise<RecipeView> {
  const drink = drinksById.get(recipe.drinkId);
  const client = clientsById.get(recipe.clientId);

  const lineRows = await db
    .select()
    .from(recipeLines)
    .where(eq(recipeLines.recipeId, recipe.id));
  lineRows.sort((a, b) => a.displayOrder - b.displayOrder);

  const lines: RecipeLineView[] = lineRows.map((l) => {
    const c = componentsById.get(l.componentId);
    return {
      componentId: l.componentId,
      name: c?.name ?? `(missing component ${l.componentId})`,
      percentage: Number(l.percentage),
      componentAbv: c?.abv != null ? Number(c.abv) : null,
    };
  });
  const percentageTotal = round(lines.reduce((s, l) => s + l.percentage, 0));

  let abv: number | null = null;
  let nullAbvComponents: NullAbvComponent[] = [];
  if (recipe.isCurrent && client) {
    const result = await abvComputed(recipe.drinkId, client.slug);
    abv = result.abv;
    nullAbvComponents = result.nullAbvComponents;
  }

  const skuCodes = allSkus
    .filter((s) => s.drinkId === recipe.drinkId && s.clientId === recipe.clientId)
    .map((s) => s.code);

  return {
    recipeId: recipe.id,
    drinkId: recipe.drinkId,
    drinkName: drink?.name ?? `(missing drink ${recipe.drinkId})`,
    clientSlug: client?.slug ?? "?",
    clientName: client?.name ?? `(missing client ${recipe.clientId})`,
    version: recipe.version,
    isCurrent: recipe.isCurrent,
    method: recipe.method,
    lines,
    percentageTotal,
    abv,
    nullAbvComponents,
    skuCodes,
  };
}

export const recipeTools: ToolDefinition[] = [
  {
    name: "get_recipe",
    title: "Get a recipe",
    description:
      "Return the full recipe for a drink: every component line with its " +
      "percentage, the client it is scoped to, the version number, whether it " +
      "is the current version, any production method text, and the computed " +
      "ABV (current version only, summed from component ABVs; see " +
      "get_ingredient_price_history for the components themselves). Look up " +
      "by drink name (returns every matching client's current recipe, " +
      "optionally narrowed with client), SKU code (resolves the exact " +
      "drink+client recipe that SKU sells under), or numeric recipe id (one " +
      "specific version, current or historical). Pass include_history to also " +
      "return past, non-current versions when looking up by drink or SKU.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: {
        drink: {
          type: "string",
          description: "Drink name, exact or case-insensitive substring, e.g. 'Negroni'.",
        },
        sku: {
          type: "string",
          description: "SKU code, e.g. 'negroni-250'.",
        },
        recipe_id: {
          type: "number",
          description: "Numeric recipe id, e.g. 29.",
        },
        client: {
          type: "string",
          description:
            "Filter by client slug or name (e.g. 'mfc', 'fm', 'cripps'). Only applies with drink.",
        },
        include_history: {
          type: "boolean",
          description: "When true, also return past (non-current) versions. Default false.",
        },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const drinkArg = str(args, "drink");
      const skuArg = str(args, "sku");
      const recipeIdArg = id(args, "recipe_id");
      const clientArg = str(args, "client");
      const includeHistory =
        args["include_history"] === true || args["include_history"] === "true";

      if (!drinkArg && !skuArg && !recipeIdArg) {
        throw new Error("Provide one of: drink, sku, recipe_id.");
      }

      const [allDrinks, allClients, allComponents, allSkus, allRecipes] = await Promise.all([
        db.select().from(drinks),
        db.select().from(clients),
        db.select().from(components),
        db.select().from(skus),
        db.select().from(recipes),
      ]);
      const drinksById = new Map(allDrinks.map((d) => [d.id, d]));
      const clientsById = new Map(allClients.map((c) => [c.id, c]));
      const componentsById = new Map(allComponents.map((c) => [c.id, c]));

      let matchedRecipes: RecipeRow[] = [];

      if (recipeIdArg) {
        matchedRecipes = allRecipes.filter((r) => r.id === recipeIdArg);
        if (matchedRecipes.length === 0) {
          throw new Error(`No recipe with id ${recipeIdArg}.`);
        }
      } else if (skuArg) {
        const sku = allSkus.find((s) => s.code === skuArg);
        if (!sku) throw new Error(`No SKU with code "${skuArg}".`);
        if (!sku.drinkId || !sku.clientId) {
          throw new Error(`SKU "${skuArg}" has no drink or client, so no recipe can be resolved.`);
        }
        matchedRecipes = allRecipes.filter(
          (r) =>
            r.drinkId === sku.drinkId &&
            r.clientId === sku.clientId &&
            (includeHistory || r.isCurrent),
        );
        if (matchedRecipes.length === 0) {
          throw new Error(`No recipe found for SKU "${skuArg}".`);
        }
      } else if (drinkArg) {
        const needle = drinkArg.toLowerCase();
        let matchedDrinks = allDrinks.filter((d) => d.name.toLowerCase() === needle);
        if (matchedDrinks.length === 0) {
          matchedDrinks = allDrinks.filter((d) => d.name.toLowerCase().includes(needle));
        }
        if (matchedDrinks.length === 0) throw new Error(`No drink matching "${drinkArg}".`);
        const drinkIds = new Set(matchedDrinks.map((d) => d.id));

        let clientIds: Set<number> | null = null;
        if (clientArg) {
          const needleC = clientArg.toLowerCase();
          const matchedClients = allClients.filter(
            (c) => c.slug.toLowerCase() === needleC || c.name.toLowerCase() === needleC,
          );
          if (matchedClients.length === 0) throw new Error(`No client matching "${clientArg}".`);
          clientIds = new Set(matchedClients.map((c) => c.id));
        }

        matchedRecipes = allRecipes.filter(
          (r) =>
            drinkIds.has(r.drinkId) &&
            (includeHistory || r.isCurrent) &&
            (!clientIds || clientIds.has(r.clientId)),
        );
        if (matchedRecipes.length === 0) {
          throw new Error(
            `No recipe found for "${drinkArg}"${clientArg ? ` / client "${clientArg}"` : ""}.`,
          );
        }
      }

      const views = await Promise.all(
        matchedRecipes.map((r) =>
          buildRecipeView(r, drinksById, clientsById, componentsById, allSkus),
        ),
      );
      views.sort(
        (a, b) =>
          a.drinkName.localeCompare(b.drinkName) ||
          a.clientName.localeCompare(b.clientName) ||
          b.version - a.version,
      );
      return { count: views.length, recipes: views };
    },
  },
];
