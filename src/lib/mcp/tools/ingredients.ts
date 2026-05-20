/**
 * MCP tools — ingredient master (read).
 *
 * Exposes the ingredient buying list and its dated price history. This is the
 * Finances › Ingredients data. It does NOT expose recipes or which ingredient
 * goes into which drink — only the master list and per-ingredient costs.
 */

import { INGREDIENTS, PRICE_HISTORY } from "@/lib/ingredients";
import type { ToolArgs, ToolDefinition } from "../types";

function str(args: ToolArgs, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export const ingredientTools: ToolDefinition[] = [
  {
    name: "list_ingredients",
    title: "List ingredients",
    description:
      "List every ingredient in the buying master with its current unit price " +
      "and the date that price was set. Optionally filter by name substring.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Filter by case-insensitive substring of the ingredient name.",
        },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const name = str(args, "name");
      let rows = INGREDIENTS.map((i) => ({
        id: i.id,
        name: i.name,
        bottleSizeMl: i.bottleSizeMl,
        currentPrice: i.currentPrice,
        currentPriceSetAt: i.currentPriceSetAt,
        notes: i.notes ?? null,
      }));
      if (name) {
        const needle = name.toLowerCase();
        rows = rows.filter((r) => r.name.toLowerCase().includes(needle));
      }
      rows.sort((a, b) => a.name.localeCompare(b.name));
      return { count: rows.length, ingredients: rows };
    },
  },
  {
    name: "get_ingredient_price_history",
    title: "Get ingredient price history",
    description:
      "Return one ingredient and its full dated price-change history, oldest " +
      "first. Use list_ingredients to find the ingredient id.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: {
        ingredient_id: {
          type: "string",
          description: "Ingredient id, e.g. 'campari'.",
        },
      },
      required: ["ingredient_id"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const id = str(args, "ingredient_id");
      if (!id) throw new Error("ingredient_id is required.");
      const ingredient = INGREDIENTS.find((i) => i.id === id);
      if (!ingredient) throw new Error(`Ingredient "${id}" not found.`);
      const history = PRICE_HISTORY.filter((h) => h.ingredientId === id)
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date));
      return {
        ingredient: {
          id: ingredient.id,
          name: ingredient.name,
          bottleSizeMl: ingredient.bottleSizeMl,
          currentPrice: ingredient.currentPrice,
          currentPriceSetAt: ingredient.currentPriceSetAt,
          notes: ingredient.notes ?? null,
        },
        priceHistory: history,
      };
    },
  },
];
