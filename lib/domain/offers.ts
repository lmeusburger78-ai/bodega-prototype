/**
 * Promotions with their validity and fine print, so prices can be shown for any
 * day of the current week ("am Donnerstag schon die Preise für Samstag").
 *
 * Source: the chains' online offers and their flyers (Flugblätter). Flyers are
 * read when they appear, usually a few days before they start; every promotion
 * keeps the flyer page it came from, so its fine print can be checked by a
 * person before it goes live (`reviewed`).
 */

export type Restriction =
  /** "nur mit jö / Lidl Plus" */
  | { kind: 'loyalty'; program: string }
  /** "max. 3 Stück pro Einkauf" */
  | { kind: 'max-qty'; qty: number }
  /** "nur in Filialen mit Feinkosttheke", "nicht in Bahnhofsfilialen" */
  | { kind: 'branches'; include?: string[]; exclude?: string[]; text: string }
  /** "nur Freitag und Samstag" */
  | { kind: 'weekdays'; days: number[] }
  /** "ausgenommen bereits reduzierte Ware, Tabak, Pfand, Gutscheinkarten" */
  | { kind: 'excludes'; text: string }
  /** "solange der Vorrat reicht" */
  | { kind: 'while-stocks-last' }
  /** anything else, kept verbatim */
  | { kind: 'other'; text: string }

export type Promotion = {
  id: string
  chain: string
  /** article numbers it applies to; empty with `scope` for "−25 % auf alle Ja! Natürlich" */
  skus: string[]
  scope?: { brand?: string; category?: string }
  /** fixed promo price per pack … */
  price?: number
  /** … or percentage off the regular price */
  pct?: number
  /** multi-buy, counted only when the cart quantity meets it */
  deal?: { kind: 'buy-pay'; buy: number; pay: number } | { kind: 'pct-from'; from: number; pct: number }
  validFrom: string // YYYY-MM-DD, inclusive
  validTo: string // YYYY-MM-DD, inclusive
  restrictions: Restriction[]
  /** verbatim fine print from the flyer or website */
  finePrint: string
  source: { kind: 'flyer' | 'website' | 'app'; url: string; page?: number }
  /** a person checked price, dates and fine print against the source */
  reviewed: boolean
}

/** Prices can be looked at for today up to the end of the current week (Sunday). */
export function selectableDays(today: Date): string[] {
  const out: string[] = []
  const d = new Date(today)
  do { out.push(iso(d)); d.setDate(d.getDate() + 1) } while (d.getDay() !== 1)
  return out
}

export type PriceOnDay = {
  regular: number
  /** what the shelf will show that day, before multi-buy deals */
  price: number
  promotion?: Promotion
  /** restrictions the shopper has to know about */
  conditions: string[]
  /** promotion not yet checked by a person: shown, but marked */
  unreviewed: boolean
  /** a future day: the price is a forecast from the announced promotions */
  forecast: boolean
}

/**
 * The price of one article on one day: the regular price unless a promotion is
 * valid that day at this branch and its conditions are met. Promotions for
 * future days count only if they are announced (flyer or website); anything
 * else is assumed to stay at today's price.
 */
export function priceOn(
  sku: string, brand: string, regular: number, chain: string, branchId: string,
  day: string, today: string, promos: Promotion[], programs: string[],
): PriceOnDay {
  const weekday = new Date(day + 'T12:00:00').getDay()
  const conditions: string[] = []
  const valid = promos.filter(p => p.chain === chain
    && day >= p.validFrom && day <= p.validTo
    && (p.skus.includes(sku) || (!p.skus.length && p.scope?.brand === brand))
    && p.restrictions.every(r => {
      if (r.kind === 'weekdays') return r.days.includes(weekday)
      if (r.kind === 'branches') return (!r.include || r.include.includes(branchId)) && !r.exclude?.includes(branchId)
      if (r.kind === 'loyalty') return programs.includes(r.program)
      return true
    }))
  const priced = valid.map(p => ({ p, price: p.price ?? (p.pct != null ? round(regular * (1 - p.pct / 100)) : regular) }))
    .sort((a, b) => a.price - b.price)
  const best = priced[0]
  if (best) for (const r of best.p.restrictions) {
    if (r.kind === 'max-qty') conditions.push(`max. ${r.qty} Stück pro Einkauf`)
    if (r.kind === 'while-stocks-last') conditions.push('solange der Vorrat reicht')
    if (r.kind === 'excludes' || r.kind === 'other' || r.kind === 'branches') conditions.push(r.text)
    if (r.kind === 'loyalty') conditions.push(`nur mit ${r.program}`)
  }
  return {
    regular,
    price: best ? Math.min(best.price, regular) : regular,
    promotion: best?.p,
    conditions,
    unreviewed: !!best && !best.p.reviewed,
    forecast: day > today,
  }
}

/** Promotion plausibility: things that are wrong more often than they are true. */
export function promoProblems(p: Promotion, regular?: number): string[] {
  const out: string[] = []
  if (p.validTo < p.validFrom) out.push('Ende vor Beginn')
  if (p.price != null && regular != null && p.price >= regular) out.push('Aktionspreis nicht unter Normalpreis')
  if (p.pct != null && (p.pct <= 0 || p.pct >= 90)) out.push(`Rabatt ${p.pct} % unplausibel`)
  if (p.price == null && p.pct == null && !p.deal) out.push('weder Preis, Prozent noch Mengenaktion')
  if (!p.finePrint.trim()) out.push('Kleingedrucktes fehlt: Quelle prüfen')
  if (!p.skus.length && !p.scope) out.push('keine Artikel zugeordnet')
  return out
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const round = (n: number) => Math.round(n * 100) / 100
