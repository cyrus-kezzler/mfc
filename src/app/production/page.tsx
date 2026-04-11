import HubPage, { HubModule } from "@/components/HubPage";

const MODULES: HubModule[] = [
  {
    href: "/calculator",
    label: "Batch Calculator",
    sublabel: "Volumes for production",
    description:
      "Select a client, choose a recipe, and get precise ingredient volumes for any batch size. Mobile-first for the kitchen.",
    status: "live",
  },
  {
    href: "/production/inventory",
    label: "Inventory",
    sublabel: "Stock & dispatch",
    description:
      "Live view of every bottle produced, dispatched, or sitting in stock — across Amazon, Shopify, and wholesale.",
    status: "soon",
  },
  {
    href: "/production/master-list",
    label: "Cocktail Master List",
    sublabel: "Recipe ratios",
    description:
      "The canonical spec for every drink: ingredient ratios, batch yields, and sub-recipe dependencies.",
    status: "soon",
  },
  {
    href: "/production/audit",
    label: "Stock Audit",
    sublabel: "Physical stocktake",
    description:
      "Guided quarterly stocktake — count, value, and reconcile wet goods and dry goods.",
    status: "soon",
  },
  {
    href: "/production/schedule",
    label: "Production Schedule",
    sublabel: "What to make, when",
    description:
      "Upcoming orders, batch plans, and bottling days — pull forecasts from Shopify and wholesale pipeline.",
    status: "soon",
  },
  {
    href: "/production/suppliers",
    label: "Suppliers & Purchasing",
    sublabel: "Raw materials",
    description:
      "Bottles, caps, jerry cans, labels, spirits — reorder points, lead times, and supplier contacts.",
    status: "soon",
  },
];

export default function ProductionPage() {
  return (
    <HubPage
      eyebrow="Production"
      title="Kitchen & fulfilment"
      intro="Everything that turns ingredients into bottled cocktails on a shelf — batching, inventory, purchasing, and audit."
      modules={MODULES}
    />
  );
}
