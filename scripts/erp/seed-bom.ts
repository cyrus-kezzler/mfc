/**
 * Bill of materials seed. Idempotent, safe to re-run.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-bom.ts          (dry run)
 *   npx tsx --env-file=.env.local scripts/erp/seed-bom.ts --write  (commits)
 *
 * Four jobs:
 *   1. Backfill skus.client_id. Every pre-existing SKU is own-brand.
 *   2. Create the label components that never existed, carrying their April
 *      2026 hand-loaded figures with source 'manual' so they are visibly
 *      unverified rather than silently trusted.
 *   3. Create the partner SKUs the table could not previously express.
 *   4. Attach glass, closure, labels, EPR and cartons to every active SKU.
 *
 * COGS rule (Cyrus, 30 Jul 2026): liquid, bottle, cap, label and box are all
 * in. Carriage is the only thing out, because the delivery method flexes
 * between hand delivery, pallet and Royal Mail.
 */

import { eq, isNull, and } from "drizzle-orm";

import { db } from "../../src/db";
import {
  components,
  componentPriceHistory,
  clients,
  drinks,
  skus,
  skuComponents,
  type NewComponent,
} from "../../src/db/schema";

const WRITE = process.argv.includes("--write");

const HAND_LOADED_DATE = "2026-04-12";
const HAND_LOADED_NOTE =
  "Hand-loaded April 2026, never invoice-verified. Carried forward so the cost is visible and dated rather than missing. Invoice hunt open.";

type Role =
  | "bottle"
  | "closure"
  | "front_label"
  | "back_label"
  | "hygiene_label"
  | "epr"
  | "outer_carton"
  | "shipping";

const gaps: string[] = [];
const actions: string[] = [];

function note(s: string) {
  actions.push(s);
  console.log(`  ${s}`);
}

/** Components to create if absent, keyed by name. */
const LABEL_COMPONENTS: Array<{
  name: string;
  cost: string;
  notes: string;
}> = [
  {
    name: "Front label - Myatt's Fields",
    cost: "0.0900",
    notes: HAND_LOADED_NOTE,
  },
  {
    name: "Front label - Fortnum & Mason",
    cost: "0.3400",
    notes: HAND_LOADED_NOTE,
  },
  {
    name: "Front label - Cripps",
    cost: "0.6000",
    notes: `${HAND_LOADED_NOTE} Acorn invoices were hunted on 20 and 22 Jul 2026 and not found.`,
  },
  {
    name: "Hygiene label - Myatt's Fields",
    cost: "0.0600",
    notes: HAND_LOADED_NOTE,
  },
  {
    name: "Hygiene label - Fortnum & Mason",
    cost: "0.0600",
    notes: HAND_LOADED_NOTE,
  },
  {
    name: "Hygiene label - Cripps",
    cost: "0.1500",
    notes: HAND_LOADED_NOTE,
  },
];

async function ensureComponent(spec: {
  name: string;
  cost: string;
  notes: string;
}): Promise<number> {
  const existing = await db
    .select()
    .from(components)
    .where(eq(components.name, spec.name));
  if (existing.length > 0) return existing[0].id;

  if (!WRITE) {
    note(`WOULD CREATE component "${spec.name}" at £${spec.cost}`);
    return -1;
  }

  const row: NewComponent = {
    name: spec.name,
    type: "dry_good",
    uom: "each",
    packSize: "1.000",
    packCost: (Math.round(Number(spec.cost) * 100) / 100).toFixed(2),
    unitCost: spec.cost,
    unitCostSetAt: new Date(`${HAND_LOADED_DATE}T00:00:00Z`),
    notes: spec.notes,
    active: true,
  };
  const [created] = await db.insert(components).values(row).returning();
  await db.insert(componentPriceHistory).values({
    componentId: created.id,
    unitCost: spec.cost,
    uom: "each",
    effectiveDate: HAND_LOADED_DATE,
    source: "manual",
    notes: spec.notes,
  });
  note(`CREATED component ${created.id} "${spec.name}" at £${spec.cost} (manual, ${HAND_LOADED_DATE})`);
  return created.id;
}

async function main() {
  console.log(WRITE ? "=== WRITE MODE ===" : "=== DRY RUN (pass --write to commit) ===");

  const allClients = await db.select().from(clients);
  const clientByName = new Map(allClients.map((c) => [c.name, c]));
  const mfc = clientByName.get("Myatt's Fields");
  const fm = clientByName.get("Fortnum & Mason");
  const cripps = clientByName.get("Cripps");
  if (!mfc || !fm || !cripps) throw new Error("Expected three clients, found: " + allClients.map((c) => c.name).join(", "));

  // Captured after the guard so the narrowing survives into bomFor's closure.
  const MFC_ID = mfc.id;
  const FM_ID = fm.id;
  const CRIPPS_ID = cripps.id;

  const allDrinks = await db.select().from(drinks);
  const drinkByName = new Map(allDrinks.map((d) => [d.name, d]));

  const allComponents = await db.select().from(components);
  const compByName = new Map(allComponents.map((c) => [c.name, c]));
  const compId = (name: string): number | null => compByName.get(name)?.id ?? null;

  // ── 1. Backfill client_id ────────────────────────────────────────────────
  console.log("\n1. Backfilling skus.client_id to Myatt's Fields where null");
  const unassigned = await db.select().from(skus).where(isNull(skus.clientId));
  if (unassigned.length === 0) {
    note("nothing to backfill");
  } else if (!WRITE) {
    note(`WOULD backfill ${unassigned.length} SKUs to ${mfc.name}`);
  } else {
    await db.update(skus).set({ clientId: mfc.id }).where(isNull(skus.clientId));
    note(`backfilled ${unassigned.length} SKUs to ${mfc.name}`);
  }

  // ── 2. Label components ──────────────────────────────────────────────────
  console.log("\n2. Ensuring label components exist");
  for (const spec of LABEL_COMPONENTS) {
    const id = await ensureComponent(spec);
    if (id > 0) compByName.set(spec.name, { ...(compByName.get(spec.name) ?? {}), id, name: spec.name } as never);
  }
  // Re-read so later lookups see anything just created.
  const refreshed = await db.select().from(components);
  refreshed.forEach((c) => compByName.set(c.name, c));

  // ── 3. Partner SKUs ──────────────────────────────────────────────────────
  console.log("\n3. Ensuring partner SKUs exist");
  const PARTNER_SKUS: Array<{ code: string; drink: string; clientId: number; sizeMl: number }> = [
    { code: "espresso-martini-700-cripps", drink: "Espresso Martini", clientId: cripps.id, sizeMl: 700 },
    { code: "negroni-700-cripps", drink: "Negroni", clientId: cripps.id, sizeMl: 700 },
    { code: "robin-roy-350-fm", drink: "Robin Roy", clientId: fm.id, sizeMl: 350 },
    { code: "espresso-daiquiri-350-fm", drink: "Espresso Daiquiri", clientId: fm.id, sizeMl: 350 },
    { code: "vesper-martini-350-fm", drink: "Vesper Martini", clientId: fm.id, sizeMl: 350 },
    { code: "apples-and-pears-350-fm", drink: "Apples & Pears", clientId: fm.id, sizeMl: 350 },
    { code: "christmas-gingertini-350-fm", drink: "Christmas Gingertini", clientId: fm.id, sizeMl: 350 },
  ];

  for (const spec of PARTNER_SKUS) {
    const existing = await db.select().from(skus).where(eq(skus.code, spec.code));
    if (existing.length > 0) {
      note(`SKU ${spec.code} already present`);
      continue;
    }
    const d = drinkByName.get(spec.drink);
    if (!d) {
      gaps.push(`Drink "${spec.drink}" not found, SKU ${spec.code} NOT created`);
      continue;
    }
    if (!WRITE) {
      note(`WOULD CREATE SKU ${spec.code} (drink ${d.id}, ${spec.sizeMl}ml)`);
      continue;
    }
    await db.insert(skus).values({
      code: spec.code,
      drinkId: d.id,
      clientId: spec.clientId,
      sizeMl: spec.sizeMl,
      active: true,
    });
    note(`CREATED SKU ${spec.code} (drink ${d.id}, ${spec.sizeMl}ml)`);
  }

  // ── 4. Bill of materials ─────────────────────────────────────────────────
  console.log("\n4. Attaching bill of materials");

  const allSkus = await db.select().from(skus);

  /** Per (clientId, sizeMl), the component names and roles that go on a bottle. */
  function bomFor(clientId: number | null, sizeMl: number): Array<{ name: string; role: Role; qty?: string; inCogs?: boolean }> {
    if (clientId === CRIPPS_ID && sizeMl === 700) {
      return [
        { name: "700ml bottle (Blackwell)", role: "bottle" },
        { name: "Cork 30x12mm micro-agglomerated", role: "closure" },
        { name: "Front label - Cripps", role: "front_label" },
        { name: "Hygiene label - Cripps", role: "hygiene_label" },
        { name: "EPR - 700ml Blackwell (glass+wood+cork)", role: "epr" },
      ];
    }
    if (clientId === FM_ID && sizeMl === 350) {
      return [
        { name: "F&M 350ml bottle (Apollo VB003)", role: "bottle" },
        { name: "Cork 19mm wood-top", role: "closure" },
        { name: "Front label - Fortnum & Mason", role: "front_label" },
        { name: "Hygiene label - Fortnum & Mason", role: "hygiene_label" },
        { name: "EPR - F&M 350ml (bottle+cork)", role: "epr" },
        // 12 bottles to an outer carton, so one twelfth per bottle.
        { name: "F&M 12-box outer carton", role: "outer_carton", qty: "0.0833" },
      ];
    }
    if (clientId === MFC_ID && sizeMl === 250) {
      return [
        { name: "250ml bottle", role: "bottle" },
        { name: "250ml back label", role: "back_label" },
        { name: "Front label - Myatt's Fields", role: "front_label" },
        { name: "Hygiene label - Myatt's Fields", role: "hygiene_label" },
      ];
    }
    if (clientId === MFC_ID && sizeMl === 500) {
      return [
        { name: "500ml bottle", role: "bottle" },
        { name: "Front label - Myatt's Fields", role: "front_label" },
        { name: "Hygiene label - Myatt's Fields", role: "hygiene_label" },
      ];
    }
    return [];
  }

  let attached = 0;
  for (const sku of allSkus) {
    const lines = bomFor(sku.clientId ?? mfc.id, sku.sizeMl);
    if (lines.length === 0) {
      gaps.push(`SKU ${sku.code} (client ${sku.clientId}, ${sku.sizeMl}ml) has no BOM rule`);
      continue;
    }
    for (const line of lines) {
      const cid = compId(line.name);
      if (!cid) {
        gaps.push(`SKU ${sku.code}: component "${line.name}" does not exist`);
        continue;
      }
      const already = await db
        .select()
        .from(skuComponents)
        .where(and(eq(skuComponents.skuId, sku.id), eq(skuComponents.componentId, cid)));
      if (already.length > 0) continue;
      if (!WRITE) {
        attached++;
        continue;
      }
      await db.insert(skuComponents).values({
        skuId: sku.id,
        componentId: cid,
        role: line.role,
        quantity: line.qty ?? "1",
        includeInCogs: line.inCogs ?? true,
      });
      attached++;
    }
  }
  note(`${WRITE ? "attached" : "would attach"} ${attached} bill-of-materials lines`);

  // ── Report ───────────────────────────────────────────────────────────────
  console.log("\n=== GAPS ===");
  if (gaps.length === 0) console.log("  none");
  for (const g of gaps) console.log(`  ${g}`);

  console.log(`\n${WRITE ? "WRITTEN" : "DRY RUN, nothing written"}. ${actions.length} actions, ${gaps.length} gaps.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("SEED FAILED:", e);
  process.exit(1);
});
