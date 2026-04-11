import HubPage, { HubModule } from "@/components/HubPage";

const MODULES: HubModule[] = [
  {
    href: "/sales/crm",
    label: "CRM",
    sublabel: "Contacts & pipeline",
    description:
      "The single record of every buyer, caterer, and retailer — conversations, stage, next action.",
    status: "building",
  },
  {
    href: "/sales/wholesale",
    label: "Wholesale Accounts",
    sublabel: "Retailers & hospitality",
    description:
      "Fortnum & Mason, Cripps, Liberty, Macknade, Bailey & Sage, Italo, British Airways — terms, pricing, and order history.",
    status: "soon",
  },
  {
    href: "/sales/caterers",
    label: "Caterers",
    sublabel: "Event-led pipeline",
    description:
      "The caterer list, five-litre pricing, and event pipeline feeding the kitchen.",
    status: "soon",
  },
  {
    href: "/sales/amazon",
    label: "Amazon",
    sublabel: "Marketplace performance",
    description:
      "Listings, fees, and per-SKU profit — isolating Amazon as a channel so it can be managed on its own terms.",
    status: "soon",
  },
  {
    href: "/sales/dtc",
    label: "D2C / Shopify",
    sublabel: "Direct customers",
    description:
      "Shopify order data, repeat-customer cohorts, and campaign performance.",
    status: "soon",
  },
  {
    href: "/sales/leads",
    label: "Leads & Outreach",
    sublabel: "New business",
    description:
      "Prospects, outreach templates, and a place to log conversations before they become accounts.",
    status: "soon",
  },
];

export default function SalesPage() {
  return (
    <HubPage
      eyebrow="Sales"
      title="Customers & pipeline"
      intro="Every buyer, every channel, every conversation. A CRM is the next thing to build here."
      modules={MODULES}
    />
  );
}
