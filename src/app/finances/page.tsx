import HubPage, { HubModule } from "@/components/HubPage";

const MODULES: HubModule[] = [
  {
    href: "/finances/ingredients",
    label: "Ingredients",
    sublabel: "Master list & unit cost",
    description:
      "Every ingredient we buy, its current unit cost, and a dated history of every price change. Model an ingredient price rise and see which drinks it hits.",
    status: "live",
  },
  {
    href: "/dashboard",
    label: "Revenue Overview",
    sublabel: "YTD revenue & partners",
    description:
      "Total revenue, DTC vs wholesale split, partner revenue boxes, concentration risk, and Shopify live orders.",
    status: "live",
  },
  {
    href: "/finances/pricing",
    label: "Wholesale Pricing",
    sublabel: "Live COGS → wholesale",
    description:
      "COGS derived from the ingredient master, markup and retailer test applied. The opening position for any new or existing wholesale partner.",
    status: "live",
  },
  {
    href: "/finances/profitability",
    label: "COGS Reconciliation",
    sublabel: "Derived vs legacy",
    description:
      "Derived COGS (liquid + labour) compared to legacy hardcoded values. Use this to audit and validate the model.",
    status: "live",
  },
  {
    href: "/finances/channel-pnl",
    label: "Channel P&L",
    sublabel: "Every partner × every drink",
    description:
      "Pivot by partner, drink or ingredient to see what you sell to whom, the current deal, and the impact of any cost change.",
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
