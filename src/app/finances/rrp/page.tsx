import Nav from "@/components/Nav";
import { getPricingProductsWithLiveCogs } from "@/lib/cogs";
import { DEFAULT_CONFIG } from "@/lib/pricing-data";
import rrpOverridesRaw from "@/data/rrp-overrides.json";
import amazonOverridesRaw from "@/data/amazon-overrides.json";
import rrpNotesRaw from "@/data/rrp-notes.json";
import shopifySyncRaw from "@/data/shopify-rrp-sync.json";
import RrpClient from "./RrpClient";
import { COLOR } from "@/lib/design";

export default function RrpPage() {
  const products = getPricingProductsWithLiveCogs();
  const rrpOverrides = rrpOverridesRaw as Record<string, number>;
  const amazonOverrides = amazonOverridesRaw as Record<string, number>;
  const rrpNotes = rrpNotesRaw as Record<string, string>;
  const shopifySync = shopifySyncRaw as Record<string, number>;

  const productsWithOverrides = products.map((p) => ({
    ...p,
    rrp: rrpOverrides[p.id] ?? p.rrp,
  }));

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <RrpClient
        products={productsWithOverrides}
        defaultConfig={DEFAULT_CONFIG}
        rrpOverrides={rrpOverrides}
        amazonOverrides={amazonOverrides}
        rrpNotes={rrpNotes}
        shopifySync={shopifySync}
      />
    </div>
  );
}
