// Run: node --experimental-strip-types lib/domain/__checks__/history.check.ts
import assert from 'node:assert/strict'
import { explainChanges, diffAssortment, type Observation } from '../history.ts'

const ob = (x: Partial<Observation>): Observation => ({
  date: '2026-11-19', retailer: 'billa', sku: '1', name: 'Milch', brand: 'X',
  pack: { value: 1, unit: 'l' }, price: 1, seals: [], source: 't', ...x,
})

// promotion with label
let c = explainChanges([ob({})], [ob({ date: '2026-11-20', price: 0.75, wasPrice: 1, promoText: '-25% auf alle Ja! Natürlich Produkte' })])
assert.equal(c[0].reasons[0].kind, 'promotion')

// shrinkflation: same price, smaller pack
c = explainChanges([ob({})], [ob({ pack: { value: 0.9, unit: 'l' } })])
assert.ok(c[0].reasons.some(r => r.kind === 'pack-change'))
assert.equal(c[0].unitPctChange, 11.1)

// chain-wide campaign: 5 articles of one brand -25 %
const y = [1, 2, 3, 4, 5].map(i => ob({ sku: String(i), brand: 'Ja! Natürlich', price: 2 }))
const t = [1, 2, 3, 4, 5].map(i => ob({ sku: String(i), brand: 'Ja! Natürlich', price: 1.5 }))
assert.ok(explainChanges(y, t)[0].reasons.some(r => r.kind === 'chain-campaign'))

// VAT
c = explainChanges([ob({ vatPct: 10 })], [ob({ vatPct: 5, price: 0.95 })])
assert.ok(c[0].reasons.some(r => r.kind === 'vat-change'))

// nothing found
c = explainChanges([ob({})], [ob({ price: 0.9 })])
assert.equal(c[0].reasons[0].kind, 'unexplained')

// monthly diff
const d = diffAssortment(
  { month: '2026-10', retailer: 'billa', skus: ['a', 'b'], branches: [{ id: '1', name: 'A', address: '', lat: 0, lon: 0 }] },
  { month: '2026-11', retailer: 'billa', skus: ['b', 'c'], branches: [{ id: '2', name: 'B', address: '', lat: 0, lon: 0 }] })
assert.deepEqual([d.newSkus, d.delistedSkus, d.openedBranches.length, d.closedBranches.length], [['c'], ['a'], 1, 1])

console.log('history: alle Prüfungen bestanden')
