/**
 * Recipes from data/recipes.json (copied from blackbox-app, branch round-2):
 * 331 recipes, 357 catalogue ingredients, the 14 EU allergens, 20 cuisines.
 * Allergens are typical values; the product label decides.
 */
import type { ListLine } from './compare.ts'

export type Ingredient = { name: string; qty: number | null; unit: string; productKey: string; regional?: boolean; optional?: boolean }
export type Recipe = {
  id: string; title: string; titleDe: string; category: string; cuisine: string
  diet: string[]; allergens: string[]; freeFrom: string[]; mainIngredients: string[]
  servings: number; timeMin: number; difficulty: string; budget: string
  ingredients: Ingredient[]; steps: string[]; stepsDe?: string[]; regionalShare?: number; imageQuery?: string
}
export type CatalogItem = {
  productKey: string; name: string; nameDe: string; aliases: string[]; group: string
  storageZone: string; allergens: string[]; regional: boolean; pantryStaple: boolean
  regionalMonths: number[]; availableOffSeason: boolean
}
export type RecipeData = { recipes: Recipe[]; ingredientCatalog: CatalogItem[]; allergenList: string[]; cuisines: string[] }

/** Ingredient search: name, German name and aliases; recipes with it as main ingredient first. */
export function searchByIngredient(data: RecipeData, query: string): Recipe[] {
  const q = query.trim().toLowerCase()
  const keys = new Set(data.ingredientCatalog
    .filter(c => [c.name, c.nameDe, ...c.aliases].some(n => n.toLowerCase().includes(q)))
    .map(c => c.productKey))
  return data.recipes
    .filter(r => r.ingredients.some(i => keys.has(i.productKey)))
    .sort((a, b) => Number(b.mainIngredients.some(k => keys.has(k))) - Number(a.mainIngredients.some(k => keys.has(k))))
}

/** Recipes without any of the given allergens. */
export const withoutAllergens = (data: RecipeData, avoid: string[]) =>
  data.recipes.filter(r => !r.allergens.some(a => avoid.includes(a)))

/**
 * Turn recipes into shopping-list lines, scaled to the servings wanted and merged
 * per ingredient. Weights and volumes become base-unit quantities (compared by
 * price per kg / l), pieces stay pieces. Spoon, pinch and "to taste" amounts
 * become one pack. Pantry staples come back as `preUnticked`, as the recipe data
 * asks: most people have salt at home.
 */
export function recipesToList(data: RecipeData, picks: { id: string; servings: number }[]): { line: ListLine; preUnticked: boolean }[] {
  const cat = new Map(data.ingredientCatalog.map(c => [c.productKey, c]))
  const acc = new Map<string, { qty: number; unit: 'kg' | 'l' | 'stk' | 'pack'; name: string }>()
  for (const p of picks) {
    const r = data.recipes.find(x => x.id === p.id)
    if (!r) continue
    const f = p.servings / r.servings
    for (const i of r.ingredients) {
      if (i.optional) continue
      const conv = toBase(i.qty, i.unit)
      const prev = acc.get(i.productKey)
      const name = cat.get(i.productKey)?.nameDe ?? i.name
      if (!prev) acc.set(i.productKey, { qty: conv.qty * (conv.unit === 'pack' ? 1 : f), unit: conv.unit, name })
      else if (prev.unit === conv.unit && conv.unit !== 'pack') prev.qty += conv.qty * f
    }
  }
  return [...acc].map(([productKey, a]) => ({
    line: { query: a.name, productKey, qty: a.unit === 'pack' ? 1 : round(a.qty) },
    preUnticked: cat.get(productKey)?.pantryStaple ?? false,
  }))
}

function toBase(qty: number | null, unit: string): { qty: number; unit: 'kg' | 'l' | 'stk' | 'pack' } {
  if (qty == null) return { qty: 1, unit: 'pack' }
  switch (unit) {
    case 'g': return { qty: qty / 1000, unit: 'kg' }
    case 'kg': return { qty, unit: 'kg' }
    case 'ml': return { qty: qty / 1000, unit: 'l' }
    case 'l': return { qty, unit: 'l' }
    case 'pc': case 'clove': case 'loaf': case 'can': return { qty, unit: 'stk' }
    default: return { qty: 1, unit: 'pack' } // tbsp, tsp, pinch, bunch, sprig, pack
  }
}
const round = (n: number) => Math.round(n * 1000) / 1000
