/**
 * Daily price log: where something cost how much on which day, and why it changed.
 *
 * Storage: one append-only file per day, `data/prices/YYYY-MM-DD.jsonl`, one
 * `Observation` per line. Nothing is ever overwritten, so any past day can be
 * reconstructed and every price the app shows can be traced to its source.
 *
 * Schedule:
 * - daily: prices, promotions, loyalty prices, stickers (`Observation`)
 * - monthly: full assortment and branch list (`AssortmentSnapshot`), to see new
 *   and delisted products and opened or closed branches.
 */

import type { Amount, Deal, Seal } from './compare.ts'

export type Observation = {
  date: string // YYYY-MM-DD
  retailer: string
  /** the retailer's own article number, stable across days */
  sku: string
  name: string
  brand: string
  pack: Amount
  price: number
  /** regular price, if the retailer shows a crossed-out one */
  wasPrice?: number
  /** the retailer's own label for the promotion, verbatim ("-25% auf alle Ja! Natürlich Produkte") */
  promoText?: string
  promoFrom?: string
  promoUntil?: string
  /** "ab 24 Flaschen": promo price only from this many packs */
  minQty?: number
  /** the retailer's own price per kg / l / piece, as shown */
  unitPrice?: { price: number; per: Amount }
  deal?: Deal
  loyaltyPrice?: number
  seals: Seal[]
  /** VAT rate the retailer applies, in percent, if known (10 or 20 for food/non-food in Austria) */
  vatPct?: number
  source: string
}

export type AssortmentSnapshot = {
  month: string // YYYY-MM
  retailer: string
  skus: string[]
  branches: { id: string; name: string; address: string; lat: number; lon: number }[]
}

export type Reason =
  | { kind: 'promotion'; text: string; until?: string }
  | { kind: 'multi-buy'; text: string }
  | { kind: 'promotion-ended' }
  | { kind: 'chain-campaign'; text: string; share: number }
  | { kind: 'vat-change'; fromPct: number; toPct: number }
  | { kind: 'market-wide'; retailers: number; avgPct: number }
  | { kind: 'pack-change'; from: Amount; to: Amount }
  | { kind: 'permanent'; text: string }
  | { kind: 'unexplained' }

export type PriceChange = {
  date: string
  retailer: string
  sku: string
  name: string
  before: number
  after: number
  /** change of the price per kg / l / piece, in percent */
  unitPctChange: number
  reasons: Reason[]
}

const unitPrice = (o: Observation) => o.price / o.pack.value
const pct = (a: number, b: number) => Math.round(((b - a) / a) * 1000) / 10

/**
 * Compare two consecutive days and explain every change in unit price.
 *
 * The explanation is looked for in this order, and every match is kept:
 * 1. the retailer's own promotion label or crossed-out price,
 * 2. a multi-buy deal,
 * 3. a promotion that ran out,
 * 4. a chain-wide campaign: many articles of one brand dropping by the same
 *    percentage on the same day ("−25 % auf alle Ja! Natürlich"),
 * 5. a VAT change: the VAT rate field changed, or articles of every retailer
 *    moved by the same factor on the same day,
 * 6. the pack got bigger or smaller at the same price (shrinkflation),
 * 7. a permanent price cut the retailer advertises ("dauerhaft günstiger").
 * Anything left is marked `unexplained` for a person to look at.
 */
export function explainChanges(yesterday: Observation[], today: Observation[]): PriceChange[] {
  const prev = new Map(yesterday.map(o => [key(o), o]))
  const raw: { a: Observation; b: Observation; change: number }[] = []
  for (const b of today) {
    const a = prev.get(key(b))
    if (!a) continue
    const change = pct(unitPrice(a), unitPrice(b))
    if (Math.abs(change) >= 0.5) raw.push({ a, b, change })
  }

  // campaign detection: same retailer + brand, at least 5 articles, same % within 1 point
  const groups = new Map<string, number[]>()
  for (const r of raw) {
    const g = `${r.b.retailer}|${r.b.brand}`
    groups.set(g, [...(groups.get(g) ?? []), r.change])
  }
  // market-wide detection: same % across 3+ retailers on the same day
  const byRounded = new Map<number, Set<string>>()
  for (const r of raw) {
    const k = Math.round(r.change)
    byRounded.set(k, (byRounded.get(k) ?? new Set()).add(r.b.retailer))
  }

  return raw.map(({ a, b, change }) => {
    const reasons: Reason[] = []
    if (b.promoText || (b.wasPrice && b.wasPrice > b.price))
      reasons.push({ kind: 'promotion', text: b.promoText ?? `statt €${b.wasPrice}`, until: b.promoUntil })
    if (b.deal && !a.deal) reasons.push({ kind: 'multi-buy', text: JSON.stringify(b.deal) })
    if ((a.promoText || a.wasPrice) && !b.promoText && !b.wasPrice && change > 0) reasons.push({ kind: 'promotion-ended' })
    const same = (groups.get(`${b.retailer}|${b.brand}`) ?? []).filter(c => Math.abs(c - change) <= 1)
    if (same.length >= 5) reasons.push({ kind: 'chain-campaign', text: `${same.length} Artikel von ${b.brand} um ${change} %`, share: same.length })
    if (a.vatPct != null && b.vatPct != null && a.vatPct !== b.vatPct) reasons.push({ kind: 'vat-change', fromPct: a.vatPct, toPct: b.vatPct })
    const wide = byRounded.get(Math.round(change))
    if (wide && wide.size >= 3 && !reasons.some(r => r.kind === 'vat-change'))
      reasons.push({ kind: 'market-wide', retailers: wide.size, avgPct: change })
    if (a.pack.value !== b.pack.value || a.pack.unit !== b.pack.unit) reasons.push({ kind: 'pack-change', from: a.pack, to: b.pack })
    if (/dauerhaft|immer clever|preis gesenkt/i.test(b.promoText ?? '')) reasons.push({ kind: 'permanent', text: b.promoText! })
    if (!reasons.length) reasons.push({ kind: 'unexplained' })
    return { date: b.date, retailer: b.retailer, sku: b.sku, name: b.name, before: a.price, after: b.price, unitPctChange: change, reasons }
  })
}

/** Monthly check: what was added or delisted, which branches opened or closed. */
export function diffAssortment(before: AssortmentSnapshot, after: AssortmentSnapshot) {
  const had = new Set(before.skus), has = new Set(after.skus)
  const hadB = new Set(before.branches.map(b => b.id)), hasB = new Set(after.branches.map(b => b.id))
  return {
    newSkus: after.skus.filter(s => !had.has(s)),
    delistedSkus: before.skus.filter(s => !has.has(s)),
    openedBranches: after.branches.filter(b => !hadB.has(b.id)),
    closedBranches: before.branches.filter(b => !hasB.has(b.id)),
  }
}

/** Plausibility gate before anything is shown in the app. */
export function suspicious(a: Observation, b: Observation): string | null {
  const c = pct(unitPrice(a), unitPrice(b))
  if (Math.abs(c) > 50 && !b.promoText && !b.wasPrice) return `Preis um ${c} % geändert ohne Aktionskennzeichen`
  if (b.price <= 0) return 'Preis 0 oder negativ'
  return null
}

/**
 * Chains that publish only promotions (Lidl, PENNY) show the regular price as the
 * crossed-out price while an article is on offer. Remember the last one seen, so
 * the article can still be compared later, marked "Normalpreis zuletzt gesehen am …".
 */
export function lastRegularPrice(history: Observation[], retailer: string, sku: string): { price: number; seenOn: string } | null {
  const seen = history
    .filter(o => o.retailer === retailer && o.sku === sku)
    .map(o => ({ price: o.wasPrice ?? (o.promoText ? undefined : o.price), seenOn: o.date }))
    .filter((x): x is { price: number; seenOn: string } => x.price != null)
    .sort((a, b) => b.seenOn.localeCompare(a.seenOn))
  return seen[0] ?? null
}

/** Price history is internal for now: analysis and plausibility, not shown to shoppers. */
export const HISTORY_VISIBLE_TO_USERS = false

const key = (o: Observation) => `${o.retailer}|${o.sku}`
