import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const r = await sql`select code from skus order by code`;
console.log(r.map(x=>x.code).join(', '));
