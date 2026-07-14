/**
 * MCP tools: revenue and customers (read).
 *
 * Backed by the git-committed QuickBooks snapshots (qb-revenue.json,
 * qb-customers.json) and the Shopify DTC series (channel-revenue.json).
 *
 * BREAKING CHANGE, 14 Jul 2026. `get_revenue_overview` no longer returns
 * `annualDtcWholesaleSplit`. That array was a hand-typed estimate and a board
 * pack cited it as source data. It has been removed rather than repointed, so
 * that any caller still reaching for it fails visibly instead of quietly
 * returning different numbers under an old name. Every figure this tool now
 * serves carries a `source` and an `asOf`; anything that cannot be reconciled
 * carries a `warning` and says so.
 */

import qbRevenueRaw from "@/data/qb-revenue.json";
import qbCustomersRaw from "@/data/qb-customers.json";
import { getRevenueWithProvenance, getDtcByProduct } from "@/lib/revenue";
import type { ToolArgs, ToolDefinition } from "../types";

interface QbRevenue {
  lastUpdated?: string;
  years: Record<string, unknown>;
}

interface QbCustomers {
  lastUpdated?: string;
  source?: string;
  periods: string[];
  periodLabels: Record<string, string>;
  partners: Record<string, unknown>;
}

const qbRevenue = qbRevenueRaw as unknown as QbRevenue;
const qbCustomers = qbCustomersRaw as unknown as QbCustomers;

function str(args: ToolArgs, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export const revenueTools: ToolDefinition[] = [
  {
    name: "get_revenue_overview",
    title: "Get revenue overview",
    description:
      "Return annual revenue with full provenance. Channels are DTC (from " +
      "Shopify, the only source for it), Amazon (GROSS only, no net figure " +
      "exists in the business, and the channel was loss-making after fees), " +
      "Wholesale (a FLOOR, not a total) and Unclassified (the £92k bucket that " +
      "blocks the channel table). Every figure carries a source and an as-of " +
      "date, and the channels deliberately do not sum to the total: that " +
      "mismatch is reported, not hidden. Optionally restrict to a single year. " +
      "NOTE: `annualDtcWholesaleSplit` was REMOVED on 14 Jul 2026. It was a " +
      "hand-typed estimate that a board pack cited as data. Do not look for it.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: {
        year: {
          type: "string",
          description: "Restrict to one calendar year, e.g. '2024'.",
        },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const year = str(args, "year");
      const revenue = getRevenueWithProvenance();

      let years = qbRevenue.years;
      let channels = revenue.channels;
      let totals = revenue.totals;
      let byYear = revenue.reconciliation.byYear;

      if (year) {
        if (!years[year]) {
          throw new Error(
            `No revenue data for year "${year}". Available: ${Object.keys(
              qbRevenue.years,
            ).join(", ")}.`,
          );
        }
        years = { [year]: years[year] };
        channels = {
          dtc: channels.dtc.filter((r) => r.year === year),
          amazon: channels.amazon.filter((r) => r.year === year),
          wholesale: channels.wholesale.filter((r) => r.year === year),
          unclassified: channels.unclassified.filter((r) => r.year === year),
        };
        totals = totals.filter((r) => r.year === year);
        byYear = byYear.filter((r) => r.year === year);
      }

      return {
        readMeFirst: revenue.readMeFirst,
        channels,
        totals,
        reconciliation: { ...revenue.reconciliation, byYear },
        sources: revenue.sources,
        staleness: revenue.staleness,
        retracted: revenue.retracted,
        refresh: revenue.refresh,
        // The raw QuickBooks P&L, unchanged. Income, expenses, gross profit,
        // net income and the account breakdown.
        quickbooksProfitAndLoss: {
          lastUpdated: qbRevenue.lastUpdated ?? null,
          warning:
            "2022 carries Stock Shrinkage of -£120,036.94 and two months of negative cost of sales. Gross profit and net income are not usable until the periodic-inventory reclassification lands with John.",
          years,
        },
      };
    },
  },
  {
    name: "get_dtc_by_product",
    title: "Get DTC revenue by product",
    description:
      "Return DTC revenue and order counts by product and year, read from " +
      "Shopify. This is the only product-level revenue that exists anywhere in " +
      "the business: Back Bar knows every SKU's cost and price and has never " +
      "known how many of any of them were sold. Wholesale by product does NOT " +
      "exist and cannot be answered from here. Top 50 product-years by revenue, " +
      "so it is a leaderboard and not a complete ledger.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: {
        year: { type: "string", description: "Restrict to one year, e.g. '2025'." },
        product: {
          type: "string",
          description: "Case-insensitive substring of the product title, e.g. 'choose'.",
        },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const year = str(args, "year");
      const product = str(args, "product");
      return getDtcByProduct(year ?? undefined, product ?? undefined);
    },
  },
  {
    name: "get_customer_revenue",
    title: "Get customer revenue",
    description:
      "Return wholesale partner revenue by period from the QuickBooks " +
      "Sales-by-Customer snapshot, with per-partner totals. Optionally filter " +
      "to partners matching a name substring.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: {
        partner: {
          type: "string",
          description:
            "Filter by case-insensitive substring of the partner name, " +
            "e.g. 'Fortnum'.",
        },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const partner = str(args, "partner");
      let partners = qbCustomers.partners;
      if (partner) {
        const needle = partner.toLowerCase();
        partners = Object.fromEntries(
          Object.entries(qbCustomers.partners).filter(([name]) =>
            name.toLowerCase().includes(needle),
          ),
        );
        if (Object.keys(partners).length === 0) {
          throw new Error(`No partner matching "${partner}".`);
        }
      }
      return {
        lastUpdated: qbCustomers.lastUpdated ?? null,
        source: qbCustomers.source ?? null,
        periods: qbCustomers.periods,
        periodLabels: qbCustomers.periodLabels,
        partners,
      };
    },
  },
];
