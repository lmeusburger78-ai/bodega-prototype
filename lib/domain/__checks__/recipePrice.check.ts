// Run: node --experimental-strip-types lib/domain/__checks__/recipePrice.check.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { priceRecipe, priceLabel, candidates, needOf, NOT_FOUND_COMMENT } from '../recipePrice.ts'
import { suggestRecipes, type RecipeData } from '../recipes.ts'
import type { Observation } from '../history.ts'

const data: RecipeData = JSON.parse(readFileSync(new URL('../../../data/recipes.json', import.meta.url), 'utf8'))
let n = 0
const ob = (name: string, value: number, unit: 'kg' | 'l' | 'stk', price: number, brand = ''): Observation =>
  ({ date: '2026-11-20', retailer: 'billa', sku: `s${n++}`, name, brand, pack: { value, unit }, price, seals: [], source: 't' })
const cat = (k: string) => data.ingredientCatalog.find(c => c.productKey === k)!

assert.deepEqual(needOf(250, 'ml'), { value: 0.25, dim: 'l' })
assert.equal(needOf(2, 'tbsp'), null)

// whole words only: "Butter" is not "Butterzopf"
assert.equal(candidates(cat('butter'), [ob('Ölz Butterzopf mit Honig', 0.5, 'kg', 4.39, 'Ölz'), ob('Butter- Croissant- & Plunderteig', 0.4, 'kg', 1.59), ob('Marille Krapfen 4er', 0.36, 'kg', 2.76)], 'kg').length, 0)
assert.equal(candidates(cat('butter'), [ob('Butter', 0.25, 'kg', 2.49)], 'kg').length, 1)
// real wrong matches from the first run must not come back
assert.equal(candidates(cat('apricot-jam'), [ob('Marille Krapfen 4er', 0.36, 'kg', 2.76)], 'kg').length, 0)
assert.equal(candidates(cat('beef-shin'), [ob('WOW Adult Rind', 0.8, 'kg', 3.99)], 'kg').length, 0)
assert.equal(candidates(cat('beetroot'), [ob('BILLA Heringssalat Rote Rüben', 0.17, 'kg', 2.99, 'BILLA')], 'kg').length, 0)
// harmless descriptors are fine
assert.equal(candidates(cat('zucchini'), [ob('Ja! Natürlich Bio Zucchini grün', 1, 'stk', 0.99, 'Ja! Natürlich')], 'stk').length, 1)
// pieces only for counted goods: a cinnamon jar is not "1 stick"
assert.equal(candidates(cat('cinnamon-stick'), [ob('Kotányi Zimt Ganz', 1, 'stk', 2.99, 'Kotányi')], 'stk').length, 0)
// "Pasta" is a category: a generic pasta article does not price Spaghetti, Linguine or Lasagne sheets
const pasta = ob('Italienische Pasta', 0.25, 'kg', 2.49)
for (const k of ['pasta-spaghetti', 'pasta-linguine', 'lasagne-sheets']) if (data.ingredientCatalog.some(c => c.productKey === k)) assert.equal(candidates(cat(k), [pasta], 'kg', data.ingredientCatalog).length, 0, k)
// "Kräuter" is not "Kraut"
assert.equal(candidates(cat('sauerkraut'), [ob('Kräuter', 0.03, 'kg', 1)], 'kg', data.ingredientCatalog).length, 0)
// dimension must fit: a pumpkin sold per kg is not found for a recipe in ml
assert.equal(candidates(cat('pumpkin-hokkaido'), [ob('Bio-Hokkaido-Kürbis', 1, 'kg', 2.18)], 'l').length, 0)

// r01 Kürbiscremesuppe (4 servings): only the pumpkin has an offer → "ab", rest missing with comment
const r01 = data.recipes.find(r => r.id === 'r01')!
const p = priceRecipe(r01, 4, data, [ob('Ja! Natürlich Bio-Hokkaido-Kürbis', 1, 'kg', 2.18, 'Ja! Natürlich')])
const kuerbis = p.lines.find(l => l.ingredient.productKey === 'pumpkin-hokkaido')!
assert.equal(kuerbis.status, 'priced'); assert.equal(kuerbis.cost, 2.18) // 1 kg × 2,18
assert.equal(p.label, 'ab'); assert.ok(p.missing.length > 0)
assert.equal(p.lines.find(l => l.status === 'missing')!.comment, NOT_FOUND_COMMENT)
assert.equal(p.lines.find(l => l.ingredient.productKey === 'salt')!.status, 'pantry') // not counted as missing
assert.match(priceLabel(p), /^ab €/)
// 8 servings use twice the pumpkin
assert.equal(priceRecipe(r01, 8, data, [ob('Hokkaido Kürbis', 1, 'kg', 2.18)]).lines.find(l => l.ingredient.productKey === 'pumpkin-hokkaido')!.cost, 4.36)
// nothing found: no price, never a guess
const none = priceRecipe(r01, 4, data, [])
assert.deepEqual([none.perServing, none.label, priceLabel(none)], [null, 'kein Preis', 'kein Preis'])
// whole packs: 1 kg needed, 0.75 kg packs → 2 packs to buy, but only 1 kg of cost
const two = priceRecipe(r01, 4, data, [ob('Hokkaido Kürbis', 0.75, 'kg', 1.5)]).lines.find(l => l.ingredient.productKey === 'pumpkin-hokkaido')!
assert.deepEqual([two.cost, two.buyCost], [2, 3])

// promotions that start later do not count today, but on their day
const later = { ...ob('Hokkaido Kürbis', 1, 'kg', 0.99), promoFrom: '2026-11-26', promoUntil: '2026-12-02' }
const normal = ob('Hokkaido Kürbis', 1, 'kg', 2.18)
const pumpkin = (day: string) => priceRecipe(r01, 4, data, [later, normal], day).lines.find(l => l.ingredient.productKey === 'pumpkin-hokkaido')!.cost
assert.equal(pumpkin('2026-11-20'), 2.18); assert.equal(pumpkin('2026-11-27'), 0.99); assert.equal(pumpkin('2026-12-03'), 2.18)

// suggestions: staples do not count, main ingredient counts double, max three with the top score
const s = suggestRecipes(data, ['pumpkin-hokkaido', 'salt'])
assert.ok(s.top.length >= 1 && s.top.length <= 3)
assert.ok(s.top.every(x => x.score === s.top[0].score))
assert.ok(s.top.every(x => x.recipe.ingredients.some(i => i.productKey === 'pumpkin-hokkaido')))
assert.equal(suggestRecipes(data, ['salt']).top.length, 0)
const cheap = suggestRecipes(data, ['pumpkin-hokkaido'], r => (r.id === 'r01' ? 1 : 9))
assert.equal(cheap.top[0].recipe.id === 'r01' || cheap.top[0].score > cheap.top.at(-1)!.score, true)

console.log('recipePrice: alle Prüfungen bestanden')
