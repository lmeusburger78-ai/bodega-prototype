// Run: node --experimental-strip-types lib/domain/__checks__/recipes.check.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { searchByIngredient, recipesToList, withoutAllergens, type RecipeData } from '../recipes.ts'

const data: RecipeData = JSON.parse(readFileSync(new URL('../../../data/recipes.json', import.meta.url), 'utf8'))
assert.equal(data.recipes.length, 331)
assert.equal(data.ingredientCatalog.length, 357)
assert.equal(data.allergenList.length, 14)
assert.equal(data.cuisines.length, 20)

// every productKey resolves, ids unique
const keys = new Set(data.ingredientCatalog.map(c => c.productKey))
const missing = data.recipes.flatMap(r => r.ingredients.filter(i => !keys.has(i.productKey)).map(i => `${r.id}:${i.productKey}`))
assert.deepEqual(missing, [])
assert.equal(new Set(data.recipes.map(r => r.id)).size, 331)
// allergens only from the EU list
const eu = new Set(data.allergenList)
assert.deepEqual(data.recipes.flatMap(r => r.allergens.filter(a => !eu.has(a))), [])

const pumpkin = searchByIngredient(data, 'Kürbis')
assert.ok(pumpkin.length > 0 && pumpkin[0].mainIngredients.some(k => k.includes('pumpkin')))
assert.ok(withoutAllergens(data, ['gluten']).every(r => !r.allergens.includes('gluten')))

// r01 for 8 instead of 4: 1 kg pumpkin -> 2 kg; salt pre-unticked
const list = recipesToList(data, [{ id: 'r01', servings: 8 }])
assert.equal(list.find(l => l.line.productKey === 'pumpkin-hokkaido')!.line.qty, 2)
console.log(`recipes: alle Prüfungen bestanden (${data.recipes.length} Rezepte)`)
