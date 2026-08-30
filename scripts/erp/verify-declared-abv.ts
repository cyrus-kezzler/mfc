/**
 * READ-ONLY read-back of declared vs computed ABV, with the Gate 1 verdict.
 *
 *   npx tsx --env-file=.env.local scripts/erp/verify-declared-abv.ts
 *
 * The acceptance check for the 30 Aug 2026 declared_abv build: the figures are
 * loaded and readable back, the drinks deliberately left NULL read as NULL
 * rather than as a copied computed value, and the gate's verdict is visible
 * per drink.
 *
 * This script runs SELECTs only. It never writes.
 */

import { db } from "@/db";
import { clients, drinks, skus } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { abvComputed, declaredAbvFor, gateOne, GATE_1_TOLERANCE_POINTS } from "@/lib/erp/canon";

async function main() {
  const [mfc] = await db.select().from(clients).where(eq(clients.slug, "mfc"));

  // Every drink that has at least one MFC SKU carrying a declared figure,
  // plus every drink that has MFC SKUs but no declared figure — so the NULLs
  // are as visible as the values.
  const allDrinks = await db.select().from(drinks);
  const rows: {
    name: string;
    declared: number | null;
    computed: number;
    gap: number | null;
    status: string;
    source: string | null;
    skuCount: number;
  }[] = [];

  for (const d of allDrinks) {
    const mfcSkus = await db
      .select({ id: skus.id })
      .from(skus)
      .where(and(eq(skus.drinkId, d.id), eq(skus.clientId, mfc.id)));
    if (mfcSkus.length === 0) continue;

    const withDeclared = await db
      .select({ id: skus.id })
      .from(skus)
      .where(
        and(eq(skus.drinkId, d.id), eq(skus.clientId, mfc.id), isNotNull(skus.declaredAbv)),
      );

    const computed = await abvComputed(d.id, "mfc");
    const { value: declared } = await declaredAbvFor(d.id, mfc.id);
    const v = gateOne(computed.abv, declared?.declared ?? null);

    rows.push({
      name: d.name,
      declared: v.declared,
      computed: v.computed,
      gap: v.gap,
      status: v.status,
      source: declared?.source ?? null,
      skuCount: withDeclared.length,
    });
  }

  rows.sort((a, b) => (b.gap ?? -1) - (a.gap ?? -1));

  const head =
    "DRINK".padEnd(20) +
    "DECLARED".padStart(9) +
    "COMPUTED".padStart(10) +
    "GAP".padStart(7) +
    "  VERDICT".padEnd(14) +
    "SKUS".padStart(5) +
    "  SOURCE";
  console.log(head);
  console.log("-".repeat(head.length + 20));

  for (const r of rows) {
    console.log(
      r.name.padEnd(20) +
        (r.declared === null ? "null" : r.declared.toFixed(1)).padStart(9) +
        r.computed.toFixed(1).padStart(10) +
        (r.gap === null ? "—" : r.gap.toFixed(1)).padStart(7) +
        ("  " + r.status.toUpperCase()).padEnd(14) +
        String(r.skuCount).padStart(5) +
        "  " +
        (r.source ?? "—"),
    );
  }

  const fail = rows.filter((r) => r.status === "fail").length;
  const pass = rows.filter((r) => r.status === "pass").length;
  const unver = rows.filter((r) => r.status === "unverified").length;
  console.log(
    `\n${rows.length} drinks with MFC SKUs.  ` +
      `FAIL ${fail}   PASS ${pass}   UNVERIFIED (no declared figure) ${unver}.  ` +
      `Tolerance ${GATE_1_TOLERANCE_POINTS} points, strictly greater than fails.`,
  );
}

main().then(() => process.exit(0));
