import HubPage, { HubModule } from "@/components/HubPage";

const MODULES: HubModule[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    sublabel: "Live financial overview",
    description:
      "Revenue, wholesale invoices, customer concentration, and live Shopify and QuickBooks data.",
    status: "live",
  },
  {
    href: "/finances/profitability",
    label: "Profitability",
    sublabel: "COGS & margin",
    description:
      "Per-SKU cost of goods, margin, and retail pricing across 500ml and 250ml formats.",
    status: "soon",
  },
  {
    href: "/finances/channels",
    label: "Channel P&L",
    sublabel: "Margin by sales channel",
    description:
      "Compare returns across Shopify, Amazon, Fortnum & Mason, Cripps, BA, Apple Crumble, and caterer pricing.",
    status: "soon",
  },
  {
    href: "/finances/audit",
    label: "Stock Audit",
    sublabel: "Wet goods & value",
    description:
      "Physical stocktake of wet goods by size and quantity, valued for year-end and variance analysis.",
    status: "soon",
  },
  {
    href: "/finances/quickbooks",
    label: "QuickBooks Sales",
    sublabel: "Wholesale invoices",
    description:
      "Historic wholesale invoice data from 2017 onwards, mapped to customers and products.",
    status: "soon",
  },
  {
    href: "/finances/shopify",
    label: "Shopify Sales",
    sublabel: "Direct-to-consumer",
    description:
      "Order-level D2C data with SKU, postcode, week and month breakdowns.",
    status: "soon",
  },
];

export default function FinancesPage() {
  return (
    <HubPage
      eyebrow="Finances"
      title="Money in, money out"
      intro="Profitability, audit, and the live read on where the business makes — and loses — money."
      modules={MODULES}
    />
  );
}
