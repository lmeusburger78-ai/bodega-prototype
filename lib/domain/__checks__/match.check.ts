// Run: node --experimental-strip-types lib/domain/__checks__/match.check.ts
// Names and packs are real, from the prices of 20.11.2026.
import assert from 'node:assert/strict'
import { matchAll, buildLexicon, groupIdentical, applyDecisions, fold, type Match } from '../../match/match.ts'
import type { Observation } from '../history.ts'

let n = 0
const o = (retailer: string, brand: string, name: string, value: number, unit: 'kg' | 'l' | 'stk', extra: Partial<Observation> = {}): Observation =>
  ({ date: '2026-11-20', retailer, sku: `${retailer}:${n++}`, name, brand, pack: { value, unit }, price: 1, seals: [], source: 't', ...extra })
const rel = (a: Observation, b: Observation, lexFrom: Observation[] = [a, b]): Match | undefined =>
  matchAll([a, b], buildLexicon(lexFrom))[0]

assert.equal(fold('Ja! Natürlich'), 'ja naturlich')

// identical and sure: Billa has no brand field, the brand is learned from the other chain
let m = rel(o('billa', '', 'Rapso Reines Rapsöl', 0.75, 'l'), o('penny', 'Rapso', 'Reines Rapsöl', 0.75, 'l'))!
assert.deepEqual([m.relation, m.review], ['identical', false])
m = rel(o('billa', '', 'Lattella Maracuja', 0.5, 'l'), o('mpreis', 'Lattella', 'Maracuja 0,5 Liter', 0.5, 'l'))!
assert.deepEqual([m.relation, m.review], ['identical', false])

// variants go to review, never straight in
m = rel(o('billa', '', 'Knorr Asia Noodles Huhn', 0.07, 'kg'), o('penny', 'Knorr', 'Asia Noodles', 0.07, 'kg'))!
assert.deepEqual([m.relation, m.review], ['identical', true])
m = rel(o('billa', '', 'Soletti Sesam-Salzstangerl', 0.23, 'kg'), o('penny', 'Soletti', 'Salzstangerl', 0.23, 'kg'))!
assert.equal(m.review, true)

// different pack: never identical
m = rel(o('billa', '', 'Rapso Reines Rapsöl', 1, 'l'), o('penny', 'Rapso', 'Reines Rapsöl', 0.75, 'l'))
assert.notEqual(m?.relation, 'identical')
// different brands, same name: not identical
m = rel(o('billa', 'Rauch', 'Multivitamin', 0.5, 'l'), o('penny', 'Pfanner', 'Multivitamin', 0.5, 'l'))
assert.notEqual(m?.relation, 'identical')

// organic never meets non-organic
assert.equal(rel(o('billa', 'Ja! Natürlich', 'Ja! Natürlich Cottage Cheese Natur', 0.2, 'kg'), o('penny', 'Nöm', 'Cottage Cheese', 0.2, 'kg')), undefined)
assert.equal(rel(o('billa', '', 'Bio Milch', 1, 'l'), o('penny', '', 'Milch', 1, 'l')), undefined)

// private labels: comparable, never identical
m = rel(o('billa', 'Clever', 'Clever Birnen', 1, 'kg'), o('mpreis', '', 'Birnen Tasse', 1, 'kg'))!
assert.equal(m.relation, 'comparable')
m = rel(o('billa', 'BILLA', 'BILLA Satsumas', 1, 'kg'), o('penny', 'Clever', 'Satsumas', 1, 'kg'))!
assert.equal(m.relation, 'comparable')

// barcodes decide, when both sides have one
m = rel(o('dm', 'X', 'Name A', 1, 'stk', { ean: '4262459494441' }), o('billa', 'Y', 'Ganz anders', 2, 'stk', { ean: '4262459494441' }))!
assert.deepEqual([m.relation, m.score], ['identical', 1])
assert.equal(rel(o('dm', 'X', 'Gleicher Name', 1, 'stk', { ean: '1111111111111' }), o('billa', 'X', 'Gleicher Name', 1, 'stk', { ean: '2222222222222' })), undefined)

// same chain is never matched with itself
assert.equal(rel(o('billa', 'Knorr', 'Nudelsuppe', 1, 'kg'), o('billa', 'Knorr', 'Nudelsuppe', 1, 'kg')), undefined)

// groups: one article per chain, review pairs stay out
const a = o('billa', '', 'Rapso Reines Rapsöl', 0.75, 'l'), b = o('penny', 'Rapso', 'Reines Rapsöl', 0.75, 'l'), c = o('mpreis', 'Rapso', 'Reines Rapsöl', 0.75, 'l')
const all = matchAll([a, b, c])
assert.equal(groupIdentical(all).length, 1); assert.equal(groupIdentical(all)[0].length, 3)

// a person's verdict wins
const x = matchAll([o('billa', '', 'Knorr Asia Noodles Huhn', 0.07, 'kg'), o('penny', 'Knorr', 'Asia Noodles', 0.07, 'kg')], new Set(['knorr']))
assert.equal(x[0].review, true)
const same = applyDecisions(x, [{ a: x[0].a.sku, b: x[0].b.sku, verdict: 'same' }]); assert.equal(same[0].review, false)
assert.equal(applyDecisions(x, [{ a: x[0].b.sku, b: x[0].a.sku, verdict: 'different' }]).length, 0)

console.log('match: alle Prüfungen bestanden')
