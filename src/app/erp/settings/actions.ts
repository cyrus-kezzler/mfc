"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { systemSettings, SETTING_KEYS } from "@/db/schema";
import { withFlash } from "../_components/flash";

function readStr(form: FormData, key: string): string {
  const raw = form.get(key);
  if (raw == null) return "";
  return String(raw).trim();
}

/**
 * Write a single setting ONLY if its value actually changed, so each row's
 * updated_at is a per-setting audit timestamp (Slice 1.1 bug fix #3). The old
 * code upserted all three every save, resetting every "updated" label — the
 * audit trail lied. Returns true if the row was written.
 */
async function upsertIfChanged(
  key: string,
  value: string,
  current: Record<string, string>,
): Promise<boolean> {
  if (current[key] === value) return false;
  await db
    .insert(systemSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value, updatedAt: new Date() },
    });
  return true;
}

export async function updateSettings(form: FormData) {
  let changed = 0;
  try {
    // Wastage % entered as a percentage by humans (e.g. "2"); stored as decimal "0.02".
    const wastagePctRaw = readStr(form, "wastagePct");
    const wastagePctNum = Number(wastagePctRaw);
    if (!Number.isFinite(wastagePctNum) || wastagePctNum < 0 || wastagePctNum > 100) {
      throw new Error("Wastage must be a number between 0 and 100");
    }
    const wastagePct = (wastagePctNum / 100).toString();

    const labourRateRaw = readStr(form, "labourRate");
    const labourRateNum = Number(labourRateRaw);
    if (!Number.isFinite(labourRateNum) || labourRateNum < 0) {
      throw new Error("Labour rate must be a non-negative number");
    }
    const labourRate = labourRateNum.toFixed(2);

    const nextSerialRaw = readStr(form, "nextSerial");
    const nextSerialNum = Number.parseInt(nextSerialRaw, 10);
    if (!Number.isFinite(nextSerialNum) || nextSerialNum < 1) {
      throw new Error("Next serial number must be a positive integer");
    }

    const rows = await db.select().from(systemSettings);
    const current = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;

    changed = (
      await Promise.all([
        upsertIfChanged(SETTING_KEYS.WASTAGE_PCT, wastagePct, current),
        upsertIfChanged(SETTING_KEYS.LABOUR_RATE_GBP_PER_HOUR, labourRate, current),
        upsertIfChanged(SETTING_KEYS.NEXT_SERIAL_NUMBER, String(nextSerialNum), current),
      ])
    ).filter(Boolean).length;
  } catch (e) {
    redirect(
      withFlash("/erp/settings", e instanceof Error ? e.message : "Could not save settings", "error"),
    );
  }

  revalidatePath("/erp/settings");
  revalidatePath("/erp");
  redirect(withFlash("/erp/settings", changed === 0 ? "No changes to save" : "Settings saved"));
}
