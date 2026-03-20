import { Recipe, Ingredient, BatchCalculation, AppSettings, IngredientType } from '@/types';
import { getIngredient } from '@/data/ingredients';

function resolveIngredient(name: string, settings: AppSettings): Ingredient {
  const base = getIngredient(name) ?? {
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
        result.jerryCans.push({ ingredientName: ri.ingredientName, ml });
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
        });
        break;
      }

      case 'house-made': {
        const hmResult: typeof result.houseMade[0] = {
          ingredientName: ri.ingredientName,
          ml,
        };
        if (ingredient.subRecipe) {
          const scaleFactor = ml / ingredient.subRecipe.baseBatchMl;
          hmResult.subRecipeItems = ingredient.subRecipe.ingredients.map((sri) => {
            const scaledG = parseFloat((sri.amountPer326ml * scaleFactor).toFixed(1));
            if (
              ingredient.subRecipe?.hasPhosphoricBreakdown &&
              sri.name === 'Phosphoric acid 1.25% solution'
            ) {
              // 1.25g 75%-acid + 100g water = 101.25g solution
              const acidG = parseFloat((scaledG * (1.25 / 101.25)).toFixed(2));
              const waterG = parseFloat((scaledG * (100 / 101.25)).toFixed(2));
              return {
                ingredientName: sri.name,
                amountG: scaledG,
                unit: 'g' as const,
                isPhosphoricSolution: true,
                phosphoricBreakdown: { acidG, waterG },
              };
            }
            return { ingredientName: sri.name, amountG: scaledG, unit: 'g' as const };
          });
        }
        result.houseMade.push(hmResult);
        break;
      }

      case 'dashes':
        // Ratio-driven dashes are unusual — treat as house-made ml
        result.houseMade.push({ ingredientName: ri.ingredientName, ml });
        break;
    }
  }

  // Process fixed-rate dashes
  for (const di of dashIngredients) {
    const ingredient = resolveIngredient(di.ingredientName, settings);
    const dashesPerLitre = di.dashesPerLitre ?? ingredient.dashesPerLitre ?? 0;
    const totalDashes = Math.round(dashesPerLitre * targetLitres);
    result.dashes.push({ ingredientName: di.ingredientName, totalDashes });
  }

  return result;
}

export function getDefaultSettings(): AppSettings {
  return { ingredientOverrides: {} };
}
