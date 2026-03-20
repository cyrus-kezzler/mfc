export type Client = 'MFC' | 'Fortnum & Mason' | 'Cripps' | 'Bailey & Sage' | 'Macknade' | 'Liberty';

export type IngredientType = 'jerry-can' | 'bottle' | 'house-made' | 'dashes';

export interface SubRecipeIngredient {
  name: string;
  amountPer326ml: number; // in grams
  unit: 'g';
}

export interface SubRecipe {
  name: string;
  baseBatchMl: number;
  ingredients: SubRecipeIngredient[];
  hasPhosphoricBreakdown?: boolean;
}

export interface Ingredient {
  name: string;
  type: IngredientType;
  bottleSize?: number; // ml, for bottle type (default 700)
  subRecipe?: SubRecipe; // for house-made type
  dashesPerLitre?: number; // for dashes type (fixed rate)
}

export interface RecipeIngredient {
  ingredientName: string;
  parts?: number; // ratio parts (will be normalised to 100)
  dashesPerLitre?: number; // for dashes type — fixed rate, not a ratio
}

export interface Recipe {
  name: string;
  clients: Client[];
  ingredients: RecipeIngredient[];
  abv?: number; // optional metadata
  notes?: string;
}

// ——— Calculation output types ———

export interface JerryCanResult {
  ingredientName: string;
  ml: number;
}

export interface BottleResult {
  ingredientName: string;
  ml: number;
  fullBottles: number;
  remainderMl: number;
  bottleSize: number;
}

export interface SubRecipeScaled {
  ingredientName: string;
  amountG: number;
  unit: 'g';
  isPhosphoricSolution?: boolean;
  phosphoricBreakdown?: {
    acidG: number; // grams of 75% food-grade phosphoric acid
    waterG: number;
  };
}

export interface HouseMadeResult {
  ingredientName: string;
  ml: number;
  subRecipeItems?: SubRecipeScaled[];
}

export interface DashesResult {
  ingredientName: string;
  totalDashes: number;
}

export interface BatchCalculation {
  recipeName: string;
  targetLitres: number;
  targetMl: number;
  jerryCans: JerryCanResult[];
  bottles: BottleResult[];
  houseMade: HouseMadeResult[];
  dashes: DashesResult[];
}

// ——— Settings types ———

export interface IngredientOverride {
  bottleSize?: number;
  type?: IngredientType;
}

export interface AppSettings {
  ingredientOverrides: Record<string, IngredientOverride>;
}
