// Additive, idempotent seed: full own-brand size ladder (50/500/700/5000ml)
// plus the caterers price list, 04 Aug 2026. Spec by Cyrus, executed 04 Aug 2026.
// Creates components/SKUs/BOM lines/price rows only when absent. The ONE
// permitted update: the 50ml miniature bottle restored from the 22 Jul £0.00
// write-off to the audited £0.21 (new price-history row + component update).
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const url = (env.match(/^DATABASE_URL=(.*)$/m)?.[1] || "").trim().replace(/^["']|["']$/g, "");
if (!url) { console.error("no DATABASE_URL"); process.exit(1); }
const sql = neon(url);
const TODAY = "2026-08-04";
const report = [];
const counts = { components: 0, skus: 0, bom: 0, prices: 0 };

// ── Components ─────────────────────────────────────────────────────────────
async function ensureDryGood(name, cost, notes) {
  const ex = await sql`select id from components where lower(name)=lower(${name}) limit 1`;
  if (ex.length) { report.push(`component EXISTS  ${name} [${ex[0].id}]`); return ex[0].id; }
  const unit = cost.toFixed(4);
  const ins = await sql`insert into components (name,type,uom,pack_size,pack_cost,unit_cost,unit_cost_set_at,notes)
    values (${name},'dry_good','each','1',${cost.toFixed(2)},${unit},now(),${notes}) returning id`;
  const id = ins[0].id;
  await sql`insert into component_price_history (component_id,unit_cost,currency,uom,effective_date,source,notes)
    values (${id},${unit},'GBP','each',${TODAY},'manual',${notes})`;
  counts.components++;
  report.push(`component CREATED ${name} [${id}] @ £${cost.toFixed(4)}`);
  return id;
}

const jerrycanId = await ensureDryGood("5L jerrycan (catering)", 2.00,
  "Caterers pack. Price per Cyrus 04 Aug 2026; includes cap (TBC).");
const capId = await ensureDryGood("50ml cap/hygiene", 0.06,
  "From 14 Jul Flight CFO costing.");
const front700Id = await ensureDryGood("Front label - Myatt's Fields 700ml (presumed)", 0.60,
  "Presumed equal to Cripps label price per Cyrus 04 Aug 2026; no own-brand 700ml print run exists yet.");
const hygiene700Id = await ensureDryGood("Hygiene label - Myatt's Fields 700ml (presumed)", 0.15,
  "Presumed equal to Cripps label price per Cyrus 04 Aug 2026; no own-brand 700ml print run exists yet.");

// Watchstrap label: verify, create only if absent.
let watchstrapId;
{
  const ex = await sql`select id, unit_cost from components where name ilike '%watchstrap%' limit 1`;
  if (ex.length) { watchstrapId = ex[0].id; report.push(`component EXISTS  50ml watchstrap label [${watchstrapId}] @ £${ex[0].unit_cost}`); }
  else watchstrapId = await ensureDryGood("50ml watchstrap label", 0.0428, "Acorn-sourced. Seed 04 Aug 2026.");
}

// ── THE ONE UPDATE: 50ml miniature bottle back to £0.21 ────────────────────
const MINI_NOTE = "Restored to audited China cost per Cyrus 04 Aug 2026: fully loaded 50ml SKU costing. The write-off remains a Choose Six contribution concept, not a register price. Reverses the 22 Jul register-level write-off.";
const [mini] = await sql`select id, unit_cost from components where name ilike '50ml miniature bottle' limit 1`;
if (!mini) { console.error("STOP: no 50ml miniature bottle component"); process.exit(1); }
const miniId = mini.id;
if (Number(mini.unit_cost) === 0.21) {
  report.push(`mini bottle ALREADY £0.21 [${miniId}] - untouched`);
} else {
  await sql`insert into component_price_history (component_id,unit_cost,currency,uom,effective_date,source,notes)
    values (${miniId},'0.2100','GBP','each',${TODAY},'manual',${MINI_NOTE})`;
  await sql`update components set unit_cost='0.2100', pack_cost='0.21', unit_cost_set_at=now(), updated_at=now() where id=${miniId}`;
  report.push(`mini bottle RESTORED [${miniId}] £0.00 -> £0.21 (history row added)`);
}

// ── SKUs ───────────────────────────────────────────────────────────────────
const PREFIXES = ["baby-otis","cold-brew-negroni","corpse-reviver","dempsey","desert-negroni",
  "espresso-martini","gibson-martini","lychee-martini","manhattan","margarita","naked-and-famous",
  "negroni","pisco-martini","red-hook","rum-old-fashioned","sakura-martini","trident","tuxedo","vesper"];
const [anchor] = await sql`select client_id from skus where code='espresso-martini-250' limit 1`;
const clientId = anchor.client_id; // own-brand (Myatt's Fields)

// Component ids for BOMs (resolved live, not hardcoded).
const cid = async (name) => (await sql`select id from components where lower(name)=lower(${name}) limit 1`)[0].id;
const bottle500 = await cid("500ml bottle");
const front500 = await cid("Front label - Myatt's Fields");
const hygiene500 = await cid("Hygiene label - Myatt's Fields");
const bottle700 = await cid("700ml bottle (Blackwell)");
const cork700 = await cid("Cork 30x12mm micro-agglomerated");
const epr700 = await cid("EPR - 700ml Blackwell (glass+wood+cork)");

const BOMS = {
  50:   [[miniId,"bottle"],[watchstrapId,"front_label"],[capId,"closure"]],
  500:  [[bottle500,"bottle"],[front500,"front_label"],[hygiene500,"hygiene_label"]],
  700:  [[bottle700,"bottle"],[cork700,"closure"],[front700Id,"front_label"],[hygiene700Id,"hygiene_label"],[epr700,"epr"]],
  5000: [[jerrycanId,"bottle"]],
};

const WHOLESALE_700 = { "baby-otis":30.00,"cold-brew-negroni":25.50,"corpse-reviver":19.50,"dempsey":28.50,
  "desert-negroni":31.00,"espresso-martini":19.00,"gibson-martini":22.50,"lychee-martini":23.50,"manhattan":38.00,
  "margarita":28.50,"naked-and-famous":34.00,"negroni":26.50,"pisco-martini":27.50,"red-hook":34.00,
  "rum-old-fashioned":25.00,"sakura-martini":40.00,"trident":27.50,"tuxedo":26.00,"vesper":26.00 };
const WHOLESALE_5000 = { "baby-otis":204,"cold-brew-negroni":173,"corpse-reviver":142,"dempsey":193,
  "desert-negroni":210,"espresso-martini":125,"gibson-martini":159,"lychee-martini":163,"manhattan":261,
  "margarita":190,"naked-and-famous":229,"negroni":177,"pisco-martini":185,"red-hook":232,
  "rum-old-fashioned":171,"sakura-martini":274,"trident":184,"tuxedo":175,"vesper":175 };
const NOTE_5000 = "Caterers price list 04 Aug 2026 (formula: COGS + labour + max(£50, 40% COGS), rounded)";
const NOTE_700 = "Caterers list 04 Aug 2026, rule price rounded to 50p";
const NOTE_700_ESP = "Floored at Cripps agreed £18.69 -> £19.00, Cyrus guard 04 Aug 2026";

async function ensureSku(code, drinkId, sizeMl) {
  const ex = await sql`select id from skus where code=${code} limit 1`;
  if (ex.length) { report.push(`sku EXISTS  ${code} [${ex[0].id}]`); return { id: ex[0].id, created: false }; }
  const ins = await sql`insert into skus (code,drink_id,size_ml,active,client_id) values (${code},${drinkId},${sizeMl},true,${clientId}) returning id`;
  counts.skus++;
  report.push(`sku CREATED ${code} [${ins[0].id}]`);
  return { id: ins[0].id, created: true };
}

async function ensureBomLine(skuId, componentId, role) {
  const ex = await sql`select id from sku_components where sku_id=${skuId} and component_id=${componentId} limit 1`;
  if (ex.length) return;
  await sql`insert into sku_components (sku_id,component_id,quantity,role,include_in_cogs) values (${skuId},${componentId},'1.0000',${role},true)`;
  counts.bom++;
}

async function ensurePrice(skuId, type, amount, shipping, notes) {
  const ex = await sql`select id from sku_prices where sku_id=${skuId} and price_type=${type} and effective_from=${TODAY} limit 1`;
  if (ex.length) { report.push(`price EXISTS  sku ${skuId} ${type}`); return; }
  await sql`insert into sku_prices (sku_id,price_type,amount,effective_from,shipping,notes)
    values (${skuId},${type},${amount.toFixed(2)},${TODAY},${shipping === null ? null : shipping.toFixed(4)},${notes})`;
  counts.prices++;
  report.push(`price CREATED sku ${skuId} ${type} £${amount.toFixed(2)}`);
}

for (const prefix of PREFIXES) {
  const [base] = await sql`select drink_id from skus where code=${prefix + "-250"} limit 1`;
  if (!base) { console.error(`STOP: no 250ml SKU for ${prefix}`); process.exit(1); }
  const drinkId = base.drink_id;

  for (const size of [50, 500, 700, 5000]) {
    const code = `${prefix}-${size}`;
    const sku = await ensureSku(code, drinkId, size);
    // BOM: 50/700/5000 SKUs are all created by this seed, so fill (idempotently)
    // even on a resumed run; pre-existing 500ml BOMs are never touched.
    if (sku.created || size !== 500) for (const [compId, role] of BOMS[size]) await ensureBomLine(sku.id, compId, role);
    // Prices (additive; keyed on sku+type+effective_from so re-runs are safe).
    if (size === 50) {
      await ensurePrice(sku.id, "rrp", 5.00, 0.19,
        "Ladder seed 04 Aug 2026. RRP £5.00; no agreed wholesale. Shipping £0.19 recorded here for reference (engine reads shipping from wholesale rows only).");
    } else if (size === 700) {
      await ensurePrice(sku.id, "wholesale", WHOLESALE_700[prefix], 0.00,
        prefix === "espresso-martini" ? NOTE_700_ESP : NOTE_700);
    } else if (size === 5000) {
      await ensurePrice(sku.id, "wholesale", WHOLESALE_5000[prefix], 0.00, NOTE_5000);
    }
    // size 500: no price rows; rule price computes live.
  }
}

console.log(report.join("\n"));
console.log("COUNTS", JSON.stringify(counts));
