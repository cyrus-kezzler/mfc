import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const note = 'PLACEHOLDER, not a sourced price. Cyrus, 30 Jul 2026: no per-litre cost for brewed espresso exists yet, work in progress. Standing in at 4.00/L until the yield experiment (1 kg of Monmouth beans to measured litres) and machine amortisation land. Monmouth beans are 25/kg, which implies roughly 1.40 to 1.50 per litre brewed, so this figure is probably HIGH by about two thirds.';
await sql`insert into component_price_history (component_id, unit_cost, uom, effective_date, source, notes) values (23, 0.0040, 'ml', '2026-07-30', 'placeholder', ${note})`;
await sql`update components set notes = ${note}, updated_at = now() where id = 23`;
console.log('espresso marked as placeholder');
for (const c of await sql`select id,name,unit_cost from components where id=23`) console.log(c.id, c.name, c.unit_cost);
