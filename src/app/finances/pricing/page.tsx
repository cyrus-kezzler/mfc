import Nav from "@/components/Nav";
import { getPricingProductsWithLiveCogs } from "@/lib/cogs";
import { DEFAULT_CONFIG } from "@/lib/pricing-data";
import rrpOverridesRaw from "@/data/rrp-overrides.json";
import PricingClient from "./PricingClient";

export default function PricingPage() {
  const products = getPricingProductsWithLiveCogs();
  const rrpOverrides: Record<string, number> = rrpOverridesRaw as Record<string, number>;

  // Apply persisted RRP overrides
  const productsWithRrp = products.map((p) => ({
    ...p,
    rrp: rrpOverrides[p.id] ?? p.rrp,
  }));

  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      <Nav />
      <PricingClient
        products={productsWithRrp}
        defaultConfig={DEFAULT_CONFIG}
        rrpOverrides={rrpOverrides}
      />
    </div>
  );
}
