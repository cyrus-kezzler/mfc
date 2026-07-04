"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { suppliers, type NewSupplier } from "@/db/schema";
import { withFlash } from "../_components/flash";

/** Message for a thrown Error, falling back to a generic line. */
function errMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

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
  let name: string;
  try {
    name = readRequired(form, "name", "Name");
    const data: NewSupplier = {
      name,
      contactEmail: read(form, "contactEmail"),
      contactPhone: read(form, "contactPhone"),
      address: read(form, "address"),
      paymentTerms: read(form, "paymentTerms"),
      defaultCurrency: read(form, "defaultCurrency") ?? "GBP",
      notes: read(form, "notes"),
    };
    await db.insert(suppliers).values(data);
  } catch (e) {
    redirect(withFlash("/erp/suppliers/new", errMessage(e, "Could not create supplier"), "error"));
  }
  revalidatePath("/erp/suppliers");
  revalidatePath("/erp");
  redirect(withFlash("/erp/suppliers", `${name} added`));
}

export async function updateSupplier(id: number, form: FormData) {
  let name: string;
  try {
    name = readRequired(form, "name", "Name");
    const data = {
      name,
      contactEmail: read(form, "contactEmail"),
      contactPhone: read(form, "contactPhone"),
      address: read(form, "address"),
      paymentTerms: read(form, "paymentTerms"),
      defaultCurrency: read(form, "defaultCurrency") ?? "GBP",
      notes: read(form, "notes"),
      updatedAt: new Date(),
    };
    await db.update(suppliers).set(data).where(eq(suppliers.id, id));
  } catch (e) {
    redirect(withFlash(`/erp/suppliers/${id}`, errMessage(e, "Could not update supplier"), "error"));
  }
  revalidatePath("/erp/suppliers");
  revalidatePath(`/erp/suppliers/${id}`);
  redirect(withFlash("/erp/suppliers", `${name} updated`));
}

export async function setSupplierActive(id: number, active: boolean) {
  const [row] = await db
    .update(suppliers)
    .set({ active, updatedAt: new Date() })
    .where(eq(suppliers.id, id))
    .returning({ name: suppliers.name });
  revalidatePath("/erp/suppliers");
  revalidatePath(`/erp/suppliers/${id}`);
  const name = row?.name ?? "Supplier";
  redirect(withFlash(`/erp/suppliers/${id}`, `${name} ${active ? "reactivated" : "deactivated"}`));
}
