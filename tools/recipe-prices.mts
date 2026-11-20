// Usage: node --experimental-strip-types tools/recipe-prices.mts [YYYY-MM-DD]
// Prices every recipe from the shelf prices of one day. Writes data/recipe-prices/<date>.json.
import { readFileSync, writeFileSync } from 'node:fs'
import { priceRecipe, priceLabel } from '../lib/domain/recipePrice.ts'
import type { RecipeData } from '../lib/domain/recipes.ts'
import type { Observation } from '../lib/domain/history.ts'

const date = process.argv[2] ?? new Date().toISOString().slice(0, 10)
const data: RecipeData = JSON.parse(readFileSync('data/recipes.json', 'utf8'))
const offers: Observation[] = readFileSync(`data/prices/${date}.jsonl`, 'utf8').trim().split('\n').map(l => JSON.parse(l))
const out = data.recipes.map(r => {
  const p = priceRecipe(r, r.servings, data, offers, date)
  return {
    id: r.id, servings: r.servings, label: p.label, perServing: p.perServing, text: priceLabel(p),
    missing: p.missing, // ingredients without a price, to show on the card and put on the list with a comment
    lines: p.lines.map(l => ({ productKey: l.ingredient.productKey, name: l.ingredient.name, status: l.status, cost: l.cost, buyCost: l.buyCost,
      article: l.article && { retailer: l.article.retailer, name: l.article.name, pack: l.article.pack, price: l.article.price, source: l.article.source },
      reason: l.reason, comment: l.comment })),
  }
})
writeFileSync(`data/recipe-prices/${date}.json`, JSON.stringify({ date, recipes: out }))
const priced = out.flatMap(r => r.lines).filter(l => l.status !== 'pantry')
console.log(`${out.length} Rezepte | mit Preis: ${out.filter(r => r.perServing != null).length} | vollständig: ${out.filter(r => r.label === 'exakt').length} | Zutaten bepreist: ${priced.filter(l => l.status === 'priced').length} von ${priced.length}`)
