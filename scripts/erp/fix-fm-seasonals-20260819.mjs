// Correct the two F&M distillery editions from 350ml/12-pack to 500ml/6-pack,
// and mark the Fortnum's-supplied components as such. 19 Aug 2026.
//
// AUTHORITY: Cyrus ruled 12 Aug 2026 that the label is the truth and Back Bar is
// wrong. PO PU215780 and the signed-off label artwork both say 50cl, case of 6.
// Cyrus confirmed the same day that F&M supplies the glass, corks and labels, per
// Stina Lundberg's line of 10 Jul. Step 5 of that record prescribes exactly this.
//
// MODEL: supplied components are kept as BOM lines flagged supplied_by_customer
// rather than deleted, per the 12 Aug working sheet, "so that a future reader can
// tell the difference between a component we do not pay for and one nobody
// remembered". EPR follows the glass, so it is Fortnum's under the 22 Jul split.
//
// NOT DONE HERE: Angostura on Apples & Pears. It sits in recipes.method and not in
// recipe_lines, and every recipe totals exactly 100%, so adding it forces a
// rebalance of the other five lines. That is a recipe decision and it is Cyrus's.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const url = (env.match(/^DATABASE_URL=(.*)$/m)?.[1] || "").trim().replace(/^["']|["']$/g, "");
const sql = neon(url);
const TODAY = "2026-08-19";
const log = [];

async function ensure(name, cost, notes) {
  const ex = await sql`select id from components where lower(name)=lower(${name}) limit 1`;
  if (ex.length) { log.push(`component EXISTS  ${name} [${ex[0].id}]`); return ex[0].id; }
  const unit = cost.toFixed(4);
  const ins = await sql`insert into components (name,type,uom,pack_size,pack_cost,unit_cost,unit_cost_set_at,notes)
    values (${name},'dry_good','each','1',${cost.toFixed(2)},${unit},now(),${notes}) returning id`;
  await sql`insert into component_price_history (component_id,unit_cost,currency,uom,effective_date,source,notes)
    values (${ins[0].id},${unit},'GBP','each',${TODAY},'manual',${notes})`;
  log.push(`component CREATED ${name} [${ins[0].id}] @ £${unit}`);
  return ins[0].id;
}

const FM_SUPPLIED = "Fortnum & Mason supplies this on the distillery editions, so our cost is £0.00 (Cyrus, confirmed 12 Aug 2026, per Stina Lundberg 10 Jul 2026). £0.00 is the true cost TO US, not a placeholder for an unknown number. Carried as a visible line rather than deleted so the absence reads as a decision. As of 12 Aug the supply had no delivery date and had never been requested, and the bottling block cannot be placed until it does.";

const bottleId = await ensure("F&M 500ml bottle (Fortnum's supplied)", 0, FM_SUPPLIED);
const corkId   = await ensure("F&M 500ml cork (Fortnum's supplied)", 0, FM_SUPPLIED);
const eprId    = await ensure("EPR - F&M 500ml (Fortnum's supplied)", 0,
  FM_SUPPLIED + " EPR follows the component: if Fortnum's place the glass on the market, the liability is theirs under the 22 Jul 2026 split ruling.");
const cartonId = await ensure("F&M 6-bottle outer carton (500ml)", 0.90,
  "PLACEHOLDER, 19 Aug 2026. PO PU215780 specifies Case 6 and no 6-bottle outer has ever been priced. £0.90 a carton, £0.15 a bottle, carried from the 12 Aug PU215780 working sheet. Replaces the F&M 12-box outer carton, which was the wrong case configuration.");

const targets = [
  { old: "apples-and-pears-350-fm",     neu: "apples-and-pears-500-fm" },
  { old: "christmas-gingertini-350-fm", neu: "christmas-gingertini-500-fm" },
];

for (const t of targets) {
  const s = (await sql`select id, code, size_ml from skus where code=${t.old}`)[0];
  if (!s) { log.push(`SKIP ${t.old} not found (already corrected?)`); continue; }
  log.push(`\n── ${t.old} [sku ${s.id}] ──`);

  await sql`update skus set size_ml=500, code=${t.neu}, updated_at=now() where id=${s.id}`;
  log.push(`  size_ml ${s.size_ml} -> 500, code -> ${t.neu}`);

  // Drop the wrong-size / wrong-config lines.
  for (const [cid, what] of [[15,'F&M 350ml bottle'],[76,'Cork 19mm wood-top'],[80,'EPR - F&M 350ml'],[19,'F&M 12-box outer carton']]) {
    const d = await sql`delete from sku_components where sku_id=${s.id} and component_id=${cid} returning id`;
    if (d.length) log.push(`  - removed ${what}`);
  }

  // Add the right ones.
  const rows = [
    [bottleId, 'bottle',        '1',      true ],
    [corkId,   'closure',       '1',      true ],
    [eprId,    'epr',           '1',      true ],
    [cartonId, 'outer_carton',  '0.1667', false],
  ];
  for (const [cid, role, qty, supplied] of rows) {
    await sql`insert into sku_components (sku_id,component_id,quantity,role,include_in_cogs,supplied_by_customer,notes)
      values (${s.id},${cid},${qty},${role},true,${supplied},${'Corrected to the 500ml / case-of-6 configuration, 19 Aug 2026, per the 12 Aug ruling.'})
      on conflict (sku_id,component_id) do update set quantity=excluded.quantity, role=excluded.role,
        supplied_by_customer=excluded.supplied_by_customer, updated_at=now()`;
    log.push(`  + ${role}${supplied ? ' (F&M supplied)' : ''} qty ${qty}`);
  }

  // The two labels already exist as lines; flag them supplied.
  const f = await sql`update sku_components set supplied_by_customer=true, updated_at=now()
    where sku_id=${s.id} and component_id in (82,85) returning component_id`;
  log.push(`  ~ flagged ${f.length} label lines as F&M supplied`);
}

console.log(log.join("\n"));
