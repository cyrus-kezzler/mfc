"use server";

/**
 * Server Actions for the RRP page — Amazon price overrides, per-SKU notes, and
 * the "last pushed to Shopify" baseline. All persist to git via the GitHub
 * Contents API, the same model as the wholesale pricing tool. RRP values
 * themselves are persisted by the shared `updateRrpOverride` action in
 * ./pricing.ts (rrp-overrides.json is the single source for RRP).
 */

import { revalidatePath } from "next/cache";
import { ghGet, ghPut, ghGetRecord } from "@/lib/github-contents";

const AMAZON_PATH = "src/data/amazon-overrides.json";
const NOTES_PATH = "src/data/rrp-notes.json";
const SYNC_PATH = "src/data/shopify-rrp-sync.json";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateRrp() {
  revalidatePath("/finances/rrp");
  revalidatePath("/finances/pricing");
}

/** Override the Amazon price for a SKU (default is Shopify RRP + 15%). */
export async function updateAmazonOverride(
  productId: string,
  productName: string,
  size: string,
  newPrice: number,
): Promise<ActionResult> {
  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    return { ok: false, error: "Amazon price must be a positive number." };
  }
  try {
    const { data, sha } = await ghGetRecord(AMAZON_PATH);
    data[productId] = Math.round(newPrice * 100) / 100;
    await ghPut(
      AMAZON_PATH,
      JSON.stringify(data, null, 2) + "\n",
      sha,
      `Set ${productName} ${size} Amazon price to £${(data[productId] as number).toFixed(2)}\n\nSource: Back Bar RRP editor`,
    );
    revalidateRrp();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Clear all Amazon overrides (revert to Shopify RRP + 15%). */
export async function resetAmazonOverrides(): Promise<ActionResult> {
  try {
    const { sha } = await ghGet(AMAZON_PATH);
    await ghPut(AMAZON_PATH, "{}\n", sha, "Reset Amazon overrides to RRP + 15%\n\nSource: Back Bar RRP editor");
    revalidateRrp();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Set (or clear, with an empty string) the free-text note for a SKU. */
export async function updateRrpNote(
  productId: string,
  productName: string,
  size: string,
  note: string,
): Promise<ActionResult> {
  try {
    const { data, sha } = await ghGetRecord(NOTES_PATH);
    const trimmed = note.trim();
    if (trimmed) data[productId] = trimmed;
    else delete data[productId];
    await ghPut(
      NOTES_PATH,
      JSON.stringify(data, null, 2) + "\n",
      sha,
      `Update ${productName} ${size} RRP note\n\nSource: Back Bar RRP editor`,
    );
    revalidateRrp();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Record the current RRPs as the "last pushed to Shopify" baseline. The Push
 * to Shopify panel diffs live RRPs against this snapshot to surface what still
 * needs syncing. Cyrus calls this after copying the CSV and updating Shopify.
 */
export async function markShopifyRrpSynced(
  rrpById: Record<string, number>,
): Promise<ActionResult> {
  try {
    const { sha } = await ghGet(SYNC_PATH);
    const clean: Record<string, number> = {};
    for (const [id, val] of Object.entries(rrpById)) {
      if (Number.isFinite(val) && val > 0) clean[id] = Math.round(val * 100) / 100;
    }
    await ghPut(
      SYNC_PATH,
      JSON.stringify(clean, null, 2) + "\n",
      sha,
      "Mark current RRPs as synced to Shopify\n\nSource: Back Bar RRP editor",
    );
    revalidateRrp();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
