import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const url = (env.match(/^DATABASE_URL=(.*)$/m)?.[1] || "").trim().replace(/^["']|["']$/g, "");
const sql = neon(url);

const comps = new Map((await sql`select * from components`).map(c => [c.id, c]));
const perUom = c => { const s = Number(c.pack_size), p = Number(c.pack_cost); return (s > 1 && p > 0) ? p / s : Number(c.unit_cost); };
const wast = Number((await sql`select value from system_settings where key='wastage_pct'`)[0].value);
const markup = Number((await sql`select value from system_settings where key='pricing_markup'`)[0].value);

const skus = await sql`select s.id, s.code, s.size_ml, s.drink_id, s.client_id from skus s where s.client_id=1 and s.size_ml in (50,500,700,5000) order by s.code`;
const out = [];
for (const s of skus) {
  const [rec] = await sql`select id from recipes where drink_id=${s.drink_id} and client_id=${s.client_id} and is_current=true`;
  let liquid = 0, probs = [];
  if (!rec) probs.push("NO RECIPE");
  else {
    const lines = await sql`select component_id, percentage from recipe_lines where recipe_id=${rec.id}`;
    const pct = lines.reduce((a, l) => a + Number(l.percentage), 0);
    if (Math.abs(pct - 100) > 0.01) probs.push(`pct=${pct.toFixed(2)}`);
    for (const l of lines) liquid += (Number(l.percentage) / 100) * s.size_ml * perUom(comps.get(l.component_id));
  }
  let pack = 0;
  for (const b of await sql`select component_id, quantity, include_in_cogs from sku_components where sku_id=${s.id}`)
    if (b.include_in_cogs) pack += Number(b.quantity) * perUom(comps.get(b.component_id));
  const cogs = (liquid + pack) * (1 + wast);
  const prices = await sql`select price_type, amount, shipping from sku_prices where sku_id=${s.id} and effective_to is null order by effective_from desc`;
  const ws = prices.find(p => p.price_type === "wholesale");
  const rrp = prices.find(p => p.price_type === "rrp");
  const ship = ws ? Number(ws.shipping || 0) : 0;
  out.push({ code: s.code, size: s.size_ml, liquid: +liquid.toFixed(2), pack: +pack.toFixed(2), cogs: +cogs.toFixed(2),
    wholesale: ws ? +Number(ws.amount).toFixed(2) : null, rrp: rrp ? +Number(rrp.amount).toFixed(2) : null,
    rule: +(cogs * markup + ship).toFixed(2), probs: probs.join(";") });
}
console.log("code,size,liquid,packaging,COGS,agreed_wholesale,rrp,rule_price,problems");
for (const r of out) console.log([r.code, r.size, r.liquid, r.pack, r.cogs, r.wholesale ?? "", r.rrp ?? "", r.rule, r.probs].join(","));
