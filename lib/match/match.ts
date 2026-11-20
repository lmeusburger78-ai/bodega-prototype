/**
 * Which articles at different chains are "the same"?
 *
 * Two relations, because the shopper asks two different things:
 *
 * - `identical`: the same product ("Rummo Spaghetti n.3 500 g" at BILLA and at
 *   SPAR). Needed when a brand is pinned. Rule: same brand (not a private label),
 *   same pack, similar name. With a barcode (`ean`) on both sides: exact.
 * - `comparable`: the same kind of product, brand ignored ("Spaghetti 500 g",
 *   "6 Eier"). Needed for "egal, günstigste". Rule: same pack size band, same
 *   organic/not organic, similar core name. Private labels live here: a
 *   "Clever" pasta is never identical to a "S-Budget" pasta, but is comparable.
 *
 * Hard rules, never relaxed: a different pack size is never identical; organic is
 * never matched with non-organic; an uncertain pair goes to `review`, it is not
 * silently accepted. Scores below the thresholds are not matches at all.
 *
 * Quality is measured against hand-checked pairs (lib/domain/__checks__/match.check.ts)
 * and by sampling the output (tools/match.mts). There is no ground truth for the
 * whole range yet: that needs barcodes (see docs/produktzuordnung.md).
 */
import type { Observation } from '../domain/history.ts'

export type Relation = 'identical' | 'comparable'
export type Match = { a: Observation; b: Observation; relation: Relation; score: number; review: boolean; why: string }

/** Retailer-owned brands. Incomplete on purpose: add as they turn up in the review list. */
const foldLabel = (s: string) => s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/\p{M}/gu, '').replace(/&/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
export const PRIVATE_LABELS = new Set([
  'clever', 'billa', 'billa bio', 'ja natuerlich', 'da komm ich her', 'billa regional',
  's budget', 'spar', 'despar', 'spar premium', 'spar natur pur', 'spar vital', 'natur pur',
  'milfina', 'formil', 'cucina nobile', 'zurueck zum ursprung', 'mondo italiano', 'hofer',
  'milbona', 'pilos', 'lidl', 'deluxe', 'vemondo', 'biotrend', 'freeway', 'solevita',
  'penny', 'ich bin oesterreich', 'berryland', 'naturgut',
  'm', 'm bio', 'm budget', 'mpreis', 'tirol', 'm bio', 'm prima', 'natuerlich fuer uns',
  'dm', 'dmbio', 'dm bio', 'balea', 'alverde', 'denkmit', 'babylove', 'sunozon', 'profissimo', 'mivolis', 'dontodent',
].map(foldLabel))

/** Brands that are organic by definition. */
export const ORGANIC_LABELS = new Set(['Ja! Natürlich', 'BILLA Bio', 'M-BIO', 'BIO vom BERG', 'dmBio', 'Zurück zum Ursprung', 'Natur Pur', 'SPAR Natur*pur'].map(foldLabel))

const STOP = new Set(['der', 'die', 'das', 'und', 'mit', 'von', 'in', 'aus', 'ohne', 'a', 'la', 'di', 'del', 'the', 'fuer', 'zum', 'zur', 'im',
  'packung', 'flasche', 'dose', 'tasse', 'stueck', 'becher', 'beutel', 'stk', 'st', 'ca', 'ab', 'liter', 'kg', 'g', 'ml', 'l', 'cl', 'x', 'einweg', 'mehrweg'])

/** lower case, no accents, ß→ss, only letters and digits */
export const fold = (s: string) => s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/\p{M}/gu, '').replace(/&/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()

const stem = (w: string) => (w.length > 5 ? w.replace(/(en|er|e|n|s)$/, '') : w)

export type Lexicon = Set<string>
/** Brands seen in the data itself: every observation that carries an explicit brand teaches one. */
export function buildLexicon(obs: Observation[]): Lexicon {
  const lex: Lexicon = new Set()
  for (const o of obs) { const b = fold(o.brand); if (b.length > 1 && b.split(' ').length <= 3) lex.add(b) }
  return lex
}

/** The brand: the explicit field, else the longest known brand the name starts with. */
export function brandOf(o: Observation, lex: Lexicon): string {
  const b = fold(o.brand); if (b) return b
  const t = fold(o.name).split(' ')
  for (let n = Math.min(3, t.length - 1); n >= 1; n--) { const c = t.slice(0, n).join(' '); if (lex.has(c) || PRIVATE_LABELS.has(c)) return c }
  return ''
}

export type Profile = { o: Observation; brand: string; isPrivate: boolean; core: Set<string>; organic: boolean }
export function profile(o: Observation, lex: Lexicon): Profile {
  const brand = brandOf(o, lex)
  const bt = new Set(brand.split(' ').filter(Boolean))
  const words = fold(o.name).split(' ').filter(w => w && !/^\d/.test(w) && !STOP.has(w))
  const organic = words.includes('bio') || o.seals.includes('eu-bio') || /\bbio\b/.test(fold(o.brand)) || ORGANIC_LABELS.has(brand)
  const core = new Set(words.filter(w => w !== 'bio' && !bt.has(w)).map(stem))
  return { o, brand, isPrivate: PRIVATE_LABELS.has(brand), core, organic }
}

/** Dice coefficient on stems, with a boost when one name contains the other ("Spaghetti" ⊂ "Spaghetti Nr. 3"). */
export function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let hit = 0; for (const w of a) if (b.has(w)) hit++
  const dice = (2 * hit) / (a.size + b.size)
  const contained = hit === Math.min(a.size, b.size) && Math.min(a.size, b.size) >= 2
  return contained ? Math.max(dice, 0.75) : dice
}

const relDiff = (x: number, y: number) => Math.abs(x - y) / Math.max(x, y)
export const samePack = (a: Observation, b: Observation, tol = 0.01) => a.pack.unit === b.pack.unit && relDiff(a.pack.value, b.pack.value) <= tol

export const IDENTICAL_MIN = 0.6, COMPARABLE_MIN = 0.7, PACK_BAND = 0.15

/**
 * Sure only when the names say the same: equal after removing brand and size, or
 * one extra word on a name of at least three. "Asia Noodles" vs "Asia Noodles Huhn"
 * may be a different flavour, so it goes to review.
 */
function sure(a: Set<string>, b: Set<string>): boolean {
  let diff = 0; for (const w of a) if (!b.has(w)) diff++; for (const w of b) if (!a.has(w)) diff++
  return diff === 0 || (diff === 1 && Math.min(a.size, b.size) >= 3)
}

export function relate(pa: Profile, pb: Profile): Match | null {
  const a = pa.o, b = pb.o
  if (a.retailer === b.retailer) return null
  if (a.ean && b.ean) return a.ean === b.ean ? { a, b, relation: 'identical', score: 1, review: false, why: 'gleicher Strichcode' } : null
  if (pa.organic !== pb.organic) return null
  const s = similarity(pa.core, pb.core)
  if (pa.brand && pa.brand === pb.brand && !pa.isPrivate && samePack(a, b) && s >= IDENTICAL_MIN)
    return { a, b, relation: 'identical', score: round(s), review: !sure(pa.core, pb.core), why: `Marke "${pa.brand}", Packung gleich, Name ${Math.round(s * 100)} % ähnlich` }
  if (a.pack.unit === b.pack.unit && relDiff(a.pack.value, b.pack.value) <= PACK_BAND && s >= COMPARABLE_MIN)
    return { a, b, relation: 'comparable', score: round(s), review: false,
      why: `ähnlicher Name (${Math.round(s * 100)} %), Packung ${a.pack.value} / ${b.pack.value} ${a.pack.unit}${pa.brand !== pb.brand ? `, Marken ${pa.brand || '–'} / ${pb.brand || '–'}` : ''}` }
  return null
}

/** All pairs across chains. Blocked by pack unit to keep it fast; 1.300 articles take well under a second. */
export function matchAll(obs: Observation[], lex: Lexicon = buildLexicon(obs)): Match[] {
  const ps = obs.map(o => profile(o, lex)), out: Match[] = []
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    if (ps[i].o.pack.unit !== ps[j].o.pack.unit) continue
    const m = relate(ps[i], ps[j]); if (m) out.push(m)
  }
  return out
}

/** Group identical articles into one product. Union-find over `identical` matches that need no review. */
export function groupIdentical(matches: Match[]): Observation[][] {
  const parent = new Map<Observation, Observation>()
  const find = (x: Observation): Observation => { let r = x; while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!; return r }
  for (const m of matches) {
    if (m.relation !== 'identical' || m.review) continue
    for (const x of [m.a, m.b]) if (!parent.has(x)) parent.set(x, x)
    parent.set(find(m.a), find(m.b))
  }
  const groups = new Map<Observation, Observation[]>()
  for (const x of parent.keys()) { const r = find(x); groups.set(r, [...(groups.get(r) ?? []), x]) }
  return [...groups.values()].filter(g => new Set(g.map(o => o.retailer)).size === g.length) // one article per chain, else a wrong merge
}

/** A person's verdict on a pair. Kept forever, wins over the rules. */
export type Decision = { a: string; b: string; verdict: 'same' | 'different'; by?: string; on?: string }
export const pairKey = (a: Observation, b: Observation) => [a.sku, b.sku].sort().join(' ~ ')

export function applyDecisions(matches: Match[], decisions: Decision[]): Match[] {
  const v = new Map(decisions.map(d => [[d.a, d.b].sort().join(' ~ '), d.verdict]))
  return matches.flatMap(m => {
    const d = v.get(pairKey(m.a, m.b))
    if (d === 'different') return []
    if (d === 'same') return [{ ...m, relation: 'identical' as const, review: false, why: `von Hand bestätigt (${m.why})` }]
    return [m]
  })
}

const round = (n: number) => Math.round(n * 100) / 100
