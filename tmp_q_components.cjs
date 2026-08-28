const { neon } = require("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);
(async () => {
  const names = [
    "Belle de Brillet (pear liqueur)", "Suze", "Somerset Cider Brandy",
    "Ginger Amalthea Gin", "Passoã", "Ginger Liqueur", "Angostura Bitters",
    "Clarified Apple Juice (house)", "Cranberry & Hibiscus Syrup (house)",
    "Myatt's Sours", "Water", "F&M 6-bottle outer carton (500ml)",
  ];
  const c = await sql`select id, name, abv, unit_cost, unit_cost_set_at, pack_size, pack_cost, purchase_label, default_supplier_id, notes from components where name = ANY(${names})`;
  for (const r of c)
    console.log([r.id, r.name, "abv " + r.abv, "unit £" + r.unit_cost, "pack " + r.pack_size + " @ £" + r.pack_cost, "set " + (r.unit_cost_set_at ? String(r.unit_cost_set_at).slice(0, 15) : "never"), "sup " + r.default_supplier_id, (r.notes || "").slice(0, 160)].join(" | "));
  const s = await sql`select id, name from suppliers order by id`;
  console.log("SUPPLIERS:", s.map(x => x.id + ":" + x.name).join(", "));
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
