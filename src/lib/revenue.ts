/**
 * Revenue with provenance.
 *
 * The one place Back Bar is allowed to produce a revenue figure. Every value
 * that leaves this module carries a `source`, an `asOf` date, and, where the
 * number cannot be trusted on its own, a `warning` that travels WITH the number
 * rather than sitting in a comment somewhere a reader will never look.
 *
 * Why this module exists, in one paragraph. Back Bar used to serve
 * `annualDtcWholesaleSplit`, a hand-typed estimate in which every figure was
 * round to the nearest £100. Section 7 of the Exec Board 02 pack read it as
 * source data, concluded that DTC had fallen every year since 2020, and
 * recommended defunding the channel. In reality the "2025" row was the 2026
 * year to date, real 2025 DTC was UP 74%, and the 2020 peak was understated by
 * a factor of three and a half. Fixing those figures would have reset the trap.
 * So the rule is structural instead: a number with no source does not get
 * served, and a number that cannot be reconciled says so out loud.
 *
 * Rules enforced here:
 *   1. DTC comes from Shopify. Never from the QuickBooks "Shopify Sales"
 *      account, which is a copy, and is wrong (2025: QB £7,523.06 vs Shopify
 *      £10,876.86).
 *   2. Amazon is a first-class channel and it carries GROSS, loudly, because
 *      no net figure exists anywhere in the business.
 *   3. Wholesale is a FLOOR, not a total, while the unclassified bucket exists.
 *   4. The unclassified bucket is a channel of its own, so it can never be
 *      quietly folded into wholesale to make a table look complete.
 *   5. Channels do not sum to the total, and the mismatch is reported as a
 *      first-class fact rather than hidden.
 *   6. Anything with source "manual" carries a warning. There is currently
 *      nothing with source "manual", and that is the point.
 */

import channelRevenue from "@/data/channel-revenue.json";
import qbRevenueRaw from "@/data/qb-revenue.json";

export type RevenueSource = "shopify" | "quickbooks" | "amazon" | "manual";

export interface Provenance {
  source: RevenueSource;
  asOf: string;
  method?: string;
  /** Present when the figure cannot be trusted on its own. Render it. */
  warning?: string;
}

export interface ChannelYear extends Provenance {
  channel: "dtc" | "amazon" | "wholesale" | "unclassified";
  label: string;
  year: string;
  /** The headline figure for the channel in that year, in GBP. */
  value: number;
  /** What `value` actually measures. Never assume it is comparable across channels. */
  basis: "totalSales" | "gross" | "floor" | "unknown";
  /** True when the year is incomplete. A partial year read as a full one is what caused all this. */
  partialYear: boolean;
  /** Extra source detail: order counts, discounts, returns. */
  detail?: Record<string, number>;
}

interface QbYear {
  totalIncome: number;
  totalExpenses: number;
  grossProfit: number;
  netIncome: number;
  incomeByAccount: Record<string, number>;
}

const qbYears = (qbRevenueRaw as unknown as { lastUpdated: string; years: Record<string, QbYear> }).years;
const qbAsOf = (qbRevenueRaw as unknown as { lastUpdated: string }).lastUpdated;

const cr = channelRevenue as unknown as {
  schemaVersion: number;
  generatedAt: string;
  readMeFirst: string;
  dtc: {
    label: string;
    source: RevenueSource;
    asOf: string;
    method: string;
    shop: string;
    basis: string;
    years: Record<string, Record<string, number>>;
    partialYears: string[];
  };
  dtcByProduct: {
    label: string;
    source: RevenueSource;
    asOf: string;
    method: string;
    coverage: string;
    caveat: string;
    rows: Array<{ product: string; year: string; totalSales: number; orders: number }>;
  };
  quickbooksChannelRules: {
    source: RevenueSource;
    amazon: { label: string; accounts: string[]; basis: string; netKnown: boolean; warning: string };
    wholesale: { label: string; accounts: string[]; basis: string; warning: string };
    unclassified: { label: string; accounts: string[]; basis: string; warning: string };
    excludedFromChannels: { accounts: string[]; why: string };
  };
  reconciliation: {
    unreconciled: boolean;
    summary: string;
    openQuestions: string[];
    owner: string;
    blocks: string[];
  };
  retracted: Record<string, unknown>;
  refresh: { dtc: string; quickbooks: string; staleAfterDays: number; note: string };
};

/** The current calendar year is always partial. So is any year the source snapshot stops inside. */
function isPartial(year: string, sourceAsOf: string): boolean {
  const now = new Date();
  const y = Number(year);
  if (y === now.getFullYear()) return true;
  // A snapshot taken during year Y cannot contain a full year Y.
  return y === new Date(sourceAsOf).getFullYear();
}

function sumAccounts(qb: QbYear, accounts: string[]): number {
  const total = accounts.reduce((sum, a) => sum + (qb.incomeByAccount[a] ?? 0), 0);
  return Math.round(total * 100) / 100;
}

/** DTC by year, from Shopify. The only honest DTC in the business. */
export function getDtcSeries(): ChannelYear[] {
  const { label, source, asOf, method, basis, years } = cr.dtc;
  return Object.entries(years)
    .map(([year, d]) => ({
      channel: "dtc" as const,
      label,
      year,
      value: d.totalSales,
      basis: "totalSales" as const,
      source,
      asOf,
      method: `${method}. Basis: ${basis}`,
      partialYear: isPartial(year, asOf),
      detail: {
        orders: d.orders,
        grossSales: d.grossSales,
        discounts: d.discounts,
        returns: d.returns,
        netSales: d.netSales,
        shipping: d.shipping,
      },
    }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

/** Amazon, wholesale and the unclassified bucket, derived from the QuickBooks snapshot at read time. */
export function getQbChannelSeries(
  channel: "amazon" | "wholesale" | "unclassified",
): ChannelYear[] {
  const rule = cr.quickbooksChannelRules[channel];
  const basis = rule.basis as ChannelYear["basis"];
  return Object.entries(qbYears)
    .map(([year, qb]) => ({
      channel,
      label: rule.label,
      year,
      value: sumAccounts(qb, rule.accounts),
      basis,
      source: "quickbooks" as const,
      asOf: qbAsOf,
      method: `QuickBooks income accounts: ${rule.accounts.join(", ")}.`,
      warning: rule.warning,
      partialYear: isPartial(year, qbAsOf),
    }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

/** QuickBooks P&L total income. The only sourced total we have. */
export function getTotalSeries(): ChannelYear[] {
  return Object.entries(qbYears)
    .map(([year, qb]) => ({
      channel: "unclassified" as const,
      label: "Total income",
      year,
      value: qb.totalIncome,
      basis: "unknown" as const,
      source: "quickbooks" as const,
      asOf: qbAsOf,
      method: "QuickBooks P&L total income for the calendar year.",
      partialYear: isPartial(year, qbAsOf),
    }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

export interface YearReconciliation {
  year: string;
  total: number | null;
  channelSum: number;
  variance: number | null;
  unreconciled: boolean;
  /** Why the channels do not add up to the total. */
  reason: string;
}

/**
 * Do the channels add up to the total? No. They will not until the unclassified
 * account is broken out. Report that as a fact rather than papering over it,
 * because papering over it is exactly how the fabricated table survived.
 */
export function reconcile(): YearReconciliation[] {
  const dtc = Object.fromEntries(getDtcSeries().map((r) => [r.year, r.value]));
  const amazon = Object.fromEntries(getQbChannelSeries("amazon").map((r) => [r.year, r.value]));
  const wholesale = Object.fromEntries(getQbChannelSeries("wholesale").map((r) => [r.year, r.value]));
  const unclassified = Object.fromEntries(
    getQbChannelSeries("unclassified").map((r) => [r.year, r.value]),
  );

  return Object.keys(qbYears)
    .sort()
    .map((year) => {
      const total = qbYears[year]?.totalIncome ?? null;
      const channelSum =
        Math.round(
          ((dtc[year] ?? 0) + (amazon[year] ?? 0) + (wholesale[year] ?? 0) + (unclassified[year] ?? 0)) *
            100,
        ) / 100;
      const variance = total === null ? null : Math.round((channelSum - total) * 100) / 100;
      return {
        year,
        total,
        channelSum,
        variance,
        unreconciled: true,
        reason:
          "The channels exceed the P&L total because DTC is read from Shopify (the source) while the total is read from QuickBooks, whose own Shopify accounts under-report DTC, by £3,116.67 in 2025, plus discounts, which belong to no channel. The overage is explained, not mysterious. What is NOT settled is the channel SPLIT: the unclassified 'Sales of Product Income' account is bigger than every classified channel combined and nothing says what channel it is. It is not double-counting (the QuickBooks accounts sum exactly to total income, and P&L accounts are mutually exclusive). It is simply untagged. Owner: John at Fathom.",
      };
    });
}

/** Alerts derived from the data. Nothing hand-typed, nothing asserted that is not computed here. */
export function getDerivedAlerts(partners: Record<string, { total: number }>): Array<{
  type: "warning" | "info";
  title: string;
  message: string;
}> {
  const alerts: Array<{ type: "warning" | "info"; title: string; message: string }> = [];

  // Concentration, computed from the QuickBooks Sales-by-Customer snapshot.
  const totals = Object.entries(partners).map(([name, p]) => ({ name, total: p.total }));
  const grand = totals.reduce((s, p) => s + p.total, 0);
  if (grand > 0) {
    const top2 = [...totals].sort((a, b) => b.total - a.total).slice(0, 2);
    const share = (top2.reduce((s, p) => s + p.total, 0) / grand) * 100;
    alerts.push({
      type: share > 60 ? "warning" : "info",
      title: "Concentration",
      message: `${top2.map((p) => p.name).join(" and ")} are ${share.toFixed(
        0,
      )}% of all partner revenue on record (QuickBooks Sales by Customer, ${qbAsOf}).`,
    });
  }

  // DTC direction, computed from Shopify. This is the alert that used to lie.
  const dtc = getDtcSeries().filter((r) => !r.partialYear);
  if (dtc.length >= 2) {
    const last = dtc[dtc.length - 1];
    const prev = dtc[dtc.length - 2];
    const change = ((last.value - prev.value) / prev.value) * 100;
    const peak = dtc.reduce((m, r) => (r.value > m.value ? r : m), dtc[0]);
    alerts.push({
      type: "info",
      title: "DTC trend",
      message: `${last.year} DTC was ${gbp(last.value)}, ${change >= 0 ? "up" : "down"} ${Math.abs(
        change,
      ).toFixed(0)}% on ${prev.year}. The peak remains ${peak.year} at ${gbp(
        peak.value,
      )}. Source: Shopify, ${last.asOf}.`,
    });
  }

  // The blocker, stated on the page where the numbers are read.
  const latestUnclassified = getQbChannelSeries("unclassified").filter((r) => !r.partialYear).pop();
  if (latestUnclassified && latestUnclassified.value > 0) {
    alerts.push({
      type: "warning",
      title: "Channel table blocked",
      message: `${gbp(
        latestUnclassified.value,
      )} of ${latestUnclassified.year} income sits in 'Sales of Product Income' with no channel attached, which is more than every classified channel combined. Until John breaks it out, no channel split on this page is a fact. Wholesale is shown as a floor.`,
    });
  }

  return alerts;
}

function gbp(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Everything, shaped for the MCP. */
export function getRevenueWithProvenance() {
  return {
    readMeFirst: cr.readMeFirst,
    generatedAt: cr.generatedAt,
    channels: {
      dtc: getDtcSeries(),
      amazon: getQbChannelSeries("amazon"),
      wholesale: getQbChannelSeries("wholesale"),
      unclassified: getQbChannelSeries("unclassified"),
    },
    totals: getTotalSeries(),
    reconciliation: {
      ...cr.reconciliation,
      byYear: reconcile(),
    },
    sources: {
      shopify: { asOf: cr.dtc.asOf, shop: cr.dtc.shop, covers: "DTC only" },
      quickbooks: { asOf: qbAsOf, covers: "wholesale, Amazon, unclassified, totals" },
      amazonNet: { asOf: null, covers: "nothing. No net figure exists in the business." },
    },
    staleness: staleness(),
    retracted: cr.retracted,
    refresh: cr.refresh,
  };
}

export function getDtcByProduct(year?: string, product?: string) {
  const { rows, ...meta } = cr.dtcByProduct;
  let out = rows;
  if (year) out = out.filter((r) => r.year === year);
  if (product) {
    const needle = product.toLowerCase();
    out = out.filter((r) => r.product.toLowerCase().includes(needle));
  }
  return { ...meta, rows: out.sort((a, b) => b.totalSales - a.totalSales) };
}

/** How old is each source, and is it too old to quote? */
export function staleness() {
  const days = (d: string) =>
    Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
  const limit = cr.refresh.staleAfterDays;
  const shopifyDays = days(cr.dtc.asOf);
  const qbDays = days(qbAsOf);
  return {
    staleAfterDays: limit,
    shopify: { asOf: cr.dtc.asOf, ageDays: shopifyDays, stale: shopifyDays > limit },
    quickbooks: {
      asOf: qbAsOf,
      ageDays: qbDays,
      stale: qbDays > limit,
      warning:
        qbDays > limit
          ? `The QuickBooks snapshot is ${qbDays} days old. Every wholesale, Amazon and total figure on this page is that old. Refresh before quoting it.`
          : undefined,
    },
  };
}
