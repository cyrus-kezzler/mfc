import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
console.log('--- the two components ---');
for (const c of await sql`select id,name,type,uom,pack_size,pack_cost,unit_cost,unit_cost_set_at,active,notes from components where id in (23,51)`) {
  console.log(c.id, '|', c.name, '|', c.uom, '| pack', c.pack_size, c.pack_cost, '| unit', c.unit_cost, '| set', c.unit_cost_set_at, '| active', c.active);
  console.log('     notes:', (c.notes||'').slice(0,150));
}
console.log('--- recipe lines referencing them ---');
for (const r of await sql`select rl.component_id, r.id recipe_id, d.name drink, cl.name client, rl.percentage from recipe_lines rl join recipes r on r.id=rl.recipe_id join drinks d on d.id=r.drink_id join clients cl on cl.id=r.client_id where rl.component_id in (23,51)`) {
  console.log(' comp', r.component_id, '->', r.drink, '[' + r.client + ']', r.percentage + '%');
}
console.log('--- price history rows ---');
for (const h of await sql`select component_id, count(*)::int n from component_price_history where component_id in (23,51) group by component_id`) console.log(' comp', h.component_id, h.n, 'rows');
console.log('--- sku_components referencing them ---');
console.log((await sql`select count(*)::int n from sku_components where component_id in (23,51)`)[0].n);
console.log('--- component_recipes referencing them ---');
console.log((await sql`select count(*)::int n from component_recipes where child_component_id in (23,51) or parent_component_id in (23,51)`)[0].n);
