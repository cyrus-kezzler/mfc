import Nav from "@/components/Nav";
import { getPricingProductsWithLiveCogs } from "@/lib/cogs";
import { DEFAULT_CONFIG } from "@/lib/pricing-data";
import PricingClient from "./PricingClient";

export default function PricingPage() {
  const products = getPricingProductsWithLiveCogs();
  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      <Nav />
      <PricingClient products={products} defaultConfig={DEFAULT_CONFIG} />
    </div>
  );
}
