/**
 * MCP tools: ingredient master (read).
 *
 * Backed by the database component register (`components` +
 * `component_price_history`). Exposes the buying list, per-UOM costs with
 * provenance, and the dated price history. It does NOT expose recipes or which
 * ingredient goes into which drink, only the master list and costs.
 */

import { getIngredient, getPriceHistory, listIngredients } from "@/lib/erp/ingredients";
import type { ToolArgs, ToolDefinition } from "../types";

function str(args: ToolArgs, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Coerce an id that may arrive as a number or numeric string. */
function id(args: ToolArgs, key: string): number | null {
  const v = args[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const ingredientTools: ToolDefinition[] = [
  {
    name: "list_ingredients",
    title: "List ingredients",
    description:
      "List every ingredient in the buying master with pack size, pack cost, " +
      "per-UOM unit cost, when the price was set, its provenance " +
      "(inbound = from a supplier invoice, manual, placeholder, or none), and " +
      "its ABV. abvMissing is true when a component of type 'ingredient' " +
      "(the type that should carry alcohol) has no ABV recorded, so a gap is " +
      "visible without doing the arithmetic. Optionally filter by name " +
      "substring or to unsourced entries only.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Filter by case-insensitive substring of the ingredient name.",
        },
        unsourced_only: {
          type: "boolean",
          description: "Return only ingredients whose price has no invoice or manual entry behind it.",
        },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const name = str(args, "name");
      const unsourcedOnly = args["unsourced_only"] === true || args["unsourced_only"] === "true";
      let rows = await listIngredients();
      if (unsourcedOnly) {
        rows = rows.filter((r) => r.provenance === "none" || r.provenance === "placeholder");
      }
      if (name) {
        const needle = name.toLowerCase();
        rows = rows.filter((r) => r.name.toLowerCase().includes(needle));
      }
      return {
        count: rows.length,
        ingredients: rows.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          uom: r.uom,
          packSize: r.packSize,
          packCost: r.packCost,
          unitCost: r.unitCost,
          unitCostSetAt: r.unitCostSetAt,
          abv: r.abv,
          abvMissing: r.type === "ingredient" && (r.abv === null || r.abv === 0),
          provenance: r.provenance,
          isSubRecipe: r.isSubRecipe,
          notes: r.notes,
        })),
      };
    },
  },
  {
    name: "get_ingredient_price_history",
    title: "Get ingredient price history",
    description:
      "Return one ingredient and its full dated price-change history (per-UOM " +
      "unit cost, source, notes), newest first. Use list_ingredients to find " +
      "the numeric ingredient id.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: {
        ingredient_id: {
          type: "number",
          description: "Numeric component id, e.g. 12.",
        },
      },
      required: ["ingredient_id"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const componentId = id(args, "ingredient_id");
      if (!componentId) throw new Error("ingredient_id must be a positive integer.");
      const ingredient = await getIngredient(componentId);
      if (!ingredient) throw new Error(`No ingredient with id ${componentId}.`);
      const history = await getPriceHistory(componentId);
      return {
        ingredient: {
          id: ingredient.id,
          name: ingredient.name,
          uom: ingredient.uom,
          packSize: ingredient.packSize,
          packCost: ingredient.packCost,
          unitCost: ingredient.unitCost,
          unitCostSetAt: ingredient.unitCostSetAt,
          provenance: ingredient.provenance,
          notes: ingredient.notes,
        },
        priceHistory: history,
      };
    },
  },
];
