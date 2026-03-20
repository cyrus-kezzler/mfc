import { Recipe } from '@/types';

export const RECIPES: Recipe[] = [
  // ═══════════════════════════════════════
  // MFC
  // ═══════════════════════════════════════
  {
    name: 'Baby Otis',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Havana Club', parts: 50 },
      { ingredientName: 'Cocchi Torino', parts: 25 },
      { ingredientName: 'Cocchi Americano', parts: 25 },
    ],
  },
  {
    name: 'Clementini',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Peel Infused Gin', parts: 45 },
      { ingredientName: 'Conotto', parts: 25 },
      { ingredientName: 'Sours', parts: 25 },
      { ingredientName: 'Agave', parts: 5 },
    ],
  },
  {
    name: 'Cold Brew Negroni',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Gin', parts: 33 },
      { ingredientName: 'Sweet Vermouth', parts: 33 },
      { ingredientName: 'Campari', parts: 33 },
      { ingredientName: 'Water', parts: 1 },
    ],
  },
  {
    name: 'Corpse Reviver',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Gin', parts: 25 },
      { ingredientName: 'Lillet', parts: 25 },
      { ingredientName: 'Curacao', parts: 25 },
      { ingredientName: 'Sours', parts: 25 },
    ],
  },
  {
    name: 'Dempsey',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Gin', parts: 48 },
      { ingredientName: 'Calvados', parts: 48 },
      { ingredientName: 'Absinthe', parts: 2 },
      { ingredientName: 'Grenadine', parts: 2 },
    ],
  },
  {
    name: 'Desert Negroni',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Tequila', parts: 33.3 },
      { ingredientName: 'Cocchi Torino', parts: 33.3 },
      { ingredientName: 'Campari', parts: 33.3 },
    ],
  },
  {
    name: 'Espresso Martini',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Vodka', parts: 33.3 },
      { ingredientName: 'Kahlua', parts: 33.3 },
      { ingredientName: 'Coffee', parts: 33.3 },
    ],
  },
  {
    name: 'Cherry Espresso Martini',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Vodka', parts: 30 },
      { ingredientName: 'Kahlua', parts: 30 },
      { ingredientName: 'Coffee', parts: 30 },
      { ingredientName: 'Cherry', parts: 10 },
    ],
  },
  {
    name: 'Gibson Martini',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Gin', parts: 80 },
      { ingredientName: 'Noilly Prat', parts: 10 },
      { ingredientName: 'Water', parts: 10 },
    ],
  },
  {
    name: 'Gin & It',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Gin', parts: 60 },
      { ingredientName: 'Sweet Vermouth', parts: 30 },
      { ingredientName: 'Water', parts: 10 },
    ],
  },
  {
    name: 'Lychee Martini',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Gin', parts: 52.2 },
      { ingredientName: 'Lychee', parts: 26.1 },
      { ingredientName: 'Dry Vermouth', parts: 13 },
      { ingredientName: 'Water', parts: 8.7 },
    ],
  },
  {
    name: 'Manhattan',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Rye', parts: 66 },
      { ingredientName: 'Antica', parts: 17 },
      { ingredientName: 'Cocchi Torino', parts: 17 },
    ],
  },
  {
    name: 'Margarita',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Tequila', parts: 50 },
      { ingredientName: 'Sours', parts: 22.5 },
      { ingredientName: 'Triple Sec', parts: 22.5 },
      { ingredientName: 'Agave Syrup', parts: 5 },
    ],
  },
  {
    name: 'Naked & Famous',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Mezcal', parts: 25 },
      { ingredientName: 'Chartreuse', parts: 25 },
      { ingredientName: 'Aperol', parts: 25 },
      { ingredientName: 'Sours', parts: 25 },
    ],
  },
  {
    name: 'Negroni',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Gin', parts: 33.3 },
      { ingredientName: 'Antica', parts: 16.5 },
      { ingredientName: 'Cocchi Torino', parts: 16.5 },
      { ingredientName: 'Campari', parts: 33.3 },
    ],
  },
  {
    name: 'Pisco Martini',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Gin', parts: 25 },
      { ingredientName: 'Pisco', parts: 25 },
      { ingredientName: 'Noilly Prat', parts: 25 },
      { ingredientName: 'Cocchi Torino', parts: 25 },
    ],
  },
  {
    name: 'Red Hook',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Rye', parts: 61 },
      { ingredientName: 'Punt e Mes', parts: 17 },
      { ingredientName: 'Maraschino', parts: 11 },
      { ingredientName: 'Water', parts: 11 },
    ],
  },
  {
    name: 'Rum Old Fashioned',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Rum', parts: 88 },
      { ingredientName: 'Simple Syrup', parts: 12 },
      { ingredientName: "Bob's Vanilla Bitters", dashesPerLitre: 20 },
    ],
  },
  {
    name: 'Trident',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Akvavit', parts: 33.3 },
      { ingredientName: 'Manzanilla', parts: 33.3 },
      { ingredientName: 'Cynar', parts: 33.3 },
    ],
  },
  {
    name: 'Tuxedo',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Old Tom', parts: 60 },
      { ingredientName: 'Dry Vermouth', parts: 15 },
      { ingredientName: 'Fino Sherry', parts: 14 },
      { ingredientName: 'Absinthe', parts: 1 },
      { ingredientName: 'Water', parts: 10 },
    ],
  },
  {
    name: 'Vesper Martini',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Gin', parts: 60 },
      { ingredientName: 'Vodka', parts: 20 },
      { ingredientName: 'Lillet', parts: 11.1 },
      { ingredientName: 'Cocchi Americano', parts: 8.9 },
    ],
  },
  {
    name: 'Yuzu Negroni',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Gin', parts: 29 },
      { ingredientName: 'Yuzu Sake', parts: 29 },
      { ingredientName: 'Campari', parts: 29 },
      { ingredientName: 'Punt e Mes', parts: 14 },
      { ingredientName: 'Water', parts: 1 },
    ],
  },
  {
    name: 'Cosmopolitan',
    clients: ['MFC'],
    ingredients: [
      { ingredientName: 'Vodka', parts: 27 },
      { ingredientName: 'Kecello', parts: 27 },
      { ingredientName: 'Verjus', parts: 18 },
      { ingredientName: 'Cranberry', parts: 9 },
      { ingredientName: 'Water', parts: 18 },
    ],
  },

  // ═══════════════════════════════════════
  // Fortnum & Mason
  // ═══════════════════════════════════════
  {
    name: 'F&M Vesper 2025',
    clients: ['Fortnum & Mason'],
    ingredients: [
      { ingredientName: 'Gin', parts: 60.6 },
      { ingredientName: 'Vodka', parts: 10.1 },
      { ingredientName: 'Lillet', parts: 10.1 },
      { ingredientName: 'Cocchi Americano', parts: 10.1 },
      { ingredientName: 'Water', parts: 9.1 },
    ],
  },
  {
    name: 'F&M Espresso Daiquiri 2025',
    clients: ['Fortnum & Mason'],
    ingredients: [
      { ingredientName: 'Bimber Rum', parts: 33 },
      { ingredientName: 'Kahlua', parts: 33 },
      { ingredientName: 'Espresso', parts: 33 },
    ],
  },
  {
    name: 'F&M Robin Roy',
    clients: ['Fortnum & Mason'],
    ingredients: [
      { ingredientName: 'English Whisky', parts: 56 },
      { ingredientName: 'Cocchi Torino', parts: 28 },
      { ingredientName: 'Water', parts: 16 },
    ],
  },
  {
    name: 'F&M Griotte',
    clients: ['Fortnum & Mason'],
    abv: undefined, // ABV stored as metadata — add when known
    notes: 'ABV listed separately',
    ingredients: [
      { ingredientName: 'Mozart', parts: 30 },
      { ingredientName: 'Heering', parts: 20 },
      { ingredientName: 'Kahlua', parts: 20 },
      { ingredientName: 'Jerez', parts: 30 },
      { ingredientName: 'Water', parts: 10 },
    ],
  },
  {
    name: 'F&M Apple Crumble',
    clients: ['Fortnum & Mason'],
    ingredients: [
      { ingredientName: 'Black Button Bourbon', parts: 50 },
      { ingredientName: 'Apple', parts: 25 },
      { ingredientName: 'Oat', parts: 13 },
      { ingredientName: 'Water', parts: 12 },
    ],
  },
  {
    name: 'F&M Autumn Nectar',
    clients: ['Fortnum & Mason'],
    ingredients: [
      { ingredientName: 'Shipwreck Rum', parts: 70 },
      { ingredientName: 'Fernet', parts: 9 },
      { ingredientName: 'Maple Syrup', parts: 9 },
      { ingredientName: 'Water', parts: 12 },
    ],
  },

  // ═══════════════════════════════════════
  // Cripps
  // ═══════════════════════════════════════
  {
    name: 'Cripps Rum Old Fashioned',
    clients: ['Cripps'],
    ingredients: [
      { ingredientName: 'Ramskull Rum', parts: 85.7 },
      { ingredientName: 'Simple Syrup', parts: 14.3 },
    ],
  },
  {
    name: 'Salted Caramel Caramba',
    clients: ['Cripps'],
    ingredients: [
      { ingredientName: 'Ramskull Rum', parts: 30 },
      { ingredientName: 'Mozart', parts: 20 },
      { ingredientName: 'Kahlua', parts: 30 },
      { ingredientName: 'Saline 1:1', parts: 3 },
      { ingredientName: 'Water', parts: 17 },
    ],
  },
  {
    name: 'Cripps Negroni',
    clients: ['Cripps'],
    ingredients: [
      { ingredientName: 'Gin', parts: 33.3 },
      { ingredientName: 'Antica', parts: 16.5 },
      { ingredientName: 'Punt e Mes', parts: 16.5 },
      { ingredientName: 'Campari', parts: 33.3 },
    ],
  },
  {
    name: 'Cripps Espresso Martini',
    clients: ['Cripps'],
    ingredients: [
      { ingredientName: 'Vodka', parts: 33.3 },
      { ingredientName: 'Kahlua', parts: 33.3 },
      { ingredientName: 'Espresso', parts: 33.3 },
    ],
  },
];
