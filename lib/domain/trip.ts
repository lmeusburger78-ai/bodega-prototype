/**
 * The shopping trip itself: tick off what is already in the basket, and see at
 * the end what was paid and what was saved against the regular prices.
 */

export type TripLine = {
  id: string
  name: string
  branchId: string
  packs: number
  /** regular price per pack, without any promotion */
  regular: number
  /** what is actually paid for all packs, promotions and eligible deals applied */
  paid: number
  /** "1+1 gratis", "−25 % mit Rabattmarkerl" … */
  why?: string
  done: boolean
}

export type Trip = { date: string; lines: TripLine[] }

export const toggle = (t: Trip, id: string): Trip =>
  ({ ...t, lines: t.lines.map(l => l.id === id ? { ...l, done: !l.done } : l) })

/** Lines grouped per branch in route order, open items first within each shop. */
export function byStop(t: Trip, order: string[]) {
  return order.map(branchId => {
    const lines = t.lines.filter(l => l.branchId === branchId).sort((a, b) => Number(a.done) - Number(b.done))
    return { branchId, lines, open: lines.filter(l => !l.done).length }
  })
}

/** Regular total, paid total and the saving, overall and per reason. */
export function savings(t: Trip) {
  const regular = round(t.lines.reduce((s, l) => s + l.regular * l.packs, 0))
  const paid = round(t.lines.reduce((s, l) => s + l.paid, 0))
  const perLine = t.lines
    .map(l => ({ name: l.name, why: l.why, saved: round(l.regular * l.packs - l.paid) }))
    .filter(x => x.saved > 0)
  return { regular, paid, saved: round(regular - paid), perLine, ticked: t.lines.filter(l => l.done).length, total: t.lines.length }
}

const round = (n: number) => Math.round(n * 100) / 100
