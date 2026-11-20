/**
 * Readers for the chains whose online prices were checked directly (20.11.2026).
 * Each turns the text of a product list page into `Observation`s
 * (lib/domain/history.ts). Nothing here fetches anything; `tools/ingest.mjs`
 * loads the pages and hands the text over.
 *
 * Article numbers: none of the pages shows one in its text, so `sku` is derived
 * from retailer, brand, name and pack. It stays stable as long as the shelf label
 * does; a renamed product shows up as a new article, which the monthly check
 * catches.
 */
import type { Amount } from '../domain/compare.ts'
import type { Observation } from '../domain/history.ts'

type Ctx = { date: string; source: string }

const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'))
const PRICE = /^(\d{1,3}(?:\.\d{3})*,\d{2}) ?€$/
const clean = (s: string) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

export const sku = (retailer: string, brand: string, name: string, pack: Amount) =>
  `${retailer}:${[brand, name].join(' ').toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '')}:${pack.value}${pack.unit}`

/** "0,33 liter Flasche", "500 g Packung", "1 stk", "1kg", "Gewichtsware", "Ab 0,5 kg" → base-unit pack. */
export function packFrom(text: string): { pack: Amount; loose: boolean } | null {
  const t = clean(text).toLowerCase().replace(/(\d) (\d{3})(?!\d)/g, '$1$2') // "1 000 g"
  if (t === 'gewichtsware' || /^ab \d/.test(t)) return { pack: { value: 1, unit: 'kg' }, loose: true } // price per kg
  const multi = t.match(/^(\d+)\s?x\s?(\d+(?:[.,]\d+)?)\s?(kg|g|liter|l|ml|cl)\b/) // "4x 185 g"
  if (multi) { const one = packFrom(`${multi[2]} ${multi[3]}`); return one ? { pack: { value: one.pack.value * Number(multi[1]), unit: one.pack.unit }, loose: false } : null }
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|liter|l|ml|cl|stk|st|stück|wl)\b/) ?? t.match(/^(\d+(?:[.,]\d+)?)\s*()[a-zäöü]/)
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  switch (m[2]) {
    case 'kg': return { pack: { value: n, unit: 'kg' }, loose: false }
    case 'g': return { pack: { value: n / 1000, unit: 'kg' }, loose: false }
    case 'l': case 'liter': return { pack: { value: n, unit: 'l' }, loose: false }
    case 'ml': return { pack: { value: n / 1000, unit: 'l' }, loose: false }
    case 'cl': return { pack: { value: n / 100, unit: 'l' }, loose: false }
    default: return { pack: { value: n, unit: 'stk' }, loose: false } // pieces, tea bags, …
  }
}

/** "1 kg 19,90 €", "500 ml 1,05 €", "1 Liter 7,99 €", "1 kg = 27.90" */
function unitPriceFrom(seg: string): Observation['unitPrice'] | undefined {
  const m = clean(seg).match(/^(?:per )?(\d+(?:[.,]\d+)?) ?(kg|g|liter|l|ml|stk|st)\b(?: =)? ?(\d+[.,]\d{2})? ?€?$/i)
  if (!m || !m[3]) {
    // "1 Waschgang 0,34 €": any other unit counts as per piece / per use
    const g = clean(seg).match(/^(\d+(?:[.,]\d+)?) [A-Za-zäöü]+ (\d+[.,]\d{2}) ?€$/)
    return g ? { price: num(g[2].replace('.', ',')), per: { value: Number(g[1].replace(',', '.')), unit: 'stk' } } : undefined
  }
  const p = packFrom(`${m[1]} ${m[2]}`)
  return p ? { price: num(m[3].replace('.', ',')), per: p.pack } : undefined
}

const DAY = /(\d\d)\.(\d\d)\.(\d{4})/
const iso = (d: RegExpMatchArray) => `${d[3]}-${d[2]}-${d[1]}`

// ---------------------------------------------------------------- BILLA / PENNY
// Both run on the same shop software; one card = the text segments of one tile.

export function splitWsCards(html: string): string[][] {
  const s = html.replace(/<!--.*?-->/gs, '')
  return s.split('class="ws-product-title').slice(1).map(part => {
    const body = part.slice(part.indexOf('>') + 1, part.indexOf('>') + 2600)
    return body.replace(/<[^>]+>/g, '|').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'")
      .split('|').map(clean).filter(Boolean)
  })
}

export function parseWsCard(seg: string[], retailer: 'billa' | 'penny', ctx: Ctx): Observation | null {
  const [rawTitle, ...rest] = seg
  if (!rawTitle) return null
  const title = rawTitle.replace(/[*¹²³]+/g, '').replace(/\s+/g, ' ').trim() // footnote marks
  let name = title, brand = ''
  const dot = title.split(' • ')
  if (dot.length === 2) { name = dot[0]; brand = dot[1] }
  else if (retailer === 'billa') brand = /^(Ja! Natürlich|BILLA|Clever|Zurück zum Ursprung)/.exec(title)?.[1] ?? ''

  let pack: ReturnType<typeof packFrom> = null, from: string | undefined, to: string | undefined, minQty: number | undefined
  const prices: number[] = []
  let unit: Observation['unitPrice'] | undefined, deal: { from: number; price: number } | undefined, pending: number | undefined
  for (let i = 0; i < rest.length; i++) {
    const r = rest[i], pm = r.match(PRICE)
    if (/^(Einzelpreis|Einweg|Mehrweg)$/i.test(r)) continue
    if (pm) { if (pending && !deal) { deal = { from: pending, price: num(pm[1]) }; continue } if (!deal) prices.push(num(pm[1])); continue }
    if (prices.length === 0) {
      if (!pack) { const p = packFrom(r); if (p) { pack = p; continue } }
      const f = r.match(/^von \S+ (\d\d\.\d\d\.\d{4})/), t = r.match(/^bis \S+ (\d\d\.\d\d\.\d{4})/)
      if (f) { from = iso(f[1].match(DAY)!); continue }
      if (t) { to = iso(t[1].match(DAY)!); continue }
      const q = r.match(/^ab (\d+) /i); if (q) { minQty = Number(q[1]); continue }
      continue
    }
    if (/^\d{1,2}$/.test(r) || /^\d{2} ?€$/.test(r)) continue // superscript cents of the same price
    // Billa multi-buy: "ab 2 Packungen" / "Bei 3 Stk je", followed by the price per pack
    const dm = r.match(/^(?:ab|Bei) (\d+) [^\d]*$/i)
    if (dm && !deal) { pending = Number(dm[1]); continue }
    const up = unitPriceFrom(r)
    if (deal) break // the unit price of the multi-buy price ends the tile
    if (!unit && up) { unit = up; continue }
    break // anything else belongs to the next tile
  }
  if (!prices.length || !pack) return null
  if (unit && Math.abs(unit.price - prices[0]) < 0.005 && (unit.per.unit !== pack.pack.unit || Math.abs(unit.per.value - pack.pack.value) > 1e-9))
    pack = { pack: unit.per, loose: false } // the price is for the unit-price amount, e.g. 0,80 € per 100 g
  const price = prices[0], was = prices.find((p, i) => i > 0 && p > price)
  const loose = pack.loose
  return {
    date: ctx.date, retailer, sku: sku(retailer, brand, name, pack.pack), name, brand,
    pack: pack.pack, price, ...(was ? { wasPrice: was } : {}),
    ...(from ? { promoFrom: from } : {}), ...(to ? { promoUntil: to } : {}), ...(minQty ? { minQty } : {}),
    ...(deal && deal.price < price ? { deal: { kind: 'price-from' as const, from: deal.from, price: deal.price } } : {}),
    ...(unit ? { unitPrice: unit } : loose ? { unitPrice: { price, per: { value: 1, unit: 'kg' as const } } } : {}),
    seals: /\bBio\b/.test(title) ? ['eu-bio'] : [], source: ctx.source,
  }
}

// ---------------------------------------------------------------- Lidl (browser text)

export function parseLidlText(text: string, ctx: Ctx): Observation[] {
  const L = text.split('\n').map(clean).filter(Boolean), out: Observation[] = []
  const year = Number(ctx.date.slice(0, 4))
  for (let i = 0; i < L.length; i++) {
    const pm = L[i].match(/^(\d+\.\d{2})€\*?$/)
    if (!pm) continue
    // layout: "<Name> für 2.79 EUR", brand, name, [badge], price, "Je 100 g", "1 kg = 27.90", "in der Filiale von 17.12. - 19.12."
    let t = i - 1
    while (t >= 0 && i - t <= 5 && !/ für \d+\.\d{2} EUR$/.test(L[t])) t--
    if (t < 0 || i - t > 5) continue
    const name = L[t].replace(/ für \d+\.\d{2} EUR$/, ''), brand = L[t + 1] && L[t + 1] !== name ? L[t + 1] : ''
    const je = L[i + 1]?.match(/^Je (.+)$/), pack = je ? packFrom(je[1]) : null
    if (!pack) continue
    const up = unitPriceFrom(L[i + 2] ?? '')
    const when = (L[i + 3] ?? '').match(/(\d\d)\.(\d\d)\. - (\d\d)\.(\d\d)\./)
    const a = when ? `${year}-${when[2]}-${when[1]}` : undefined
    const bYear = when && Number(when[4]) < Number(when[2]) ? year + 1 : year
    const b = when ? `${bYear}-${when[4]}-${when[3]}` : undefined
    out.push({
      date: ctx.date, retailer: 'lidl', sku: sku('lidl', brand, name, pack.pack), name, brand,
      pack: pack.pack, price: Number(pm[1]),
      ...(a ? { promoFrom: a } : {}), ...(b ? { promoUntil: b } : {}),
      ...(up ? { unitPrice: up } : {}), seals: [], source: ctx.source,
    })
  }
  return out
}

// ---------------------------------------------------------------- MPREIS (browser text)

export function parseMpreisText(text: string, ctx: Ctx): Observation[] {
  const L = text.split('\n').map(clean).filter(Boolean), out: Observation[] = []
  let start = 0
  for (let i = 0; i < L.length; i++) {
    if (!/^Verfügbarkeit in deinem Markt prüfen$/i.test(L[i])) continue
    const card = L.slice(start, i); start = i + 1
    const pi = card.findIndex(l => /^gewichtsware$/i.test(l) || /^\d+(?:[.,]\d+)?\s?(g|kg|ml|l|cl|stk)$/i.test(l))
    if (pi < 1) continue
    const p = packFrom(card[pi]); if (!p) continue
    const name = card[pi - 1], brand = pi >= 2 && card[pi - 2].length <= 20 ? card[pi - 2] : ''
    const after = card.slice(pi + 1)
    const promo = after.map(l => l.match(/^Aktueller Preis (\d+,\d{2}) €, statt (\d+,\d{2}) €$/)).find(Boolean)
    const plain = after.find(l => /^\d+,\d{2}$/.test(l))
    const price = promo ? num(promo[1]) : plain ? num(plain) : NaN
    if (!Number.isFinite(price)) continue
    const um = after.map(l => l.match(/^(\d+,\d{2}) € \/(?:(\d+(?:,\d+)?)\s?)?(kg|l|Stk)$/)).find(Boolean)
    const up = p.loose ? { price, per: { value: 1, unit: 'kg' as const } }
      : um ? { price: num(um[1]), per: { value: um[2] ? num(um[2]) : 1, unit: (um[3] === 'Stk' ? 'stk' : um[3]) as Amount['unit'] } } : undefined
    // MPREIS labels some kg packs "/Stk" (per pack). That is not a unit price: drop it, the price per kg is computed from the pack.
    const unitOk = up && up.per.unit === p.pack.unit && !(up.per.unit === 'stk' && Math.abs(up.price - price) < 0.005 && p.pack.value > 1) ? up : undefined
    out.push({
      date: ctx.date, retailer: 'mpreis', sku: sku('mpreis', brand, name, p.pack), name, brand, pack: p.pack, price,
      ...(promo && num(promo[2]) > price ? { wasPrice: num(promo[2]) } : {}),
      ...(after.some(l => /^Bei 2 Stk\. je$/.test(l)) ? { minQty: 2 } : {}),
      ...(unitOk ? { unitPrice: unitOk } : {}), seals: [], source: ctx.source,
    })
  }
  return out
}

// ---------------------------------------------------------------- dm (browser text)

export function parseDmText(text: string, ctx: Ctx): Observation[] {
  const out: Observation[] = []
  for (const line of text.split('\n')) {
    const m = clean(line).match(/^Marke: (.*?); Produktname: (.*?); Preis: (\d[\d.]*,\d{2}) €; Grundpreis: (.*?)(?:; |$)/)
    if (!m) continue
    const [, brand, rawName, price, grund] = m
    const parts = rawName.replace(/; Rechtliche Kategorie: .*$/, '').split(', ')
    // "Weichspüler Baby Sensitiv, 45 Wl, 900 ml": trailing parts that look like amounts are the pack, the rest is the name
    const amounts = parts.filter((x, i) => i > 0 && /^\d[\d.,]* ?(g|kg|ml|l|St|Wl)$/.test(x))
    const name = parts.filter(x => !amounts.includes(x)).join(', ')
    const measure = amounts.map(a => packFrom(a.replace(/ St$/, ' stk'))).find(p => p && p.pack.unit !== 'stk')
    const gm = grund.match(/^(.*?) \((\d[\d.]*,\d{2}) € je (.+)\)/)
    const fromGrund = gm ? packFrom(gm[1].replace(/ St$/, ' stk')) : null
    const pack = measure ?? fromGrund ?? packFrom('1 stk')
    if (!pack) continue
    const gp = gm ? packFrom(gm[3].replace(/ St$/, ' stk')) : null
    out.push({
      date: ctx.date, retailer: 'dm', sku: sku('dm', brand, name, pack.pack), name, brand, pack: pack.pack, price: num(price),
      ...(gm && gp ? { unitPrice: { price: num(gm[2]), per: gp.pack } } : {}), seals: [], source: ctx.source,
    })
  }
  return out
}

/**
 * Cross-check one reading against itself. Returns why it looks wrong, or null.
 * The retailer's own unit price must match price ÷ pack; a mismatch means the
 * page was misread or the retailer's label is wrong. Either way a person looks.
 */
export function checkObservation(o: Observation): string | null {
  if (!(o.price > 0) || o.price > 5000) return `Preis ${o.price} unplausibel`
  if (o.wasPrice != null && o.wasPrice <= o.price) return 'Streichpreis nicht über dem Aktionspreis'
  if (o.deal && o.deal.kind === 'price-from' && o.deal.price >= o.price) return 'Mengenpreis nicht unter dem Einzelpreis'
  if (o.promoFrom && o.promoUntil && o.promoUntil < o.promoFrom) return 'Aktionsende vor Beginn'
  if (o.unitPrice) {
    if (o.unitPrice.per.unit === 'stk' && o.pack.unit !== 'stk') return null // price per piece or wash load, not comparable to the pack
    if (o.unitPrice.per.unit !== o.pack.unit) return `Grundpreis in ${o.unitPrice.per.unit}, Packung in ${o.pack.unit}`
    const expected = (o.price / o.pack.value) * o.unitPrice.per.value
    // rounding of tiny unit prices (0,05 € per wipe) is not an error: allow 3 % or one cent
    if (Math.abs(expected - o.unitPrice.price) / o.unitPrice.price > 0.03 && Math.abs(expected - o.unitPrice.price) > 0.01)
      return `Grundpreis ${o.unitPrice.price} passt nicht zu ${o.price} für ${o.pack.value} ${o.pack.unit} (erwartet ${expected.toFixed(2)})`
  }
  return null
}
