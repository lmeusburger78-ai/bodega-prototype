// Run: node --experimental-strip-types lib/domain/__checks__/regional.check.ts
import assert from 'node:assert/strict'
import { groupKey, groups, referenceBranch, branchesToSample, compare, verdict, outliers, type Prices } from '../../ingest/regional.ts'
import type { Branch } from '../stores.ts'

const br = (id: string, region: string, type = 'Markt'): Branch =>
  ({ id, chain: 'dm', name: id, street: '', zip: '', city: '', lat: 0, lon: 0, hours: {}, checkedAt: '2026-11-20', region, type })
const many = (n: number, region: string) => Array.from({ length: n }, (_, i) => br(`${region}-${String(i).padStart(3, '0')}`, region))
const all = [...many(40, 'Steiermark'), ...many(30, 'Tirol')]

// groups by chain, type and Bundesland
assert.equal(groups(all).size, 2); assert.equal(groupKey(all[0]), 'dm|Markt|Steiermark')

// one reference per group, rotating monthly, never sampled itself
const st = groups(all).get('dm|Markt|Steiermark')!
assert.notEqual(referenceBranch(st, '2026-11').id, referenceBranch(st, '2026-12').id)
const refs = new Set([...groups(all).values()].map(l => referenceBranch(l, '2026-11').id))
for (let d = 0; d < 14; d++) assert.ok(branchesToSample(all, `2026-11-${String(d + 1).padStart(2, '0')}`, '2026-11').every(b => !refs.has(b.id)))

// every non-reference branch is visited exactly once per 14-day cycle
const seen = new Map<string, number>()
for (let d = 0; d < 14; d++) for (const b of branchesToSample(all, `2026-11-${String(d + 1).padStart(2, '0')}`, '2026-11')) seen.set(b.id, (seen.get(b.id) ?? 0) + 1)
assert.equal(seen.size, all.length - refs.size); assert.ok([...seen.values()].every(n => n === 1))
// deterministic
assert.deepEqual(branchesToSample(all, '2026-11-20', '2026-11').map(b => b.id), branchesToSample(all, '2026-11-20', '2026-11').map(b => b.id))

// comparison: same range, a few price differences
const base: Prices = new Map(Array.from({ length: 100 }, (_, i) => [`a${i}`, 1 + i / 100]))
const same: Prices = new Map([...base].slice(0, 60))
assert.equal(verdict(compare(base, same)), 'konsistent')
const off: Prices = new Map([...base].slice(0, 60).map(([k, v], i) => [k, i < 5 ? v + 0.3 : v]))
const c = compare(base, off); assert.equal(c.priceDiffs.length, 5); assert.equal(verdict(c), 'abweichend')
// rounding noise is not a difference
assert.equal(compare(new Map([['x', 1.99]]), new Map([['x', 1.994]])).priceDiffs.length, 0)
// too little to compare: say so instead of guessing
assert.equal(verdict(compare(base, new Map([...base].slice(0, 5)))), 'zu-wenig-vergleichbar')
// an article the baseline does not know is not a price difference
assert.equal(compare(base, new Map([['neu', 9.99]])).compared, 0)

// outliers: the majority price is right
const g = new Map<string, Prices>([['b1', new Map([['m', 2.49]])], ['b2', new Map([['m', 2.49]])], ['b3', new Map([['m', 2.49]])], ['b4', new Map([['m', 2.99]])]])
assert.deepEqual(outliers(g), [{ sku: 'm', majority: 2.49, branch: 'b4', price: 2.99 }])
// no clear majority: no verdict
assert.equal(outliers(new Map<string, Prices>([['b1', new Map([['m', 1]])], ['b2', new Map([['m', 2]])], ['b3', new Map([['m', 3]])]])).length, 0)
// regions may differ: each has its own baseline, so Steiermark prices are never compared with Tirol
assert.equal(groupKey(br('x', 'Tirol')) === groupKey(br('y', 'Steiermark')), false)

console.log('regional: alle Prüfungen bestanden')
