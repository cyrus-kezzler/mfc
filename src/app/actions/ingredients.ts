"use server";

/**
 * Server Action for updating ingredient prices.
 *
 * Writes directly to src/data/ingredients.json and appends to
 * src/data/ingredient-price-history.json.
 *
 * IMPORTANT — production persistence caveat:
 * Vercel's runtime filesystem is read-only, so this action will only succeed
 * in local development (`npm run dev`). On production the fs.writeFile call
 * will throw; we catch, report the error, and instruct the user to run
 * locally or wire up a GitHub-API commit path in a later phase.
 *
 * Given price changes happen ~2× per year, local-only editing is an
 * acceptable Phase 1 trade-off: edit at your desk, commit, push, Vercel
 * redeploys with the new prices.
 */

import { promises as fs } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { IngredientMaster, IngredientPriceHistoryEntry } from "@/lib/ingredients";

const INGREDIENTS_PATH = path.join(process.cwd(), "src/data/ingredients.json");
const HISTORY_PATH = path.join(process.cwd(), "src/data/ingredient-price-history.json");

export type UpdatePriceResult =
  | { ok: true; ingredient: IngredientMaster }
  | { ok: false; error: string };

export async function updateIngredientPrice(
  ingredientId: string,
  newPrice: number,
  note?: string,
): Promise<UpdatePriceResult> {
  if (!Number.isFinite(newPrice) || newPrice < 0) {
    return { ok: false, error: "Price must be a non-negative number." };
  }

  try {
    const [ingRaw, histRaw] = await Promise.all([
      fs.readFile(INGREDIENTS_PATH, "utf8"),
      fs.readFile(HISTORY_PATH, "utf8"),
    ]);

    const ingredients: IngredientMaster[] = JSON.parse(ingRaw);
    const history: IngredientPriceHistoryEntry[] = JSON.parse(histRaw);

    const idx = ingredients.findIndex((i) => i.id === ingredientId);
    if (idx < 0) {
      return { ok: false, error: `Ingredient "${ingredientId}" not found.` };
    }

    const today = new Date().toISOString().slice(0, 10);
    const updated: IngredientMaster = {
      ...ingredients[idx],
      currentPrice: Math.round(newPrice * 10000) / 10000,
      currentPriceSetAt: today,
    };
    ingredients[idx] = updated;

    const historyEntry: IngredientPriceHistoryEntry = {
      ingredientId,
      date: today,
      price: updated.currentPrice,
      ...(note && note.trim() ? { note: note.trim() } : {}),
    };
    history.push(historyEntry);

    await Promise.all([
      fs.writeFile(INGREDIENTS_PATH, JSON.stringify(ingredients, null, 2) + "\n", "utf8"),
      fs.writeFile(HISTORY_PATH, JSON.stringify(history, null, 2) + "\n", "utf8"),
    ]);

    revalidatePath("/finances/ingredients");
    return { ok: true, ingredient: updated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("EROFS") || msg.includes("read-only")) {
      return {
        ok: false,
        error:
          "Production filesystem is read-only. Edit prices in local dev (`npm run dev`), commit, and push.",
      };
    }
    return { ok: false, error: `Failed to save: ${msg}` };
  }
}
