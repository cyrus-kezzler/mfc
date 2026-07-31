"use server";

/**
 * Server Actions for agreed SKU prices.
 *
 * An AGREED price is a commitment to a retailer, stored in `sku_prices` with
 * the period it applies to. Setting a new one closes the current row (its
 * effective_to is stamped) and inserts a new open row, so the history of what
 * was actually charged is never overwritten. The rule price (COGS x markup +
 * shipping) is computed on read in `@/lib/erp/pricing` and is never written
 * here, or anywhere.
 */

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { skuPrices, skus, type NewSkuPrice } from "@/db/schema";

export type AgreedPriceResult = { ok: true } | { ok: false; error: string };

function revalidateFinances() {
  revalidatePath("/finances/pricing");
  revalidatePath("/finances/rrp");
  revalidatePath("/finances/pnl");
  revalidatePath("/finances/profitability");
}

async function setAgreedPrice(
  skuId: number,
  priceType: "wholesale" | "rrp",
  amount: number,
  opts?: { shipping?: number; note?: string },
): Promise<AgreedPriceResult> {
  if (!Number.isInteger(skuId) || skuId <= 0) {
    return { ok: false, error: "skuId must be a positive integer." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Price must be a positive number." };
  }

  try {
    const [sku] = await db.select().from(skus).where(eq(skus.id, skuId));
    if (!sku) return { ok: false, error: `No SKU with id ${skuId}.` };

    const today = new Date().toISOString().slice(0, 10);

    const [current] = await db
      .select()
      .from(skuPrices)
      .where(
        and(
          eq(skuPrices.skuId, skuId),
          eq(skuPrices.priceType, priceType),
          isNull(skuPrices.effectiveTo),
        ),
      );

    if (current) {
      await db
        .update(skuPrices)
        .set({ effectiveTo: today, updatedAt: new Date() })
        .where(eq(skuPrices.id, current.id));
    }

    // Wholesale rows carry the per-bottle shipping assumed at agreement time.
    // If the caller does not supply one, carry the previous row's forward.
    const shipping =
      priceType === "wholesale"
        ? (opts?.shipping ?? (current ? Number(current.shipping ?? 0) : 0))
        : null;

    const row: NewSkuPrice = {
      skuId,
      priceType,
      amount: (Math.round(amount * 100) / 100).toFixed(2),
      effectiveFrom: today,
      effectiveTo: null,
      shipping: shipping === null ? null : shipping.toFixed(4),
      notes: opts?.note?.trim() || "Set from Back Bar",
    };
    await db.insert(skuPrices).values(row);

    revalidateFinances();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Record a newly agreed wholesale price (ex VAT) for a SKU. */
export async function setAgreedWholesale(
  skuId: number,
  amount: number,
  opts?: { shipping?: number; note?: string },
): Promise<AgreedPriceResult> {
  return setAgreedPrice(skuId, "wholesale", amount, opts);
}

/** Record a newly agreed RRP (inc VAT) for a SKU. */
export async function setAgreedRrp(
  skuId: number,
  amount: number,
  opts?: { note?: string },
): Promise<AgreedPriceResult> {
  return setAgreedPrice(skuId, "rrp", amount, opts);
}
