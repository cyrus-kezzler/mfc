// Additive, idempotent seed for the two 2026 Fortnum's distillery editions.
// Recipes by Cyrus, entered 2026-07-15. Creates components/drinks/recipes only
// when absent; never updates existing rows (prices set via the UI are safe).
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const url = (env.match(/^DATABASE_URL=(.*)$/m)?.[1] || "").trim().replace(/^["']|["']$/g, "");
if (!url) { console.error("no DATABASE_URL"); process.exit(1); }
const sql = neon(url);
const today = new Date().toISOString().slice(0, 10);

const NEW_COMPONENTS = [
  { name: "Somerset Cider Brandy", ml: 500, cost: 30.0, notes: "Apples & Pears. PLACEHOLDER price - Cyrus to correct." },
  { name: "Pear Liqueur", ml: 700, cost: 15.0, notes: "Apples & Pears. PLACEHOLDER price." },
  { name: "Suze", ml: 700, cost: 22.0, notes: "Apples & Pears. Gentian aperitif. PLACEHOLDER price." },
  { name: "Clarified Apple Juice (house)", ml: 1000, cost: 3.0, notes: "Apples & Pears. House clarified Bramley, per litre. PLACEHOLDER. May merge with 'Apple Juice' if same." },
  { name: "Peychaud's Bitters", ml: 148, cost: 12.0, notes: "Apples & Pears. PLACEHOLDER. NB label declares Angostura - reconcile." },
  { name: "Ginger Amalthea Gin", ml: 1000, cost: 16.63, notes: "Christmas Gingertini. Ginger-infused; confirm relation to 'Gin (Amalthea)'. PLACEHOLDER." },
  { name: "Hibiscus 1:2 Syrup (house)", ml: 1000, cost: 4.0, notes: "Christmas Gingertini. House syrup, per litre. PLACEHOLDER. Label declares 'Cranberry & Hibiscus' - confirm." },
  { name: "Myatt's Lime (house sour)", ml: 1000, cost: 5.0, notes: "Christmas Gingertini. PLACEHOLDER. May be existing 'Sours base' / declared 'Myatt's Sours' - confirm." },
  { name: "Passoã", ml: 700, cost: 14.0, notes: "Christmas Gingertini. Passionfruit liqueur. PLACEHOLDER." },
  { name: "Ginger Liqueur", ml: 500, cost: 18.0, notes: "Christmas Gingertini. PLACEHOLDER. NB not in F&M declaration - reconcile." },
];

const RECIPES = [
  { drinkSlug: "apples-and-pears", drinkName: "Apples & Pears", clientSlug: "fm",
    lines: [["Somerset Cider Brandy", 15.385], ["Pear Liqueur", 15.385], ["Suze", 7.692], ["Clarified Apple Juice (house)", 30.769], ["Water", 30.769]] },
  { drinkSlug: "christmas-gingertini", drinkName: "Christmas Gingertini", clientSlug: "fm",
    lines: [["Ginger Amalthea Gin", 30.769], ["Hibiscus 1:2 Syrup (house)", 15.385], ["Myatt's Lime (house sour)", 30.769], ["Passoã", 15.385], ["Ginger Liqueur", 7.692]] },
];

const report = [];
async function ensureComponent(c) {
  const ex = await sql`select id from components where lower(name)=lower(${c.name}) limit 1`;
  if (ex.length) { report.push(`component EXISTS  ${c.name} [${ex[0].id}]`); return ex[0].id; }
  const unit = (c.cost / c.ml).toFixed(4);
  const ins = await sql`insert into components (name,type,uom,pack_size,pack_cost,unit_cost,unit_cost_set_at,notes)
    values (${c.name},'ingredient','ml',${String(c.ml)},${c.cost.toFixed(2)},${unit},now(),${c.notes}) returning id`;
  const id = ins[0].id;
  await sql`insert into component_price_history (component_id,unit_cost,currency,uom,effective_date,source,notes)
    values (${id},${unit},'GBP','ml',${today},'manual',${"Seed: pack " + c.ml + "ml @ £" + c.cost.toFixed(2)})`;
  report.push(`component CREATED ${c.name} [${id}] @ £${c.cost.toFixed(2)}/${c.ml}ml`);
  return id;
}

for (const c of NEW_COMPONENTS) await ensureComponent(c);

const nameToId = new Map();
for (const row of await sql`select id,name from components`) nameToId.set(row.name.toLowerCase(), row.id);
const clientId = (await sql`select id from clients where slug='fm' limit 1`)[0].id;

for (const r of RECIPES) {
  let drink = await sql`select id from drinks where slug=${r.drinkSlug} limit 1`;
  let drinkId;
  if (drink.length) { drinkId = drink[0].id; report.push(`drink EXISTS  ${r.drinkSlug} [${drinkId}]`); }
  else { drinkId = (await sql`insert into drinks (slug,name,status) values (${r.drinkSlug},${r.drinkName},'active') returning id`)[0].id; report.push(`drink CREATED ${r.drinkSlug} [${drinkId}]`); }

  const cur = await sql`select id from recipes where drink_id=${drinkId} and client_id=${clientId} and is_current=true limit 1`;
  if (cur.length) { report.push(`recipe EXISTS  ${r.drinkSlug}/fm [${cur[0].id}] - left untouched`); continue; }
  const sum = Math.round(r.lines.reduce((a, [, p]) => a + p, 0) * 1000) / 1000;
  if (Math.abs(sum - 100) > 0.05) { console.error(`SUM ${r.drinkSlug}=${sum}`); process.exit(1); }
  const rid = (await sql`insert into recipes (drink_id,client_id,version,is_current,created_by) values (${drinkId},${clientId},1,true,'seed-fm-2026') returning id`)[0].id;
  let i = 0;
  for (const [name, pct] of r.lines) {
    const cid = nameToId.get(name.toLowerCase());
    if (cid == null) { console.error("missing component " + name); process.exit(1); }
    await sql`insert into recipe_lines (recipe_id,component_id,percentage,display_order) values (${rid},${cid},${pct.toFixed(3)},${i++})`;
  }
  report.push(`recipe CREATED ${r.drinkSlug}/fm [${rid}] - ${r.lines.length} lines, sum ${sum}`);
}
console.log(report.join("\n"));
console.log("\nDONE.");
