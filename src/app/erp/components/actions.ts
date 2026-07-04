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
import { withFlash } from "../_components/flash";

function errMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

const COMPONENT_TYPES = ["ingredient", "sub_recipe", "dry_good", "packaging"] as const;
const UOMS = ["ml", "g", "each", "m"] as const;
const PURCHASE_UOMS = ["bottle", "case", "pouch", "roll", "bag", "each"] as const;

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
  const uom = readEnum(form, "uom", UOMS, "Consumption unit");
  const purchaseUom = readEnum(form, "purchaseUom", PURCHASE_UOMS, "Purchase unit");

  const packSize = readPositiveNum(form, "packSize", "Purchase size");
  const packCost = readNonNegNum(form, "packCost", "Unit cost");

  return {
    name,
    type,
    uom,
    purchaseUom,
    purchaseLabel: readStr(form, "purchaseLabel"),
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
  let name: string;
  try {
    const payload = buildPayload(form);
    name = payload.name;

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
      notes: `Initial price on creation: £${payload.packCost}/${payload.purchaseUom} (${payload.packSize}${payload.uom} per ${payload.purchaseUom})`,
    };
    await db.insert(componentPriceHistory).values(historyRow);
  } catch (e) {
    redirect(withFlash("/erp/components/new", errMessage(e, "Could not create component"), "error"));
  }

  revalidatePath("/erp/components");
  revalidatePath("/erp");
  redirect(withFlash("/erp/components", `${name} added`));
}

export async function updateComponent(id: number, form: FormData) {
  let name: string;
  try {
    const payload = buildPayload(form);
    name = payload.name;

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
      const before = `£${existing.packCost ?? "?"}/${existing.purchaseUom ?? payload.purchaseUom} (${existing.packSize ?? "?"}${existing.uom})`;
      const after = `£${payload.packCost}/${payload.purchaseUom} (${payload.packSize}${payload.uom})`;
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
  } catch (e) {
    redirect(withFlash(`/erp/components/${id}`, errMessage(e, "Could not update component"), "error"));
  }

  revalidatePath("/erp/components");
  revalidatePath(`/erp/components/${id}`);
  redirect(withFlash("/erp/components", `${name} updated`));
}

export async function setComponentActive(id: number, active: boolean) {
  const [row] = await db
    .update(components)
    .set({ active, updatedAt: new Date() })
    .where(eq(components.id, id))
    .returning({ name: components.name });
  revalidatePath("/erp/components");
  revalidatePath(`/erp/components/${id}`);
  const name = row?.name ?? "Component";
  redirect(withFlash(`/erp/components/${id}`, `${name} ${active ? "reactivated" : "deactivated"}`));
}
