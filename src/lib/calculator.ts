import { Recipe, Ingredient, BatchCalculation, AppSettings, IngredientType } from '@/types';

/**
 * Legacy batch maths for the old client-side calculator component.
 *
 * The checked-in ingredient register (src/data/ingredients.ts) is gone: the
 * live register is the database (see @/lib/erp/ingredients), and the live
 * calculator page at /calculator reads recipes and costs from there. This
 * module survives only for the legacy Calculator component, so ingredient
 * metadata now comes solely from the user's local settings overrides, with a
 * plain 700ml bottle as the default.
 */
function resolveIngredient(name: string, settings: AppSettings): Ingredient {
  const base: Ingredient = {
    name,
    type: 'bottle' as IngredientType,
    bottleSize: 700,
  };
  const override = settings.ingredientOverrides[name];
  if (!override) return base;
  return {
    ...base,
    ...(override.type ? { type: override.type } : {}),
    ...(override.bottleSize !== undefined ? { bottleSize: override.bottleSize } : {}),
  };
}

export function calculateBatch(
  recipe: Recipe,
  targetLitres: number,
  settings: AppSettings
): BatchCalculation {
  const targetMl = targetLitres * 1000;

  // Separate ratio ingredients from dashes-only ingredients
  const ratioIngredients = recipe.ingredients.filter(
    (i) => i.parts !== undefined
  );
  const dashIngredients = recipe.ingredients.filter(
    (i) => i.dashesPerLitre !== undefined && i.parts === undefined
  );

  // Normalise ratio parts to 100
  const totalParts = ratioIngredients.reduce((sum, i) => sum + (i.parts ?? 0), 0);
  const normFactor = totalParts > 0 ? 100 / totalParts : 1;

  const result: BatchCalculation = {
    recipeName: recipe.name,
    targetLitres,
    targetMl,
    jerryCans: [],
    bottles: [],
    houseMade: [],
    dashes: [],
  };

  // Process ratio ingredients
  for (const ri of ratioIngredients) {
    const normParts = (ri.parts ?? 0) * normFactor;
    const ml = Math.round((normParts / 100) * targetMl);
    const ingredient = resolveIngredient(ri.ingredientName, settings);

    switch (ingredient.type) {
      case 'jerry-can':
        result.jerryCans.push({ ingredientName: ri.ingredientName, ml, note: ri.note });
        break;

      case 'bottle': {
        const size = ingredient.bottleSize ?? 700;
        const fullBottles = Math.floor(ml / size);
        const remainderMl = ml - fullBottles * size;
        result.bottles.push({
          ingredientName: ri.ingredientName,
          ml,
          fullBottles,
          remainderMl,
          bottleSize: size,
          note: ri.note,
        });
        break;
      }

      case 'house-made': {
        // Sub-recipe expansion used to come from the checked-in register; the
        // database sub-recipe planner (@/lib/erp/sub-recipes planBatch) is the
        // live replacement, so here a house-made line is just its volume.
        result.houseMade.push({
          ingredientName: ri.ingredientName,
          ml,
          note: ri.note,
        });
        break;
      }

      case 'dashes':
        // Ratio-driven dashes are unusual, treat as house-made ml
        result.houseMade.push({ ingredientName: ri.ingredientName, ml });
        break;
    }
  }

  // Process fixed-rate dashes
  for (const di of dashIngredients) {
    const ingredient = resolveIngredient(di.ingredientName, settings);
    const dashesPerLitre = di.dashesPerLitre ?? ingredient.dashesPerLitre ?? 0;
    const totalDashes = Math.round(dashesPerLitre * targetLitres);
    result.dashes.push({ ingredientName: di.ingredientName, totalDashes, note: di.note });
  }

  return result;
}

export function getDefaultSettings(): AppSettings {
  return { ingredientOverrides: {} };
}
