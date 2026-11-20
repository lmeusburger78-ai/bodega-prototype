/**
 * Reading prices per branch without reading every branch completely.
 *
 * Idea: branches of the same chain, the same type and the same Bundesland carry
 * mostly the same range at the same prices. So:
 *
 * - monthly: one reference branch per group is read completely (its prices are the baseline);
 * - daily: the other branches get a small sample (rotating, so each is visited regularly)
 *   and are compared against the baseline: changes in range and prices that should not
 *   differ are what matters;
 * - between Bundesländer differences are allowed: every region has its own baseline.
 *
 * A branch that deviates more than allowed gets a full read the next day.
 */
import type { Branch } from '../domain/stores.ts'

export type Prices = Map<string, number> // sku → shelf price in this branch

/** chain · branch type · Bundesland. Branches without type or region fall into their own group "?". */
export const groupKey = (b: Branch) => `${b.chain}|${b.type ?? '?'}|${b.region ?? '?'}`

export function groups(branches: Branch[]): Map<string, Branch[]> {
  const g = new Map<string, Branch[]>()
  for (const b of branches) g.set(groupKey(b), [...(g.get(groupKey(b)) ?? []), b])
  for (const list of g.values()) list.sort((a, b) => a.id.localeCompare(b.id))
  return g
}

/** The branch that is read completely for its group this month: rotates monthly so one branch's quirks do not stick. */
export function referenceBranch(list: Branch[], month: string): Branch {
  const n = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7))
  return list[n % list.length]
}

/**
 * Which branches get a sample today: every branch is visited about every `cycleDays` days.
 * Deterministic (same day, same answer), reference branches excluded, no branch visited twice in a cycle.
 */
export function branchesToSample(branches: Branch[], day: string, month: string, cycleDays = 14): Branch[] {
  const dayNo = Math.floor(new Date(day + 'T12:00:00Z').getTime() / 86400000)
  const out: Branch[] = []
  for (const list of groups(branches).values()) {
    const ref = referenceBranch(list, month)
    list.filter(b => b.id !== ref.id).forEach((b, i) => { if ((i + hash(b.id)) % cycleDays === dayNo % cycleDays) out.push(b) })
  }
  return out
}

export type Comparison = {
  compared: number
  same: number
  /** same article, different price: what should not exist inside one group */
  priceDiffs: { sku: string; base: number; got: number }[]
  /** in the baseline but not found in this branch (range differs) */
  notInBranch: string[]
}

/** Compare a sample of one branch with the baseline of its group. `tol` is the rounding tolerance in euro. */
export function compare(baseline: Prices, sample: Prices, tol = 0.005): Comparison {
  const priceDiffs: Comparison['priceDiffs'] = [], notInBranch: string[] = []
  let same = 0, compared = 0
  for (const [sku, got] of sample) {
    const base = baseline.get(sku)
    if (base == null) continue // the branch has an article the baseline does not: a range change, found by the monthly read
    compared++
    if (Math.abs(base - got) <= tol) same++; else priceDiffs.push({ sku, base, got })
  }
  return { compared, same, priceDiffs, notInBranch }
}

export type Verdict = 'konsistent' | 'abweichend' | 'zu-wenig-vergleichbar'
/**
 * Verdict for a branch: consistent when at most `maxDiffShare` of the compared articles differ in price.
 * With fewer than `minCompared` comparable articles nothing can be said: a bigger sample is read.
 */
export function verdict(c: Comparison, maxDiffShare = 0.02, minCompared = 20): Verdict {
  if (c.compared < minCompared) return 'zu-wenig-vergleichbar'
  return c.priceDiffs.length / c.compared <= maxDiffShare ? 'konsistent' : 'abweichend'
}

/**
 * Inside one group the same article should have one price. Where branches disagree, the price most branches
 * show is taken as right, the others are returned as outliers (a late price update, a mislabelled shelf, a read error).
 */
export function outliers(group: Map<string, Prices>, minBranches = 3): { sku: string; majority: number; branch: string; price: number }[] {
  const bySku = new Map<string, [string, number][]>()
  for (const [branch, prices] of group) for (const [sku, p] of prices) bySku.set(sku, [...(bySku.get(sku) ?? []), [branch, p]])
  const out: { sku: string; majority: number; branch: string; price: number }[] = []
  for (const [sku, list] of bySku) {
    if (list.length < minBranches) continue
    const count = new Map<number, number>(); for (const [, p] of list) count.set(p, (count.get(p) ?? 0) + 1)
    const [majority, n] = [...count].sort((a, b) => b[1] - a[1])[0]
    if (n <= list.length / 2) continue // no clear majority: not decided here
    for (const [branch, price] of list) if (price !== majority) out.push({ sku, majority, branch, price })
  }
  return out
}

const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
