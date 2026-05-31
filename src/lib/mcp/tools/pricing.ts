/**
 * MCP tools — drinks & wholesale pricing (read).
 *
 * Backed by the git-committed pricing data: PRICING_PRODUCTS with live COGS
 * derived from the ingredient master, plus the RRP and wholesale override
 * files. This mirrors exactly what the Finances › Wholesale Pricing page
 * shows. Recipe internals are never exposed — only the COGS total.
 */

import rrpOverridesRaw from "@/data/rrp-overrides.json";
import wholesaleOverridesRaw from "@/data/wholesale-overrides.json";
import { getPricingProductsWithLiveCogs } from "@/lib/cogs";
import {
  DEFAULT_CONFIG,
  calcWholesale,
  calcRetailerPrice,
  calcMargin,
  passesRetailerTest,
} from "@/lib/pricing-data";
import type { ToolArgs, ToolDefinition } from "../types";

const round2 = (n: number) => Math.round(n * 100) / 100;

interface DrinkView {
  id: string;
  name: string;
  size: string;
  ean: string | null;
  rrp: number;
  cogs: number;
  shipping: number;
  wholesale: number;
  wholesaleIsOverridden: boolean;
  retailerPrice: number;
  passesRetailerTest: boolean;
  marginPct: number;
  notes: string | null;
}

/** Build the override-aware, live-COGS view of every SKU. */
function buildDrinks(): DrinkView[] {
  const rrpOverrides = rrpOverridesRaw as Record<string, number>;
  const wholesaleOverrides = wholesaleOverridesRaw as Record<string, number>;

  return getPricingProductsWithLiveCogs().map((p) => {
    const product = {
      ...p,
      rrp: rrpOverrides[p.id] ?? p.rrp,
      wholesaleOverride: wholesaleOverrides[p.id],
    };
    const wholesale = calcWholesale(product, DEFAULT_CONFIG);
    return {
      id: product.id,
      name: product.name,
      size: product.size,
      ean: product.gtin ?? null,
      rrp: round2(product.rrp),
      cogs: round2(product.cogs),
      shipping: round2(product.shipping),
      wholesale,
      wholesaleIsOverridden: product.wholesaleOverride !== undefined,
      retailerPrice: calcRetailerPrice(wholesale, DEFAULT_CONFIG),
      passesRetailerTest: passesRetailerTest(product, DEFAULT_CONFIG),
      marginPct: calcMargin(product, DEFAULT_CONFIG),
      notes: product.notes ? product.notes : null,
    };
  });
}

function str(args: ToolArgs, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export const pricingTools: ToolDefinition[] = [
  {
    name: "list_drinks",
    title: "List drinks",
    description:
      "List every Myatt's Fields drink/SKU with size, EAN barcode, RRP, COGS, " +
      "wholesale price, retailer price and whether it passes the retailer test. " +
      "Optionally filter by size (e.g. '250ml') or by name substring.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: {
        size: {
          type: "string",
          description: "Filter by exact size, e.g. '250ml', '500ml', '700ml', 'set'.",
        },
        name: {
          type: "string",
          description: "Filter by case-insensitive substring of the drink name.",
        },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      let drinks = buildDrinks();
      const size = str(args, "size");
      const name = str(args, "name");
      if (size) {
        drinks = drinks.filter(
          (d) => d.size.toLowerCase() === size.toLowerCase(),
        );
      }
      if (name) {
        const needle = name.toLowerCase();
        drinks = drinks.filter((d) => d.name.toLowerCase().includes(needle));
      }
      drinks.sort(
        (a, b) => a.name.localeCompare(b.name) || a.size.localeCompare(b.size),
      );
      return { count: drinks.length, drinks };
    },
  },
  {
    name: "get_drink",
    title: "Get a drink",
    description:
      "Look up a single drink/SKU by its id, EAN barcode, or name. When matched " +
      "by name, every size of that drink is returned.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "SKU id, e.g. 'negroni-250'." },
        ean: { type: "string", description: "EAN/GTIN barcode number." },
        name: { type: "string", description: "Drink name, e.g. 'Negroni'." },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const id = str(args, "id");
      const ean = str(args, "ean");
      const name = str(args, "name");
      if (!id && !ean && !name) {
        throw new Error("Provide one of: id, ean, name.");
      }
      const drinks = buildDrinks();
      let matches: DrinkView[] = [];
      if (id) matches = drinks.filter((d) => d.id === id);
      else if (ean) matches = drinks.filter((d) => d.ean === ean);
      else if (name) {
        const needle = name.toLowerCase();
        matches = drinks.filter((d) => d.name.toLowerCase() === needle);
        if (matches.length === 0) {
          matches = drinks.filter((d) =>
            d.name.toLowerCase().includes(needle),
          );
        }
      }
      if (matches.length === 0) throw new Error("No matching drink found.");
      return { count: matches.length, drinks: matches };
    },
  },
  {
    name: "get_pricing_config",
    title: "Get pricing config",
    description:
      "Return the wholesale pricing assumptions (markup on COGS, retailer " +
      "margin, VAT rate) and summary stats: SKU count, retailer-test pass rate, " +
      "average wholesale price and average margin.",
    access: "read",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => {
      const drinks = buildDrinks();
      const passing = drinks.filter((d) => d.passesRetailerTest).length;
      const avg = (xs: number[]) =>
        xs.length ? round2(xs.reduce((s, x) => s + x, 0) / xs.length) : 0;
      return {
        config: {
          markupOnCogsPct: round2((DEFAULT_CONFIG.markup - 1) * 100),
          retailerMarginPct: round2((DEFAULT_CONFIG.retailerMargin - 1) * 100),
          vatRatePct: round2((DEFAULT_CONFIG.vat - 1) * 100),
          lastUpdated: DEFAULT_CONFIG.lastUpdated,
          formula: "wholesale = COGS x (1 + markup) + shipping",
        },
        summary: {
          skuCount: drinks.length,
          retailerTestPassing: passing,
          retailerTestPassRatePct:
            drinks.length ? round2((passing / drinks.length) * 100) : 0,
          averageWholesale: avg(drinks.map((d) => d.wholesale)),
          averageMarginPct: avg(drinks.map((d) => d.marginPct)),
        },
      };
    },
  },
];
