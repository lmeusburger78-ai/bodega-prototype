/**
 * Price comparison across the supermarkets around you.
 *
 * Everything here works on example prices: real prices need a feed from each
 * retailer, which the prototype does not have. `PRICES_ARE_EXAMPLES` is true so
 * every screen can say so instead of pretending the figures are live.
 */

export const PRICES_ARE_EXAMPLES = true

export type RetailerId = 'billa' | 'spar' | 'hofer' | 'penny' | 'lidl'

export type Retailer = {
  id: RetailerId
  name: string
  /** the branch the prices belong to */
  branch: string
  /** walking distance from the user, in metres */
  distanceM: number
  /** this chain runs a sticker promotion ("Rabattmarkerl") at the moment */
  stickers: boolean
}

export type Offer = {
  retailer: RetailerId
  /** what the shelf label says, per pack */
  price: number
  /** price before the current promotion, when there is one */
  wasPrice?: number
  /** the brand actually on the shelf, so a swap is visible */
  brand: string
  /** pack as sold, e.g. "1 kg", "10 Stk" */
  pack: string
  inStock: boolean
  /** the sticker promotion applies to this article */
  stickerEligible?: boolean
}

export type BasketLine = {
  productKey: string
  name: string
  qty: number
  /** the shopper insists on this brand, so cheaper brands are not offered */
  pinnedBrand?: string
}

/** One line, priced at one retailer. */
export type LinePrice = {
  line: BasketLine
  retailer: RetailerId
  offer: Offer
  /** price × quantity, promotion already applied */
  total: number
}

export type StoreStop = {
  retailer: Retailer
  lines: LinePrice[]
  total: number
}

export type RoutePlan = {
  stops: StoreStop[]
  total: number
  /** lines no retailer in range carries */
  missing: BasketLine[]
  /** metres walked, there and between the stops */
  walkM: number
  /** lines that a sticker promotion would make cheaper still */
  stickerCandidates: LinePrice[]
}

/** Offers that match the basket line: the pinned brand only, if there is one, and in stock. */
export function offersFor(line: BasketLine, offers: Offer[]): Offer[] {
  return offers.filter(o => o.inStock && (!line.pinnedBrand || o.brand === line.pinnedBrand))
}

/** The cheapest offer for one line at one retailer, or null when that shop does not carry it. */
export function offerAt(line: BasketLine, offers: Offer[], retailer: RetailerId): Offer | null {
  const here = offersFor(line, offers).filter(o => o.retailer === retailer)
  return here.sort((a, b) => a.price - b.price)[0] ?? null
}

/** Retailers within the radius the shopper chose, nearest first. */
export function inRange(retailers: Retailer[], radiusM: number): Retailer[] {
  return retailers.filter(r => r.distanceM <= radiusM).sort((a, b) => a.distanceM - b.distanceM)
}

/** What the whole basket costs at one shop. Lines it does not carry come back as missing. */
export function basketAt(
  basket: BasketLine[],
  offersByKey: Record<string, Offer[]>,
  retailer: Retailer,
): StoreStop & { missing: BasketLine[] } {
  const lines: LinePrice[] = []
  const missing: BasketLine[] = []
  for (const line of basket) {
    const offer = offerAt(line, offersByKey[line.productKey] ?? [], retailer.id)
    if (!offer) { missing.push(line); continue }
    lines.push({ line, retailer: retailer.id, offer, total: round(offer.price * line.qty) })
  }
  return { retailer, lines, total: round(lines.reduce((s, l) => s + l.total, 0)), missing }
}

/**
 * One shop for everything: the cheapest shop that carries the most of the basket.
 * A shop missing fewer items wins over a shop that is merely cheaper, because a
 * second trip costs more than the difference.
 */
export function bestSingleStore(
  basket: BasketLine[],
  offersByKey: Record<string, Offer[]>,
  retailers: Retailer[],
  radiusM: number,
): (StoreStop & { missing: BasketLine[] }) | null {
  const candidates = inRange(retailers, radiusM).map(r => basketAt(basket, offersByKey, r))
  if (!candidates.length) return null
  return candidates.sort((a, b) =>
    a.missing.length - b.missing.length || a.total - b.total || a.retailer.distanceM - b.retailer.distanceM,
  )[0]
}

/**
 * The cheapest shop per line, ignoring how far apart they are. This is the floor
 * price: no route can beat it, and the route planner measures itself against it.
 */
export function cheapestPerLine(
  basket: BasketLine[],
  offersByKey: Record<string, Offer[]>,
  retailers: Retailer[],
  radiusM: number,
): { picks: LinePrice[]; missing: BasketLine[]; total: number } {
  const reachable = new Set(inRange(retailers, radiusM).map(r => r.id))
  const picks: LinePrice[] = []
  const missing: BasketLine[] = []
  for (const line of basket) {
    const best = offersFor(line, offersByKey[line.productKey] ?? [])
      .filter(o => reachable.has(o.retailer))
      .sort((a, b) => a.price - b.price)[0]
    if (!best) { missing.push(line); continue }
    picks.push({ line, retailer: best.retailer, offer: best, total: round(best.price * line.qty) })
  }
  return { picks, missing, total: round(picks.reduce((s, l) => s + l.total, 0)) }
}

/**
 * A shopping route: at most `maxStops` shops within the radius, chosen so the
 * basket comes out as cheap as possible.
 *
 * Picking shops one at a time (each time the one that saves most on what is
 * still unbought) is not guaranteed to find the global optimum, but with a
 * handful of shops and a basket of everyday items it lands on it or within a few
 * cents, and it stays fast enough to re-run on every change to the list.
 */
export function smartRoute(
  basket: BasketLine[],
  offersByKey: Record<string, Offer[]>,
  retailers: Retailer[],
  radiusM: number,
  maxStops = 2,
): RoutePlan {
  const reachable = inRange(retailers, radiusM)
  const floor = cheapestPerLine(basket, offersByKey, retailers, radiusM)
  const buyable = floor.picks.map(p => p.line)

  const chosen: Retailer[] = []
  let open = [...buyable]

  while (chosen.length < maxStops && open.length) {
    let best: { retailer: Retailer; lines: LinePrice[] } | null = null
    for (const r of reachable) {
      if (chosen.some(c => c.id === r.id)) continue
      const { lines } = basketAt(open, offersByKey, r)
      if (!lines.length) continue
      // prefer the shop that covers most of what is left, then the cheapest, then the nearest
      if (
        !best ||
        lines.length > best.lines.length ||
        (lines.length === best.lines.length && sum(lines) < sum(best.lines)) ||
        (lines.length === best.lines.length && sum(lines) === sum(best.lines) && r.distanceM < best.retailer.distanceM)
      ) best = { retailer: r, lines }
    }
    if (!best) break
    chosen.push(best.retailer)
    const covered = new Set(best.lines.map(l => l.line.productKey))
    open = open.filter(l => !covered.has(l.productKey))
  }

  // with the shops fixed, buy each line wherever it is cheapest among them
  const stops: StoreStop[] = chosen.map(r => ({ retailer: r, lines: [], total: 0 }))
  for (const line of buyable) {
    let pick: { stop: StoreStop; offer: Offer } | null = null
    for (const stop of stops) {
      const offer = offerAt(line, offersByKey[line.productKey] ?? [], stop.retailer.id)
      if (!offer) continue
      if (!pick || offer.price < pick.offer.price) pick = { stop, offer }
    }
    if (!pick) { floor.missing.push(line); continue }
    pick.stop.lines.push({ line, retailer: pick.stop.retailer.id, offer: pick.offer, total: round(pick.offer.price * line.qty) })
  }
  for (const stop of stops) stop.total = round(sum(stop.lines))

  const used = stops.filter(s => s.lines.length)
  return {
    stops: used,
    total: round(used.reduce((s, x) => s + x.total, 0)),
    missing: floor.missing,
    walkM: used.reduce((m, s) => m + s.retailer.distanceM, 0) * 2,
    stickerCandidates: used.flatMap(s => s.lines.filter(l => l.offer.stickerEligible)),
  }
}

/**
 * What the sticker promotion would take off, once the shopper confirms they
 * actually have the stickers. Never applied on its own: the app asks first.
 */
export function withStickers(plan: RoutePlan, discountPct: number): { total: number; saved: number } {
  const eligible = sum(plan.stickerCandidates)
  const saved = round(eligible * (discountPct / 100))
  return { total: round(plan.total - saved), saved }
}

const sum = (lines: LinePrice[]) => lines.reduce((s, l) => s + l.total, 0)
const round = (n: number) => Math.round(n * 100) / 100
