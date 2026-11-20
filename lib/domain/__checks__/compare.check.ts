// Run: node --experimental-strip-types lib/domain/__checks__/compare.check.ts
import assert from 'node:assert/strict'
import { bestOffer, parseAmount, dealTotal, stickerSaving, type ShelfOffer, type Shopper } from '../compare.ts'

const base = { seals: [], availability: 'branch', seenAt: '2026-11-20', source: 'test' } as const
const o = (x: Partial<ShelfOffer> & Pick<ShelfOffer, 'retailer' | 'brand' | 'pack' | 'price'>): ShelfOffer =>
  ({ productName: 'x', ...base, ...x } as ShelfOffer)
const me: Shopper = { programs: [] }

// amounts
assert.deepEqual(parseAmount('0,5 l'), { value: 0.5, unit: 'l' })
assert.deepEqual(parseAmount('500 g'), { value: 0.5, unit: 'kg' })
assert.deepEqual(parseAmount('6 Stk'), { value: 6, unit: 'stk' })

// 6 Eier asked: the cheaper-per-egg 10-pack must not count
const eggs = [
  o({ retailer: 'hofer', brand: 'Zurück zum Ursprung', pack: { value: 10, unit: 'stk' }, price: 3.29 }),
  o({ retailer: 'billa', brand: 'Clever', pack: { value: 6, unit: 'stk' }, price: 2.49 }),
  o({ retailer: 'spar', brand: 'S-Budget', pack: { value: 6, unit: 'stk' }, price: 2.29 }),
]
assert.equal(bestOffer({ query: 'Eier', qty: 1, amount: { value: 6, unit: 'stk' } }, eggs, me).best?.offer.retailer, 'spar')
// no amount: cheapest per egg wins (0.329 vs 0.38)
assert.equal(bestOffer({ query: 'Eier', qty: 1 }, eggs, me).best?.offer.retailer, 'hofer')

// Multivitamin 0,5 l named: 1 l pack ignored
const juice = [
  o({ retailer: 'lidl', brand: 'Solevita', pack: { value: 1, unit: 'l' }, price: 1.19 }),
  o({ retailer: 'billa', brand: 'Rauch', pack: { value: 0.5, unit: 'l' }, price: 1.49 }),
]
assert.equal(bestOffer({ query: 'Multivitamin', qty: 1, amount: { value: 0.5, unit: 'l' } }, juice, me).best?.offer.retailer, 'billa')

// pinned brand
const pasta = [
  o({ retailer: 'hofer', brand: 'Cucina Nobile', pack: { value: 0.5, unit: 'kg' }, price: 0.79 }),
  o({ retailer: 'spar', brand: 'Rummo', pack: { value: 0.5, unit: 'kg' }, price: 2.49 }),
]
assert.equal(bestOffer({ query: 'Spaghetti', qty: 1, pinnedBrand: 'rummo' }, pasta, me).best?.offer.brand, 'Rummo')

// seals
const milk = [
  o({ retailer: 'hofer', brand: 'Milfina', pack: { value: 1, unit: 'l' }, price: 1.19 }),
  o({ retailer: 'billa', brand: 'Ja! Natürlich', pack: { value: 1, unit: 'l' }, price: 1.69, seals: ['eu-bio', 'ama-bio'] }),
]
assert.equal(bestOffer({ query: 'Milch', qty: 1, requiredSeals: ['eu-bio'] }, milk, me).best?.offer.retailer, 'billa')

// deals: 1+1 and hint
assert.equal(dealTotal(2, 2, { kind: 'buy-pay', buy: 2, pay: 1 }), 2)
const deal = bestOffer({ query: 'Kaffee', qty: 1, amount: { value: 0.5, unit: 'kg' } },
  [o({ retailer: 'spar', brand: 'Tchibo', pack: { value: 0.5, unit: 'kg' }, price: 6.99, deal: { kind: 'buy-pay', buy: 2, pay: 1 } })], me).best!
assert.match(deal.hint!, /2 Packungen kosten gleich viel/)

// loyalty only if member
const lp = [o({ retailer: 'billa', brand: 'X', pack: { value: 1, unit: 'kg' }, price: 3, loyalty: { program: 'joe', price: 2.5 } })]
assert.equal(bestOffer({ query: 'x', qty: 1 }, lp, me).best?.total, 3)
assert.equal(bestOffer({ query: 'x', qty: 1 }, lp, { programs: ['joe'] }).best?.total, 2.5)

// picked shop with unconfirmed stock is rejected
const u = [o({ retailer: 'billa', brand: 'X', pack: { value: 1, unit: 'kg' }, price: 1, availability: 'unknown' })]
assert.equal(bestOffer({ query: 'x', qty: 1 }, u, { programs: [], pickedRetailers: ['billa'] }).best, null)

// stickers: largest lines first, only as many as owned
const s = stickerSaving([deal, { ...deal, total: 10, offer: { ...deal.offer, stickerEligible: true } }], 25, 1)
assert.deepEqual(s, { saved: 2.5, used: 1 })

console.log('compare: alle Prüfungen bestanden')
