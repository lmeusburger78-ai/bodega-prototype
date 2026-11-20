/**
 * What a recipe costs per serving, from real shelf prices.
 *
 * Rules (agreed):
 * - Only products that are actually found get a price. A missing product has no
 *   price, never a guess; it comes back with a comment for the shopping list
 *   ("Nicht im Sortiment gefunden · Im Bioladen fragen").
 * - The recipe card shows "ab €x" when something is missing, and names what is
 *   missing. "Ab" is a floor: the real total is at least that.
 * - Amounts are compared in the same dimension only: weight with price per kg,
 *   volume with price per l, count with price per piece. "1 l Dashi" is never
 *   set against a 50 g powder pack; if no offer fits the dimension, the
 *   ingredient is missing with the reason, not priced wrongly.
 * - Cost is the share of the price that the recipe uses (amount × unit price).
 *   What has to be bought, whole packs, is a separate figure (`buyCost`).
 * - Pantry staples (salt, oil, flour, spices) and "to taste" amounts are not
 *   priced and not counted as missing; they are listed as "Vorrat".
 */
import type { Observation } from './history.ts'
import type { Ingredient, Recipe, CatalogItem, RecipeData } from './recipes.ts'
import { fold, stem, buildLexicon, profile } from '../match/match.ts'

export const NOT_FOUND_COMMENT = 'Nicht im Sortiment gefunden · Im Bioladen fragen'

export type LineStatus = 'priced' | 'missing' | 'pantry'
export type PricedLine = {
  ingredient: Ingredient
  status: LineStatus
  /** share of the price the recipe uses */
  cost?: number
  /** whole packs the shopper has to buy */
  buyCost?: number
  article?: Observation
  /** why there is no price, or the shopping-list comment */
  reason?: string
  comment?: string
}
export type RecipePrice = {
  recipe: Recipe
  servings: number
  lines: PricedLine[]
  pricedTotal: number
  buyTotal: number
  /** price per serving of what is priced; null when nothing could be priced */
  perServing: number | null
  /** "ab" when at least one ingredient has no price */
  label: 'exakt' | 'ab' | 'kein Preis'
  missing: string[]
}

type Dim = 'kg' | 'l' | 'stk'
/** Recipe amount in base units, or null when the unit cannot be converted safely. */
export function needOf(qty: number | null, unit: string): { value: number; dim: Dim } | null {
  if (qty == null) return null
  switch (unit) {
    case 'g': return { value: qty / 1000, dim: 'kg' }
    case 'kg': return { value: qty, dim: 'kg' }
    case 'ml': return { value: qty / 1000, dim: 'l' }
    case 'l': return { value: qty, dim: 'l' }
    case 'pc': case 'clove': case 'loaf': case 'can': return { value: qty, dim: 'stk' }
    default: return null // tbsp, tsp, pinch, bunch, sprig, pack: depend on the product
  }
}

const words = (s: string) => fold(s).split(' ').filter(Boolean).map(stem)

/**
 * All names the catalogue knows for an ingredient, as token sets. An alias that
 * several different ingredients share is a category, not a name ("Pasta" for
 * Spaghetti, Linguine and Lasagne sheets; "Kürbis" for every pumpkin): it is
 * left out, otherwise a generic "Pasta" article would price every one of them.
 */
const aliasOwners = new WeakMap<CatalogItem[], Map<string, Set<string>>>()
export function namesOf(c: CatalogItem, catalog?: CatalogItem[]): string[][] {
  let owners: Map<string, Set<string>> | undefined
  if (catalog) {
    owners = aliasOwners.get(catalog)
    if (!owners) {
      owners = new Map()
      for (const it of catalog) for (const n of [it.nameDe, ...it.aliases]) {
        const k = words(n).join(' '); if (!k) continue
        owners.set(k, (owners.get(k) ?? new Set()).add(fold(it.nameDe)))
      }
      aliasOwners.set(catalog, owners)
    }
  }
  const own = words(c.nameDe).join(' ')
  return [c.nameDe, ...c.aliases].map(words).filter(w => w.length && (w.join(' ') === own || !owners || (owners.get(w.join(' '))?.size ?? 1) <= 1))
}

/**
 * Words that describe a product without changing what it is. An article may carry
 * these on top of the ingredient's name; any other extra word ("Croissant",
 * "Krapfen", "Heringssalat", "Adult") means a different product and rejects it.
 * Precision first: a missed match only costs a missing price, a wrong one a wrong price.
 */
export const DESCRIPTORS = new Set([
  'bio', 'frisch', 'natur', 'naturell', 'klassisch', 'mild', 'regional', 'haltbar', 'gross', 'klein', 'mini', 'mix', 'extra', 'fein', 'saftig', 'süß', 'rein',
  'gelb', 'rot', 'grün', 'weiss', 'schwarz', 'kernlos', 'kernarm', 'junge', 'jung', 'reif', 'vorgereift', 'gewaschen', 'gerieben', 'geschnitten', 'ganz',
  'italienisch', 'österreichisch', 'steirisch', 'tirol', 'regionale', 'heimisch', 'spanisch', 'deutsch', 'griechisch',
  'tasse', 'packung', 'stück', 'stk', 'becher', 'beutel', 'flasche', 'dose', 'gewichtsware', 'ca', 'ab',
].map(w => stem(fold(w))))

type Index = { cores: Map<Observation, Set<string>> }
const indexes = new WeakMap<Observation[], Index>()
function indexOf(offers: Observation[]): Index {
  let idx = indexes.get(offers)
  if (!idx) {
    const lex = buildLexicon(offers) // brands learned from the data are not part of the product name
    idx = { cores: new Map(offers.map(o => [o, profile(o, lex).core])) }
    indexes.set(offers, idx)
  }
  return idx
}

/** Groups where "1 piece" really means a counted item (a zucchini, an egg, a roll) and not a jar or pack. */
const COUNTED_GROUPS = new Set(['Fruit & Veg', 'Dairy & Eggs', 'Bakery'])

/**
 * Offers that are this ingredient: every word of one of its names is in the article
 * name, and every other word of the article is a harmless descriptor.
 * "Zucchini grün" is Zucchini; "Butter-Croissant-Teig" is not Butter.
 */
export function candidates(item: CatalogItem, offers: Observation[], dim: Dim, catalog?: CatalogItem[]): Observation[] {
  if (dim === 'stk' && !COUNTED_GROUPS.has(item.group)) return []
  const names = namesOf(item, catalog), { cores } = indexOf(offers)
  return offers.filter(o => {
    if (o.pack.unit !== dim) return false
    const aw = cores.get(o)!
    return names.some(n => n.every(w => aw.has(w)) && [...aw].every(w => n.includes(w) || DESCRIPTORS.has(w)))
  })
}

const unitPrice = (o: Observation) => o.price / o.pack.value

export function priceRecipe(recipe: Recipe, servings: number, data: RecipeData, offers: Observation[]): RecipePrice {
  const cat = new Map(data.ingredientCatalog.map(c => [c.productKey, c]))
  const f = servings / recipe.servings
  const lines: PricedLine[] = []
  for (const ing of recipe.ingredients) {
    const item = cat.get(ing.productKey)
    if (ing.optional) continue
    if (!item || item.pantryStaple || ing.qty == null) { lines.push({ ingredient: ing, status: 'pantry', reason: 'Vorrat' }); continue }
    const need = needOf(ing.qty * f, ing.unit)
    const missing = (reason: string): PricedLine => ({ ingredient: ing, status: 'missing', reason, comment: NOT_FOUND_COMMENT })
    if (!need) { lines.push(missing(`Einheit „${ing.unit}“ nicht sicher umrechenbar`)); continue }
    const c = candidates(item, offers, need.dim, data.ingredientCatalog)
    if (!c.length) { lines.push(missing(`kein ${need.dim === 'kg' ? 'Gewicht' : need.dim === 'l' ? 'Volumen' : 'Stück'}-Angebot gefunden`)); continue }
    const best = c.reduce((a, b) => (unitPrice(b) < unitPrice(a) ? b : a))
    const cost = need.value * unitPrice(best)
    const packs = Math.max(1, Math.ceil(need.value / best.pack.value - 1e-9))
    lines.push({ ingredient: ing, status: 'priced', cost: round(cost), buyCost: round(packs * best.price), article: best })
  }
  const priced = lines.filter(l => l.status === 'priced')
  const pricedTotal = round(priced.reduce((s, l) => s + l.cost!, 0))
  const missing = lines.filter(l => l.status === 'missing').map(l => l.ingredient.name)
  return {
    recipe, servings, lines, pricedTotal, buyTotal: round(priced.reduce((s, l) => s + l.buyCost!, 0)),
    perServing: priced.length ? round(pricedTotal / servings) : null,
    label: !priced.length ? 'kein Preis' : missing.length ? 'ab' : 'exakt', missing,
  }
}

/** "ab €2,40" / "€2,40" / "kein Preis" */
export function priceLabel(p: RecipePrice): string {
  if (p.perServing == null) return 'kein Preis'
  const eur = `€${p.perServing.toFixed(2).replace('.', ',')}`
  return p.label === 'ab' ? `ab ${eur}` : eur
}

const round = (n: number) => Math.round(n * 100) / 100
