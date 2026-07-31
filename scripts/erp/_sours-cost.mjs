import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const note = 'DERIVED from component_recipes on 30 Jul 2026, not asserted: 0.62 per litre. Previously carried a hand-typed 5.00 per litre, roughly eight times the truth, which overstated every drink using Sours. Do not hand-edit: re-derive from the sub-recipe.';
const r = await sql`update components set pack_size = 1000.000, pack_cost = 0.62, unit_cost = 0.0006, unit_cost_set_at = now(), notes = ${note}, updated_at = now() where name = 'Myatt''s Sours' returning id, name, pack_cost, unit_cost`;
console.log(JSON.stringify(r[0]));
await sql`insert into component_price_history (component_id, unit_cost, uom, effective_date, source, notes) values (${r[0].id}, 0.0006, 'ml', '2026-07-30', 'manual', ${note})`;
console.log('history row written');
