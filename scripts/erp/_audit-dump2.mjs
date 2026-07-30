// Temporary read-only audit dump 2. Not committed.
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

const rec = await sql`
  select cl.slug as client, d.slug as drink, r.version
  from recipes r join drinks d on d.id = r.drink_id join clients cl on cl.id = r.client_id
  where r.is_current order by cl.slug, d.slug`;
console.log("=== current recipes by client ===");
for (const r of rec) console.log([r.client, r.drink, "v" + r.version].join(" ~ "));

const hist = await sql`
  select h.component_id, c.name, h.unit_cost, h.effective_date, h.source, h.notes
  from component_price_history h join components c on c.id = h.component_id
  order by h.component_id, h.effective_date`;
console.log("=== full price history ===", hist.length);
for (const h of hist) console.log([h.component_id, h.name, h.unit_cost, h.effective_date instanceof Date ? h.effective_date.toISOString().slice(0,10) : h.effective_date, h.source, (h.notes ?? "").replaceAll("\n"," | ")].join(" ~ "));
