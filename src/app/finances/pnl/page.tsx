import Nav from "@/components/Nav";
import { getPricingProductsWithLiveCogs } from "@/lib/cogs";
import { DEFAULT_CONFIG } from "@/lib/pricing-data";
import rrpOverridesRaw from "@/data/rrp-overrides.json";
import wholesaleOverridesRaw from "@/data/wholesale-overrides.json";
import PnlClient from "./PnlClient";
import { COLOR } from "@/lib/design";

export default function PnlPage() {
  const products = getPricingProductsWithLiveCogs();
  const rrpOverrides = rrpOverridesRaw as Record<string, number>;
  const wholesaleOverrides = wholesaleOverridesRaw as Record<string, number>;

  const productsWithOverrides = products.map((p) => ({
    ...p,
    rrp: rrpOverrides[p.id] ?? p.rrp,
    wholesaleOverride: wholesaleOverrides[p.id],
  }));

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <PnlClient products={productsWithOverrides} defaultConfig={DEFAULT_CONFIG} />
    </div>
  );
}
