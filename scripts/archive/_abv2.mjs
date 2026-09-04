import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const rows = [['Old Tom Gin','41.40'],["Myatt's Sours",'0.00']];
for (const [name, abv] of rows) {
  const r = await sql`update components set abv = ${abv}, updated_at = now() where name = ${name} returning id, name, abv`;
  console.log(r.length ? `SET ${r[0].name} -> ${r[0].abv}%` : `NOT FOUND: ${name}`);
}
