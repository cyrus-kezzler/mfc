/**
 * Speed Rail seed — first-run setup.
 *
 *   npm run db:seed
 *
 * Idempotent. Inserts new components, and back-fills `pack_size` /
 * `pack_cost` / `unit_cost` on previously-seeded components if they're missing
 * (so older DBs catch up to the current CSV format without a manual fix).
 *
 * Source: seed/components.csv (20-line representative set from the buying
 * spreadsheet's INGREDIENTS + DRY GOODS sections).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { eq, sql } from "drizzle-orm";

import { db } from "../../src/db";
import {
  components,
  systemSettings,
  SETTING_KEYS,
  type NewComponent,
} from "../../src/db/schema";

type Row = {
  name: string;
  type: NewComponent["type"];
  uom: NewComponent["uom"];
  pack_size: string;
  pack_cost: string;
  abv: string;
  notes: string;
};

function deriveUnitCost(packSize: string, packCost: string): string {
  const size = Number(packSize);
  const cost = Number(packCost);
  if (!Number.isFinite(size) || size <= 0) return "0";
  if (!Number.isFinite(cost)) return "0";
  return (cost / size).toFixed(4);
}

async function seedSettings() {
  const rows: { key: string; value: string }[] = [
    { key: SETTING_KEYS.WASTAGE_PCT, value: "0.02" },
    { key: SETTING_KEYS.LABOUR_RATE_GBP_PER_HOUR, value: "15.00" },
    { key: SETTING_KEYS.NEXT_SERIAL_NUMBER, value: "35001" },
  ];

  for (const row of rows) {
    await db
      .insert(systemSettings)
      .values(row)
      .onConflictDoNothing({ target: systemSettings.key });
  }
  console.log(`✓ Seeded ${rows.length} system settings (no overwrite if present).`);
}

async function seedComponents() {
  const csvPath = resolve(__dirname, "..", "..", "seed", "components.csv");
  const raw = readFileSync(csvPath, "utf8");
  const rows: Row[] = parse(raw, { columns: true, skip_empty_lines: true, trim: true });

  const now = new Date();
  let inserted = 0;
  let backfilled = 0;
  let unchanged = 0;

  for (const row of rows) {
    const unitCost = deriveUnitCost(row.pack_size, row.pack_cost);

    const existing = await db
      .select({
        id: components.id,
        packSize: components.packSize,
        packCost: components.packCost,
      })
      .from(components)
      .where(sql`lower(${components.name}) = lower(${row.name})`)
      .limit(1);

    if (existing.length === 0) {
      const data: NewComponent = {
        name: row.name,
        type: row.type,
        uom: row.uom,
        packSize: row.pack_size,
        packCost: row.pack_cost,
        unitCost,
        unitCostSetAt: now,
        abv: row.abv ? row.abv : null,
        notes: row.notes || null,
      };
      await db.insert(components).values(data);
      inserted++;
      continue;
    }

    const cur = existing[0];
    if (cur.packSize == null || cur.packCost == null) {
      // Old row from before pack_size/pack_cost existed — back-fill.
      await db
        .update(components)
        .set({
          packSize: row.pack_size,
          packCost: row.pack_cost,
          unitCost,
          unitCostSetAt: now,
          updatedAt: now,
        })
        .where(eq(components.id, cur.id));
      backfilled++;
    } else {
      unchanged++;
    }
  }

  console.log(
    `✓ Components: ${inserted} inserted, ${backfilled} back-filled (pack columns), ${unchanged} already current.`,
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Add it to .env.local before running the seed.");
    process.exit(1);
  }

  await seedSettings();
  await seedComponents();

  console.log("\nDone. Next: open /erp once SPEED_RAIL_ENABLED=1 is set.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
