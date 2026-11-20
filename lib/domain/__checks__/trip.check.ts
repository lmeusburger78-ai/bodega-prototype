// Run: node --experimental-strip-types lib/domain/__checks__/trip.check.ts
import assert from 'node:assert/strict'
import { priceOn, selectableDays, promoProblems, type Promotion } from '../offers.ts'
import { isOpen, openLabel, mapsRoute, closedOnArrival, type Branch } from '../stores.ts'
import { savings, toggle, byStop } from '../trip.ts'
import { lastRegularPrice } from '../history.ts'

// days: Thursday 2026-11-19 → Thu..Sun
assert.deepEqual(selectableDays(new Date('2026-11-19T10:00:00')), ['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'])

const promo: Promotion = {
  id: 'p1', chain: 'billa', skus: ['milk'], price: 0.99, validFrom: '2026-11-21', validTo: '2026-11-21',
  restrictions: [{ kind: 'weekdays', days: [6] }, { kind: 'max-qty', qty: 3 }, { kind: 'branches', exclude: ['b-bahnhof'], text: 'nicht in Bahnhofsfilialen' }],
  finePrint: 'Nur am Samstag. Max. 3 Stk. Nicht in Bahnhofsfilialen.', source: { kind: 'flyer', url: 'x', page: 2 }, reviewed: false,
}
// Thursday looking at Saturday: forecast with the promo and its fine print
const sat = priceOn('milk', 'X', 1.49, 'billa', 'b1', '2026-11-21', '2026-11-19', [promo], [])
assert.equal(sat.price, 0.99); assert.ok(sat.forecast); assert.ok(sat.unreviewed)
assert.ok(sat.conditions.includes('max. 3 Stück pro Einkauf'))
// Friday: no promo
assert.equal(priceOn('milk', 'X', 1.49, 'billa', 'b1', '2026-11-20', '2026-11-19', [promo], []).price, 1.49)
// excluded branch
assert.equal(priceOn('milk', 'X', 1.49, 'billa', 'b-bahnhof', '2026-11-21', '2026-11-19', [promo], []).price, 1.49)
// brand-wide percent, loyalty only
const jn: Promotion = { ...promo, id: 'p2', skus: [], scope: { brand: 'Ja! Natürlich' }, price: undefined, pct: 25,
  validFrom: '2026-11-19', validTo: '2026-11-25', restrictions: [{ kind: 'loyalty', program: 'jö' }] }
assert.equal(priceOn('a', 'Ja! Natürlich', 2, 'billa', 'b1', '2026-11-20', '2026-11-19', [jn], []).price, 2)
assert.equal(priceOn('a', 'Ja! Natürlich', 2, 'billa', 'b1', '2026-11-20', '2026-11-19', [jn], ['jö']).price, 1.5)
assert.deepEqual(promoProblems({ ...promo, price: 2 }, 1.49), ['Aktionspreis nicht unter Normalpreis'])

// Penny: "0,69 ab 24 Flaschen" – with fewer in the cart the regular price stays
const beer: Promotion = { id: 'p3', chain: 'penny', skus: ['beer'], price: 0.69, validFrom: '2026-11-19', validTo: '2026-11-25',
  restrictions: [{ kind: 'min-qty', qty: 24 }], finePrint: 'ab 24 Flaschen', source: { kind: 'website', url: 'x' }, reviewed: true }
const few = priceOn('beer', 'Ottakringer', 0.89, 'penny', 'b1', '2026-11-20', '2026-11-19', [beer], [], 6)
assert.equal(few.price, 0.89); assert.ok(few.conditions.includes('Aktionspreis gilt erst ab 24 Stück'))
const many = priceOn('beer', 'Ottakringer', 0.89, 'penny', 'b1', '2026-11-20', '2026-11-19', [beer], [], 24)
assert.equal(many.price, 0.69); assert.ok(many.conditions.includes('gilt ab 24 Stück'))

// opening hours
const b: Branch = { id: 'b1', chain: 'billa', name: 'BILLA Testgasse', street: 'Testgasse 1', zip: '1010', city: 'Wien', lat: 48.2, lon: 16.37,
  hours: { 6: [{ open: '07:15', close: '18:00' }] }, closedOn: ['2026-12-08'], checkedAt: '2026-11-01' }
assert.ok(isOpen(b, new Date('2026-11-21T10:00:00')))
assert.equal(openLabel(b, new Date('2026-11-21T06:00:00')), 'öffnet um 07:15')
assert.equal(openLabel(b, new Date('2026-11-22T10:00:00')), 'heute geschlossen')
assert.ok(mapsRoute({ lat: 48.21, lon: 16.36 }, [b]).startsWith('https://www.google.com/maps/dir/?api=1'))
assert.equal(closedOnArrival({ lat: 48.21, lon: 16.36 }, [b], new Date('2026-11-21T17:55:00')).length, 1)

// trip: tick off, savings
let t = { date: '2026-11-21', lines: [
  { id: '1', name: 'Milch', branchId: 'b1', packs: 2, regular: 1.49, paid: 1.98, why: 'Samstagsaktion', done: false },
  { id: '2', name: 'Brot', branchId: 'b1', packs: 1, regular: 2.5, paid: 2.5, done: false },
] }
t = toggle(t, '1')
assert.equal(byStop(t, ['b1'])[0].open, 1)
assert.deepEqual(savings(t).saved, 1); assert.equal(savings(t).regular, 5.48)

// last regular price from a crossed-out price
assert.deepEqual(lastRegularPrice([
  { date: '2026-11-10', retailer: 'lidl', sku: 's', name: 'n', brand: 'b', pack: { value: 1, unit: 'l' }, price: 0.89, wasPrice: 1.19, promoText: '-25%', seals: [], source: 'x' },
], 'lidl', 's'), { price: 1.19, seenOn: '2026-11-10' })

console.log('trip/offers/stores: alle Prüfungen bestanden')
