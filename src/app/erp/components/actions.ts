"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  components,
  componentPriceHistory,
  type NewComponent,
  type NewComponentPriceHistoryRow,
} from "@/db/schema";

const COMPONENT_TYPES = ["ingredient", "sub_recipe", "dry_good", "packaging"] as const;
const UOMS = ["ml", "g", "each", "m"] as const;

function readStr(form: FormData, key: string): string | null {
  const raw = form.get(key);
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed === "" ? null : trimmed;
}

function readNum(form: FormData, key: string): string | null {
  const v = readStr(form, key);
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${key} must be a non-negative number`);
  return v;
}

function readPositiveNum(form: FormData, key: string, label: string): string {
  const v = readStr(form, key);
  if (!v) throw new Error(`${label} is required`);
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} must be greater than zero`);
  return v;
}

function readNonNegNum(form: FormData, key: string, label: string): string {
  const v = readStr(form, key);
  if (!v) throw new Error(`${label} is required`);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a non-negative number`);
  return v;
}

function readInt(form: FormData, key: string): number | null {
  const v = readStr(form, key);
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${key} must be a non-negative integer`);
  return n;
}

function readEnum<T extends readonly string[]>(
  form: FormData,
  key: string,
  allowed: T,
  label: string,
): T[number] {
  const v = readStr(form, key);
  if (!v) throw new Error(`${label} is required`);
  if (!(allowed as readonly string[]).includes(v)) {
    throw new Error(`${label} must be one of: ${allowed.join(", ")}`);
  }
  return v as T[number];
}

function readSupplier(form: FormData): number | null {
  const v = readStr(form, "defaultSupplierId");
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

function deriveUnitCost(packSize: string, packCost: string): string {
  const size = Number(packSize);
  const cost = Number(packCost);
  return (cost / size).toFixed(4);
}

function buildPayload(form: FormData): NewComponent {
  const name = readStr(form, "name");
  if (!name) throw new Error("Name is required");

  const type = readEnum(form, "type", COMPONENT_TYPES, "Type");
  const uom = readEnum(form, "uom", UOMS, "UOM");

  const packSize = readPositiveNum(form, "packSize", "Pack size");
  const packCost = readNonNegNum(form, "packCost", "Pack cost");

  return {
    name,
    type,
    uom,
    defaultSupplierId: readSupplier(form),
    packSize,
    packCost,
    unitCost: deriveUnitCost(packSize, packCost),
    unitCostSetAt: new Date(),
    reorderThreshold: readNum(form, "reorderThreshold"),
    reorderQuantity: readNum(form, "reorderQuantity"),
    leadTimeDays: readInt(form, "leadTimeDays"),
    storageLocation: readStr(form, "storageLocation"),
    notes: readStr(form, "notes"),
    abv: readNum(form, "abv"),
    shelfLifeDays: readInt(form, "shelfLifeDays"),
  };
}

export async function createComponent(form: FormData) {
  const payload = buildPayload(form);

  const [inserted] = await db.insert(components).values(payload).returning({ id: components.id });

  // First price-history entry — manual source, since this is component creation.
  const historyRow: NewComponentPriceHistoryRow = {
    componentId: inserted.id,
    supplierId: payload.defaultSupplierId ?? null,
    unitCost: payload.unitCost!,
    currency: "GBP",
    uom: payload.uom,
    effectiveDate: new Date().toISOString().slice(0, 10),
    source: "manual",
    notes: `Initial price set on creation: pack ${payload.packSize}${payload.uom} @ £${payload.packCost}`,
  };
  await db.insert(componentPriceHistory).values(historyRow);

  revalidatePath("/erp/components");
  revalidatePath("/erp");
  redirect("/erp/components");
}

export async function updateComponent(id: number, form: FormData) {
  const payload = buildPayload(form);

  const [existing] = await db.select().from(components).where(eq(components.id, id)).limit(1);
  if (!existing) throw new Error(`Component ${id} not found`);

  await db
    .update(components)
    .set({ ...payload, updatedAt: new Date() })
    .where(eq(components.id, id));

  // If pack_cost or pack_size changed (compare numerically — Postgres normalises
  // numeric representation), write a price-history row so the change is auditable.
  const packCostChanged =
    Number(existing.packCost ?? "NaN") !== Number(payload.packCost);
  const packSizeChanged =
    Number(existing.packSize ?? "NaN") !== Number(payload.packSize);

  if (packCostChanged || packSizeChanged) {
    const before = `${existing.packSize ?? "?"}${existing.uom} @ £${existing.packCost ?? "?"}`;
    const after = `${payload.packSize}${payload.uom} @ £${payload.packCost}`;
    const historyRow: NewComponentPriceHistoryRow = {
      componentId: id,
      supplierId: payload.defaultSupplierId ?? null,
      unitCost: payload.unitCost!,
      currency: "GBP",
      uom: payload.uom,
      effectiveDate: new Date().toISOString().slice(0, 10),
      source: "manual",
      notes: `Manual edit: ${before} → ${after}`,
    };
    await db.insert(componentPriceHistory).values(historyRow);
  }

  revalidatePath("/erp/components");
  revalidatePath(`/erp/components/${id}`);
  redirect("/erp/components");
}

export async function setComponentActive(id: number, active: boolean) {
  await db
    .update(components)
    .set({ active, updatedAt: new Date() })
    .where(eq(components.id, id));
  revalidatePath("/erp/components");
  revalidatePath(`/erp/components/${id}`);
}
