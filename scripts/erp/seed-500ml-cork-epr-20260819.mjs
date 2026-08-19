// Additive, idempotent: the Croxsons 500ml cork and the 500ml EPR line, and their
// BOM rows on all 19 own-brand 500ml SKUs. 19 Aug 2026.
//
// WHY: no 500ml SKU has ever carried a closure or an EPR line. Confirmed by query
// 19 Aug 2026: closure=0 and epr=0 on all nineteen. This is the 31 Jul "no glass in
// COGS" fault one layer down, found again on 10 Aug and left open for nine days.
//
// Basis: Croxsons proforma 20536 paid 13 Aug 2026, invoice 110408, pallet delivered
// 18 Aug 2026. Conventions follow components 75/76 (cork priced ex EPR) and 79/80
// (one EPR component bundling bottle + cork EPR).
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const url = (env.match(/^DATABASE_URL=(.*)$/m)?.[1] || "").trim().replace(/^["']|["']$/g, "");
if (!url) { console.error("no DATABASE_URL"); process.exit(1); }
const sql = neon(url);
const TODAY = "2026-08-19";
const report = [];

async function ensureDryGood(name, cost, notes) {
  const ex = await sql`select id, unit_cost from components where lower(name)=lower(${name}) limit 1`;
  if (ex.length) { report.push(`component EXISTS  ${name} [${ex[0].id}] @ £${ex[0].unit_cost}`); return ex[0].id; }
  const unit = cost.toFixed(4);
  const ins = await sql`insert into components (name,type,uom,pack_size,pack_cost,unit_cost,unit_cost_set_at,notes)
    values (${name},'dry_good','each','1',${cost.toFixed(2)},${unit},now(),${notes}) returning id`;
  const id = ins[0].id;
  await sql`insert into component_price_history (component_id,unit_cost,currency,uom,effective_date,source,notes)
    values (${id},${unit},'GBP','each',${TODAY},'manual',${notes})`;
  report.push(`component CREATED ${name} [${id}] @ £${unit}`);
  return id;
}

const corkId = await ensureDryGood(
  "Cork 34x12 micro-agglomerated (Croxsons 11ZBS034BW)",
  0.2084,
  "Fits the Croxsons 500ml Apollo cork mouth. GBP 208.41 per 1,000, Croxsons proforma 20536 paid 13 Aug 2026, invoice 110408, delivered 18 Aug 2026. Priced EX EPR per the component 75/76 convention; the cork's EPR is carried in the 500ml EPR line. Minimum order 1,000 because corks ship in bags of 500 and Croxsons will not split a bag: doing so would compromise the integrity of the corks for food and drink use (Sue Barnes, 11 Aug 2026, accepted by Cyrus the same day). 1,000 bought against 770 the pallet consumes, so 230 are working stock. Courier waived, corks packed onto the pallet.",
);

const eprId = await ensureDryGood(
  "EPR - 500ml Apollo (bottle+cork)",
  0.1465,
  "Croxsons, restated 11 Aug 2026: bottle EPR GBP 144.00 per 1,000 = GBP 0.1440, plus cork EPR GBP 2.52 per 1,000 = GBP 0.00252. Bundled per the component 79/80 convention. The restatement was won by asking for the rate per 1,000 rather than confirmation of the total, which exposed a 4 Jun quotation still priced on a stale 1,540-unit pallet. NOT VERIFIED: at 14.4p the 500ml attracts 42 per cent more glass EPR than the 700ml Blackwell's 10.115p, on the lighter bottle, which is not credible on a levy charged by weight. Sue Barnes has owed the bottle unit weight in grams since 11 Aug 2026. Paid, not verified. EPR is not yet passed through to Cripps or F&M (open, 22 Jul 2026).",
);

// ── BOM rows on every own-brand 500ml SKU ──────────────────────────────────
const skus = await sql`select id, code from skus where size_ml=500 order by id`;
let added = 0, skipped = 0;
for (const s of skus) {
  for (const [cid, role, label] of [[corkId,'closure','cork'],[eprId,'epr','EPR']]) {
    const r = await sql`
      insert into sku_components (sku_id, component_id, quantity, role, include_in_cogs, notes)
      values (${s.id}, ${cid}, '1', ${role}, true, ${'Croxsons 500ml Apollo set, added 19 Aug 2026. Primary packaging, in COGS per the 30 Jul 2026 ruling.'})
      on conflict (sku_id, component_id) do nothing
      returning id`;
    if (r.length) { added++; report.push(`  + ${s.code} ${label}`); } else { skipped++; }
  }
}
report.push(`\nBOM rows added ${added}, already present ${skipped}, across ${skus.length} SKUs`);
console.log(report.join("\n"));
