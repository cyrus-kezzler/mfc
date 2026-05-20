/**
 * MCP tools — pricing & ingredient writes.
 *
 * These wrap the existing Back Bar server actions. Every write is persisted by
 * committing the relevant JSON file to GitHub (Contents API), so each change
 * is a real git commit with a descriptive message — the git history IS the
 * audit log. Vercel redeploys automatically within ~30-60s.
 *
 * Writes require a write-tier token (see auth.ts). They need GITHUB_PAT set in
 * the environment; without it the underlying action returns a clear error.
 */

import {
  updateWholesaleOverride,
  updateRrpOverride,
} from "@/app/actions/pricing";
import { updateIngredientPrice } from "@/app/actions/ingredients";
import { PRICING_PRODUCTS } from "@/lib/pricing-data";
import { INGREDIENTS } from "@/lib/ingredients";
import type { ToolArgs, ToolDefinition } from "../types";

function str(args: ToolArgs, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Coerce a numeric argument that may arrive as a number or numeric string. */
function num(args: ToolArgs, key: string): number {
  const v = args[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) {
    throw new Error(`"${key}" must be a number.`);
  }
  return n;
}

export const writeTools: ToolDefinition[] = [
  {
    name: "set_wholesale_price",
    title: "Set wholesale price",
    description:
      "Override the wholesale price for one drink/SKU. This replaces the " +
      "formula-derived wholesale price. Committed to git. Find the drink id " +
      "with list_drinks.",
    access: "write",
    inputSchema: {
      type: "object",
      properties: {
        drink_id: { type: "string", description: "SKU id, e.g. 'negroni-250'." },
        wholesale: {
          type: "number",
          description: "New wholesale price in GBP, ex VAT. Must be positive.",
        },
      },
      required: ["drink_id", "wholesale"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const id = str(args, "drink_id");
      if (!id) throw new Error("drink_id is required.");
      const wholesale = num(args, "wholesale");
      const product = PRICING_PRODUCTS.find((p) => p.id === id);
      if (!product) throw new Error(`Drink "${id}" not found.`);

      const result = await updateWholesaleOverride(
        product.id,
        product.name,
        product.size,
        wholesale,
      );
      if (!result.ok) throw new Error(result.error);
      return {
        ok: true,
        drink: { id: product.id, name: product.name, size: product.size },
        wholesale: Math.round(wholesale * 100) / 100,
        message: "Wholesale override committed to git. Vercel will redeploy shortly.",
      };
    },
  },
  {
    name: "set_rrp",
    title: "Set RRP",
    description:
      "Override the RRP (recommended retail price, inc VAT) for one drink/SKU. " +
      "Committed to git. Find the drink id with list_drinks.",
    access: "write",
    inputSchema: {
      type: "object",
      properties: {
        drink_id: { type: "string", description: "SKU id, e.g. 'negroni-250'." },
        rrp: {
          type: "number",
          description: "New RRP in GBP, inc VAT. Must be positive.",
        },
      },
      required: ["drink_id", "rrp"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const id = str(args, "drink_id");
      if (!id) throw new Error("drink_id is required.");
      const rrp = num(args, "rrp");
      const product = PRICING_PRODUCTS.find((p) => p.id === id);
      if (!product) throw new Error(`Drink "${id}" not found.`);

      const result = await updateRrpOverride(
        product.id,
        product.name,
        product.size,
        rrp,
      );
      if (!result.ok) throw new Error(result.error);
      return {
        ok: true,
        drink: { id: product.id, name: product.name, size: product.size },
        rrp: Math.round(rrp * 100) / 100,
        message: "RRP override committed to git. Vercel will redeploy shortly.",
      };
    },
  },
  {
    name: "set_ingredient_price",
    title: "Set ingredient price",
    description:
      "Update the current unit price of one ingredient in the buying master. " +
      "Appends a dated entry to the price history. Committed to git. Find the " +
      "ingredient id with list_ingredients.",
    access: "write",
    inputSchema: {
      type: "object",
      properties: {
        ingredient_id: {
          type: "string",
          description: "Ingredient id, e.g. 'campari'.",
        },
        price: {
          type: "number",
          description: "New unit price in GBP. Must be zero or positive.",
        },
        note: {
          type: "string",
          description: "Optional note recorded with the price-history entry.",
        },
      },
      required: ["ingredient_id", "price"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const id = str(args, "ingredient_id");
      if (!id) throw new Error("ingredient_id is required.");
      const price = num(args, "price");
      const note = str(args, "note") ?? undefined;
      const ingredient = INGREDIENTS.find((i) => i.id === id);
      if (!ingredient) throw new Error(`Ingredient "${id}" not found.`);

      const result = await updateIngredientPrice(id, price, note);
      if (!result.ok) throw new Error(result.error);
      return {
        ok: true,
        ingredient: result.ingredient,
        message:
          "Ingredient price committed to git. Vercel will redeploy shortly.",
      };
    },
  },
];
