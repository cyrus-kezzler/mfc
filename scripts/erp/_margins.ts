/** Read-only: agreed price against honest COGS, for every priced SKU. */
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../../src/db";
import { skus, skuPrices, systemSettings, SETTING_KEYS } from "../../src/db/schema";
import { computeSkuCost } from "../../src/lib/erp/cogs";

function pad(s: unknown, n: number) {
  const t = String(s ?? "");
  return t.length > n ? t.slice(0, n - 1) + "…" : t.padEnd(n);
}
function r(s: unknown, n: number) {
  return String(s ?? "").padStart(n);
}

async function main() {
  const settings = await db.select().from(systemSettings);
  const markup = Number(settings.find((s) => s.key === SETTING_KEYS.PRICING_MARKUP)?.value ?? 1.4);

  const all = await db.select().from(skus).where(eq(skus.active, true));
  const rows: Array<{
    code: string;
    client: string;
    price: number;
    cogs: number;
    shipping: number;
    margin: number;
    marginPct: number;
    rule: number;
    gap: number;
    placeholder: boolean;
  }> = [];

  for (const s of all) {
    const [p] = await db
      .select()
      .from(skuPrices)
      .where(
        and(eq(skuPrices.skuId, s.id), eq(skuPrices.priceType, "wholesale"), isNull(skuPrices.effectiveTo)),
      );
    if (!p) continue;
    const c = await computeSkuCost(s.id);
    const price = Number(p.amount);
    const shipping = Number(p.shipping ?? 0);
    const margin = price - c.total - shipping;
    const rule = c.total * markup + shipping;
    rows.push({
      code: s.code,
      client: c.clientName ?? "?",
      price,
      cogs: c.total,
      shipping,
      margin,
      marginPct: price > 0 ? (margin / price) * 100 : 0,
      rule,
      gap: price - rule,
      placeholder: c.placeholders.length > 0,
    });
  }

  rows.sort((a, b) => a.marginPct - b.marginPct);

  console.log(
    `\n  ${pad("sku", 30)}${pad("client", 16)}${r("price", 8)}${r("cogs", 8)}${r("ship", 7)}${r("margin", 8)}${r("margin%", 9)}${r("rule", 8)}${r("vs rule", 9)}  flag`,
  );
  console.log("  " + "-".repeat(112));
  for (const x of rows) {
    console.log(
      `  ${pad(x.code, 30)}${pad(x.client, 16)}${r(x.price.toFixed(2), 8)}${r(x.cogs.toFixed(2), 8)}${r(x.shipping.toFixed(2), 7)}${r(x.margin.toFixed(2), 8)}${r(x.marginPct.toFixed(1) + "%", 9)}${r(x.rule.toFixed(2), 8)}${r((x.gap >= 0 ? "+" : "") + x.gap.toFixed(2), 9)}  ${x.placeholder ? "placeholder" : ""}`,
    );
  }

  const losers = rows.filter((x) => x.margin < 0);
  console.log(`\n  ${rows.length} priced SKUs. ${losers.length} sold below cost.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
