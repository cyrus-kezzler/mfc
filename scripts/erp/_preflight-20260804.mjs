import { neon } from "@neondatabase/serverless";
import { readFileSync, writeFileSync } from "node:fs";
const env = readFileSync("/sessions/magical-intelligent-davinci/mnt/back-bar/.env.local", "utf8");
const url = (env.match(/^DATABASE_URL=(.*)$/m)?.[1] || "").trim().replace(/^["']|["']$/g, "");
const sql = neon(url);
const tables = ["components","component_price_history","skus","sku_components","sku_prices","drinks","recipes","system_settings"];
const schema = {};
for (const t of tables) {
  schema[t] = (await sql`select column_name, data_type from information_schema.columns where table_schema='public' and table_name=${t} order by ordinal_position`).map(r=>r.column_name+":"+r.data_type);
}
console.log(JSON.stringify(schema, null, 1));
const dump = {};
for (const t of ["components","skus","sku_components","sku_prices"]) {
  dump[t] = await sql.query(`select * from ${t} order by id`);
}
writeFileSync("/sessions/magical-intelligent-davinci/mnt/outputs/backbar-preflight-20260804.json", JSON.stringify(dump, null, 2));
console.log("COUNTS", Object.fromEntries(Object.entries(dump).map(([k,v])=>[k,v.length])));
