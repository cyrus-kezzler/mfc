"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { suppliers, type NewSupplier } from "@/db/schema";

function read(form: FormData, key: string): string | null {
  const raw = form.get(key);
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed === "" ? null : trimmed;
}

function readRequired(form: FormData, key: string, label: string): string {
  const v = read(form, key);
  if (!v) throw new Error(`${label} is required`);
  return v;
}

export async function createSupplier(form: FormData) {
  const data: NewSupplier = {
    name: readRequired(form, "name", "Name"),
    contactEmail: read(form, "contactEmail"),
    contactPhone: read(form, "contactPhone"),
    address: read(form, "address"),
    paymentTerms: read(form, "paymentTerms"),
    defaultCurrency: read(form, "defaultCurrency") ?? "GBP",
    notes: read(form, "notes"),
  };

  await db.insert(suppliers).values(data);
  revalidatePath("/erp/suppliers");
  revalidatePath("/erp");
  redirect("/erp/suppliers");
}

export async function updateSupplier(id: number, form: FormData) {
  const data = {
    name: readRequired(form, "name", "Name"),
    contactEmail: read(form, "contactEmail"),
    contactPhone: read(form, "contactPhone"),
    address: read(form, "address"),
    paymentTerms: read(form, "paymentTerms"),
    defaultCurrency: read(form, "defaultCurrency") ?? "GBP",
    notes: read(form, "notes"),
    updatedAt: new Date(),
  };

  await db.update(suppliers).set(data).where(eq(suppliers.id, id));
  revalidatePath("/erp/suppliers");
  revalidatePath(`/erp/suppliers/${id}`);
  redirect("/erp/suppliers");
}

export async function setSupplierActive(id: number, active: boolean) {
  await db
    .update(suppliers)
    .set({ active, updatedAt: new Date() })
    .where(eq(suppliers.id, id));
  revalidatePath("/erp/suppliers");
  revalidatePath(`/erp/suppliers/${id}`);
}
