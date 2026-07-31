// Temporary read-only audit dump for the one-master slice. Not committed.
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const components = await sql`
  select id, name, type, uom, pack_size, pack_cost, unit_cost, unit_cost_set_at, active, notes
  from components order by type, name`;
console.log("=== components ===");
for (const c of components) {
  console.log(
    [c.id, c.type, c.uom, c.name, c.pack_size, c.pack_cost, c.unit_cost, c.unit_cost_set_at ? new Date(c.unit_cost_set_at).toISOString().slice(0, 10) : null, c.active ? "" : "INACTIVE", (c.notes ?? "").replaceAll("\n", " | ")].join(" ~ "),
  );
}

const hist = await sql`
  select component_id, count(*) as n, max(effective_date) as latest,
         array_agg(distinct source) as sources
  from component_price_history group by component_id order by component_id`;
console.log("=== price history summary ===");
for (const h of hist) console.log([h.component_id, h.n, h.latest, h.sources].join(" ~ "));

const em = await sql`
  select d.slug as drink, cl.slug as client, r.id as recipe_id, r.version,
         co.id as comp_id, co.name as comp, rl.percentage, co.unit_cost, co.uom, co.unit_cost_set_at
  from recipes r
  join drinks d on d.id = r.drink_id
  join clients cl on cl.id = r.client_id
  join recipe_lines rl on rl.recipe_id = r.id
  join components co on co.id = rl.component_id
  where r.is_current and d.slug like '%espresso%'
  order by cl.slug, rl.display_order`;
console.log("=== espresso martini current recipes ===");
for (const l of em) console.log([l.drink, l.client, l.recipe_id, "v" + l.version, l.comp_id, l.comp, l.percentage + "%", l.unit_cost, l.uom, l.unit_cost_set_at ? new Date(l.unit_cost_set_at).toISOString().slice(0, 10) : null].join(" ~ "));

const settings = await sql`select key, value from system_settings order by key`;
console.log("=== system settings ===");
for (const s of settings) console.log(s.key + " = " + s.value);

const skuRows = await sql`select code, size_ml, active from skus order by code`;
console.log("=== skus ===", skuRows.length);
for (const s of skuRows.slice(0, 60)) console.log([s.code, s.size_ml, s.active ? "" : "INACTIVE"].join(" ~ "));
