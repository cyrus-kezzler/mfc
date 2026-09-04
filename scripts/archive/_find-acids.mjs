import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const r = await sql`select id, name, type, uom, pack_size, pack_cost, unit_cost, active from components where name ~* 'citric|malic|tartaric|phosphor|salt|water|sour|sugar' order by id`;
for (const c of r) console.log(String(c.id).padStart(3), c.name.padEnd(34), c.type.padEnd(11), c.uom.padEnd(5), 'pack', String(c.pack_size).padEnd(9), String(c.pack_cost).padEnd(8), 'unit', c.unit_cost, c.active ? '' : '(inactive)');
console.log('---- total components:', (await sql`select count(*)::int n from components`)[0].n);
