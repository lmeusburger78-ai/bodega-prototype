/**
 * Which offer answers a shopping-list line, and what it really costs.
 *
 * Rules agreed for the prototype:
 *
 * - Prices are compared by a comparable unit (per kg, per l, per piece).
 * - If the shopper names an amount ("6 Eier", "Multivitamin 0,5 l") only packs of
 *   exactly that size count. A 10-pack is never compared with a 6-pack.
 * - If no amount is named, the offer with the lowest price per unit wins.
 * - A pinned brand ("Rummo") excludes all other brands; no brand means cheapest.
 * - Quality seals (Bio, AMA, Demeter …) can be required per line or for the
 *   whole basket; offers without them drop out.
 * - Multi-buy deals (1+1, −25 % ab 2 Stk) are applied when the quantity
 *   qualifies, and produce a hint when one more pack would qualify.
 * - Loyalty prices (jö, Lidl Plus, Spar-App …) count only if the shopper has
 *   that programme. Sticker promotions are never applied without asking.
 * - A shop the shopper picked explicitly must show the item as available.
 */

export type Unit = 'kg' | 'l' | 'stk'

/** An amount in its base unit: kilograms, litres or pieces. */
export type Amount = { value: number; unit: Unit }

export type Seal =
  | 'eu-bio' | 'bio-austria' | 'demeter' | 'ama-guetesiegel' | 'ama-bio'
  | 'fair-zum-tier' | 'tierschutz-kontrolliert' | 'fairtrade' | 'msc' | 'asc'
  | 'ohne-gentechnik' | 'regional'

export const SEAL_LABELS: Record<Seal, string> = {
  'eu-bio': 'Bio (EU)',
  'bio-austria': 'Bio Austria',
  demeter: 'Demeter',
  'ama-guetesiegel': 'AMA-Gütesiegel',
  'ama-bio': 'AMA-Biosiegel',
  'fair-zum-tier': 'Fair zum Tier',
  'tierschutz-kontrolliert': 'Tierschutz kontrolliert',
  fairtrade: 'Fairtrade',
  msc: 'MSC',
  asc: 'ASC',
  'ohne-gentechnik': 'Ohne Gentechnik',
  regional: 'Regional',
}

export type LoyaltyProgram = 'joe' | 'spar-app' | 'lidl-plus' | 'hofer-app' | 'penny-app' | 'mpreis-app' | 'dm-app' | 'bipa-app'

export type Deal =
  /** buy `buy`, pay for `pay` (1+1 gratis: buy 2, pay 1) */
  | { kind: 'buy-pay'; buy: number; pay: number }
  /** percentage off every pack once at least `from` packs are bought */
  | { kind: 'pct-from'; from: number; pct: number }
  /** from `from` packs on, every pack costs `price` ("ab 2 Packungen je 2,69 €") */
  | { kind: 'price-from'; from: number; price: number }

/** Where the availability claim comes from: the branch itself, the online shop, or nobody. */
export type Availability = 'branch' | 'online' | 'unknown' | 'out'

export type ShelfOffer = {
  retailer: string
  productName: string
  brand: string
  /** contents of one pack */
  pack: Amount
  /** shelf price per pack, today's promotion included */
  price: number
  wasPrice?: number
  seals: Seal[]
  deal?: Deal
  loyalty?: { program: LoyaltyProgram; price: number }
  /** the sticker promotion ("Rabattmarkerl") can be used on this article */
  stickerEligible?: boolean
  availability: Availability
  /** when this price was read from the retailer, ISO date */
  seenAt: string
  source: string
}

export type ListLine = {
  query: string
  /** catalogue key when the line comes from a recipe (data/recipes.json) */
  productKey?: string
  /** packs wanted when an amount is named, otherwise how many base units (e.g. 2 kg) */
  qty: number
  /** exact pack size the shopper asked for, e.g. 6 Stk or 0.5 l */
  amount?: Amount
  pinnedBrand?: string
  requiredSeals?: Seal[]
}

export type Shopper = {
  programs: LoyaltyProgram[]
  /** seals required for every line */
  basketSeals?: Seal[]
  /** shops the shopper picked by hand; these must show the item as available */
  pickedRetailers?: string[]
}

export type Priced = {
  offer: ShelfOffer
  packs: number
  /** what is paid at the till, deals and eligible loyalty prices applied */
  total: number
  /** the same packs at the regular price (wasPrice, else shelf price), no deals */
  regularTotal: number
  saved: number
  /** price per kg / l / piece, for comparison and display */
  unitPrice: number
  unit: Unit
  notes: string[]
  /** "Nimm 2, zahl 1: 1 Packung mehr kostet nichts" and similar */
  hint?: string
}

/** Parse "500 g", "0,5 l", "6 Stk", "1,5kg", "750ml" into a base-unit amount. */
export function parseAmount(text: string): Amount | null {
  const m = text.trim().toLowerCase().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(kg|g|l|ml|cl|stk|stück|st|x)?$/)
  if (!m) return null
  const n = Number(m[1])
  switch (m[2]) {
    case 'kg': return { value: n, unit: 'kg' }
    case 'g': return { value: n / 1000, unit: 'kg' }
    case 'l': return { value: n, unit: 'l' }
    case 'ml': return { value: n / 1000, unit: 'l' }
    case 'cl': return { value: n / 100, unit: 'l' }
    default: return { value: n, unit: 'stk' }
  }
}

const same = (a: Amount, b: Amount) => a.unit === b.unit && Math.abs(a.value - b.value) < 1e-9

/** Price for `packs` packs after a multi-buy deal. */
export function dealTotal(price: number, packs: number, deal?: Deal): number {
  if (!deal) return round(price * packs)
  if (deal.kind === 'buy-pay') {
    const sets = Math.floor(packs / deal.buy)
    const rest = packs - sets * deal.buy
    return round((sets * deal.pay + rest) * price)
  }
  if (deal.kind === 'price-from') return round((packs >= deal.from ? Math.min(deal.price, price) : price) * packs)
  return round(price * packs * (packs >= deal.from ? 1 - deal.pct / 100 : 1))
}

export function dealLabel(deal: Deal): string {
  if (deal.kind === 'price-from') return `ab ${deal.from} Stk je ${euro(deal.price)}`
  return deal.kind === 'buy-pay'
    ? deal.buy === deal.pay + 1 && deal.pay === 1 ? '1+1 gratis' : `${deal.buy} zum Preis von ${deal.pay}`
    : `−${deal.pct} % ab ${deal.from} Stk`
}

/** Can this offer stand in for the line at all? Returns why not, or null. */
export function rejectReason(line: ListLine, offer: ShelfOffer, shopper: Shopper): string | null {
  if (offer.availability === 'out') return 'nicht verfügbar'
  if (shopper.pickedRetailers?.includes(offer.retailer) && offer.availability === 'unknown')
    return 'Verfügbarkeit in dieser Filiale nicht bestätigt'
  if (line.pinnedBrand && offer.brand.toLowerCase() !== line.pinnedBrand.toLowerCase()) return 'andere Marke'
  if (line.amount && !same(line.amount, offer.pack)) return 'andere Packungsgröße'
  if (!line.amount && line.qty && offer.pack.unit !== unitOfLine(line, offer)) return 'andere Einheit'
  const seals = [...(line.requiredSeals ?? []), ...(shopper.basketSeals ?? [])]
  const missing = seals.filter(s => !offer.seals.includes(s))
  if (missing.length) return `ohne ${missing.map(s => SEAL_LABELS[s]).join(', ')}`
  return null
}

// a line without an amount takes whatever unit the offers come in
const unitOfLine = (_line: ListLine, offer: ShelfOffer): Unit => offer.pack.unit

/** Price one offer for one line. */
export function priceOffer(line: ListLine, offer: ShelfOffer, shopper: Shopper): Priced {
  const notes: string[] = []
  const packs = line.amount ? line.qty : Math.max(1, Math.ceil(line.qty / offer.pack.value - 1e-9))
  let unitShelf = offer.price
  if (offer.loyalty && shopper.programs.includes(offer.loyalty.program) && offer.loyalty.price < unitShelf) {
    unitShelf = offer.loyalty.price
    notes.push(`Preis mit ${LOYALTY_LABELS[offer.loyalty.program]}`)
  }
  const total = dealTotal(unitShelf, packs, offer.deal)
  if (offer.deal && total < round(unitShelf * packs)) notes.push(dealLabel(offer.deal))

  let hint: string | undefined
  if (offer.deal) {
    const next = packs + 1
    const nextTotal = dealTotal(unitShelf, next, offer.deal)
    if (offer.deal.kind === 'buy-pay' && nextTotal === total)
      hint = `${dealLabel(offer.deal)}: ${next} Packungen kosten gleich viel wie ${packs}.`
    else if (offer.deal.kind === 'price-from' && packs < offer.deal.from)
      hint = `${dealLabel(offer.deal)}: ${offer.deal.from} Stück kosten ${euro(dealTotal(unitShelf, offer.deal.from, offer.deal))} statt ${euro(round(unitShelf * offer.deal.from))}.`
    else if (offer.deal.kind === 'pct-from' && next >= offer.deal.from && packs < offer.deal.from)
      hint = `${dealLabel(offer.deal)}: mit ${next} Packungen zahlst du ${euro(nextTotal)} statt ${euro(total)}.`
    else if (offer.deal.kind !== 'price-from' && packs < (offer.deal.kind === 'buy-pay' ? offer.deal.buy : offer.deal.from))
      hint = `Aktion ${dealLabel(offer.deal)} gilt erst ab ${offer.deal.kind === 'buy-pay' ? offer.deal.buy : offer.deal.from} Stück.`
  }
  if (offer.availability === 'online') notes.push('Verfügbarkeit laut Online-Shop')

  const contents = packs * offer.pack.value
  const regularTotal = round((offer.wasPrice ?? offer.price) * packs)
  return { offer, packs, total, regularTotal, saved: round(regularTotal - total), unitPrice: round(total / contents), unit: offer.pack.unit, notes, hint }
}

/**
 * The best offer for a line: exact pack size if one was named, otherwise the
 * lowest price per kg / l / piece. Ties go to the lower till total.
 */
export function bestOffer(line: ListLine, offers: ShelfOffer[], shopper: Shopper): { best: Priced | null; rejected: { offer: ShelfOffer; why: string }[] } {
  const rejected: { offer: ShelfOffer; why: string }[] = []
  const priced: Priced[] = []
  for (const o of offers) {
    const why = rejectReason(line, o, shopper)
    if (why) rejected.push({ offer: o, why })
    else priced.push(priceOffer(line, o, shopper))
  }
  priced.sort((a, b) => line.amount
    ? a.total - b.total || a.unitPrice - b.unitPrice
    : a.unitPrice - b.unitPrice || a.total - b.total)
  return { best: priced[0] ?? null, rejected }
}

/** Sticker promotion: asked for, never assumed. Returns the saving on the eligible lines. */
export function stickerSaving(lines: Priced[], pct: number, stickersOwned: number): { saved: number; used: number } {
  const eligible = lines.filter(l => l.offer.stickerEligible).sort((a, b) => b.total - a.total).slice(0, stickersOwned)
  return { saved: round(eligible.reduce((s, l) => s + l.total * pct / 100, 0)), used: eligible.length }
}

export const LOYALTY_LABELS: Record<LoyaltyProgram, string> = {
  joe: 'jö Bonus Club',
  'spar-app': 'SPAR-App',
  'lidl-plus': 'Lidl Plus',
  'hofer-app': 'HOFER-App',
  'penny-app': 'PENNY-App',
  'mpreis-app': 'MPREIS-App',
  'dm-app': 'dm-App',
  'bipa-app': 'BIPA-App',
}

const round = (n: number) => Math.round(n * 100) / 100
const euro = (n: number) => `€${n.toFixed(2).replace('.', ',')}`
