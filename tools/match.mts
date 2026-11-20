// Usage: node --experimental-strip-types tools/match.mts [YYYY-MM-DD]
// Matches the articles of one day across chains. Writes data/matches/<date>.json:
// groups of identical articles, the review queue and the comparable pairs.
// A person's verdicts go into data/matches/decisions.json and win over the rules.
import { readFileSync, writeFileSync } from 'node:fs'
import { matchAll, buildLexicon, groupIdentical, applyDecisions, type Decision } from '../lib/match/match.ts'
import type { Observation } from '../lib/domain/history.ts'

const date = process.argv[2] ?? new Date().toISOString().slice(0, 10)
const obs: Observation[] = readFileSync(`data/prices/${date}.jsonl`, 'utf8').trim().split('\n').map(l => JSON.parse(l))
const decisions: Decision[] = JSON.parse(readFileSync('data/matches/decisions.json', 'utf8'))
const matches = applyDecisions(matchAll(obs, buildLexicon(obs)), decisions)
const brief = (x: Observation) => ({ retailer: x.retailer, sku: x.sku, brand: x.brand, name: x.name, pack: x.pack, price: x.price })

const groups = groupIdentical(matches)
const review = matches.filter(m => m.relation === 'identical' && m.review)
const comparable = matches.filter(m => m.relation === 'comparable')
writeFileSync(`data/matches/${date}.json`, JSON.stringify({
  date, articles: obs.length,
  identicalGroups: groups.map(g => g.map(brief)),
  review: review.map(m => ({ score: m.score, why: m.why, a: brief(m.a), b: brief(m.b) })),
  comparable: comparable.map(m => ({ score: m.score, why: m.why, a: brief(m.a), b: brief(m.b) })),
}, null, 1))
const inGroups = new Set(groups.flat()).size
console.log(`${obs.length} Artikel | identisch gesichert: ${groups.length} Gruppen (${inGroups} Artikel) | zur Prüfung: ${review.length} | vergleichbar: ${comparable.length} | Entscheidungen: ${decisions.length}`)
