/**
 * MCP tools — revenue & customers (read).
 *
 * Backed by the git-committed QuickBooks snapshots (qb-revenue.json,
 * qb-customers.json) and the static annual DTC/wholesale split. These are the
 * Finances › Revenue Overview figures.
 */

import qbRevenueRaw from "@/data/qb-revenue.json";
import qbCustomersRaw from "@/data/qb-customers.json";
import { STATIC_ANNUAL_REVENUE } from "@/lib/static-data";
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
      "Return annual revenue from the QuickBooks snapshot — income, expenses, " +
      "gross profit, net income and a breakdown by account — plus the annual " +
      "DTC vs wholesale split. Optionally restrict to a single year.",
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
      let years = qbRevenue.years;
      if (year) {
        if (!years[year]) {
          throw new Error(
            `No revenue data for year "${year}". Available: ${Object.keys(
              qbRevenue.years,
            ).join(", ")}.`,
          );
        }
        years = { [year]: years[year] };
      }
      return {
        lastUpdated: qbRevenue.lastUpdated ?? null,
        years,
        annualDtcWholesaleSplit: STATIC_ANNUAL_REVENUE,
      };
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
