"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, drinks, recipeLines, recipes } from "@/db/schema";

export type RecipeLineInput = { componentId: number; percentage: number };

export type SaveState = { error: string } | null;

/**
 * Validate a set of recipe lines against the brief's rules:
 *  - at least one line
 *  - every component unique within the recipe
 *  - percentages sum to exactly 100.0 after rounding the total to one decimal
 * Returns null when valid, or an error string.
 */
function validateLines(lines: RecipeLineInput[]): string | null {
  if (!lines.length) return "A recipe needs at least one ingredient.";
  const seen = new Set<number>();
  for (const l of lines) {
    if (!Number.isFinite(l.componentId)) return "Every line needs an ingredient.";
    if (seen.has(l.componentId)) return "Each ingredient can appear only once in a recipe.";
    seen.add(l.componentId);
    if (!Number.isFinite(l.percentage) || l.percentage <= 0) return "Every percentage must be greater than zero.";
    if (l.percentage > 100) return "No single ingredient can exceed 100%.";
  }
  const total = Math.round(lines.reduce((a, l) => a + l.percentage, 0) * 10) / 10;
  if (total !== 100) return `Percentages must sum to exactly 100% (currently ${total.toFixed(1)}%).`;
  return null;
}

function parseLines(raw: string): RecipeLineInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Malformed recipe lines.");
  }
  if (!Array.isArray(parsed)) throw new Error("Malformed recipe lines.");
  return parsed.map((p) => ({
    componentId: Number((p as RecipeLineInput).componentId),
    percentage: Number((p as RecipeLineInput).percentage),
  }));
}

async function resolveIds(drinkSlug: string, clientSlug: string) {
  const [drink] = await db.select({ id: drinks.id }).from(drinks).where(eq(drinks.slug, drinkSlug)).limit(1);
  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.slug, clientSlug)).limit(1);
  if (!drink) throw new Error(`Unknown drink: ${drinkSlug}`);
  if (!client) throw new Error(`Unknown client: ${clientSlug}`);
  return { drinkId: drink.id, clientId: client.id };
}

/**
 * Save a recipe edit. Creates a NEW version (old + 1) and atomically swaps which
 * row is current — past versions and their lines are never mutated.
 *
 * The neon-http driver has no interactive transactions, so we build the new
 * version + its lines first (as a non-current row), then flip is_current for the
 * old and new rows together via db.batch (one atomic Postgres transaction). If
 * anything fails before the swap, the old recipe simply stays current.
 */
export async function saveRecipeEdit(
  drinkSlug: string,
  clientSlug: string,
  _prev: SaveState,
  form: FormData,
): Promise<SaveState> {
  const lines = parseLines(String(form.get("lines") ?? "[]"));
  const err = validateLines(lines);
  if (err) return { error: err };

  const { drinkId, clientId } = await resolveIds(drinkSlug, clientSlug);

  const [current] = await db
    .select({ id: recipes.id, version: recipes.version })
    .from(recipes)
    .where(and(eq(recipes.drinkId, drinkId), eq(recipes.clientId, clientId), eq(recipes.isCurrent, true)))
    .limit(1);

  if (!current) {
    // No current recipe — treat as a fresh create at version 1.
    await createRecipe(drinkId, clientId, lines, String(form.get("createdBy") ?? "") || null);
  } else {
    const [next] = await db
      .insert(recipes)
      .values({ drinkId, clientId, version: current.version + 1, isCurrent: false, createdBy: String(form.get("createdBy") ?? "") || null })
      .returning({ id: recipes.id });

    await db.insert(recipeLines).values(
      lines.map((l, i) => ({ recipeId: next.id, componentId: l.componentId, percentage: l.percentage.toFixed(3), displayOrder: i })),
    );

    // Atomic current-pointer swap.
    await db.batch([
      db.update(recipes).set({ isCurrent: false, updatedAt: new Date() }).where(eq(recipes.id, current.id)),
      db.update(recipes).set({ isCurrent: true, updatedAt: new Date() }).where(eq(recipes.id, next.id)),
    ]);
  }

  revalidatePath(`/drinks/${drinkSlug}`);
  revalidatePath("/drinks");
  redirect(`/drinks/${drinkSlug}?client=${clientSlug}`);
}

/** Create the first recipe for a (drink, client) that has none yet. */
export async function createRecipeForClient(
  drinkSlug: string,
  clientSlug: string,
  _prev: SaveState,
  form: FormData,
): Promise<SaveState> {
  const lines = parseLines(String(form.get("lines") ?? "[]"));
  const err = validateLines(lines);
  if (err) return { error: err };

  const { drinkId, clientId } = await resolveIds(drinkSlug, clientSlug);

  const [existing] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.drinkId, drinkId), eq(recipes.clientId, clientId), eq(recipes.isCurrent, true)))
    .limit(1);
  if (existing) return { error: "This client already has a recipe for this drink." };

  await createRecipe(drinkId, clientId, lines, String(form.get("createdBy") ?? "") || null);

  revalidatePath(`/drinks/${drinkSlug}`);
  revalidatePath("/drinks");
  redirect(`/drinks/${drinkSlug}?client=${clientSlug}`);
}

async function createRecipe(drinkId: number, clientId: number, lines: RecipeLineInput[], createdBy: string | null) {
  const [recipe] = await db
    .insert(recipes)
    .values({ drinkId, clientId, version: 1, isCurrent: true, createdBy })
    .returning({ id: recipes.id });
  await db.insert(recipeLines).values(
    lines.map((l, i) => ({ recipeId: recipe.id, componentId: l.componentId, percentage: l.percentage.toFixed(3), displayOrder: i })),
  );
}
