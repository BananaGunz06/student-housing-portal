/**
 * Layout for the budget ruler: every place as a dot along a cost scale, with
 * a line at the budget. Positions are fractions (0–1) of the strip's width.
 */
export interface RulerDot {
  id: string
  total: number
  x: number
  /** 0 = on the baseline; dots that land close together stack upwards. */
  stack: number
}

export interface RulerLayout {
  lo: number
  hi: number
  budgetX: number
  /** Where Stretch ends (10% over budget). */
  stretchX: number
  dots: RulerDot[]
  /** Places that cost more than the right edge. */
  beyond: number
}

/** The strip is about 40 dots wide; this keeps neighbours from overlapping. */
const BINS = 40
export const MAX_STACK = 3

const floor100 = (n: number) => Math.floor(n / 100) * 100
const ceil100 = (n: number) => Math.ceil(n / 100) * 100

export function rulerLayout(places: { id: string; total: number }[], budget: number): RulerLayout {
  const cheapest = Math.min(...places.map((p) => p.total), budget)
  const lo = Math.max(0, floor100(Math.min(budget * 0.5, cheapest)))
  const hi = ceil100(budget * 1.5)
  const span = hi - lo
  const pos = (n: number) => (n - lo) / span
  const binWidth = span / BINS
  const inBin = new Map<number, number>()
  const dots: RulerDot[] = []
  let beyond = 0
  for (const p of [...places].sort((a, b) => a.total - b.total || a.id.localeCompare(b.id))) {
    if (p.total > hi) {
      beyond++
      continue
    }
    const bin = Math.floor((p.total - lo) / binWidth)
    const n = inBin.get(bin) ?? 0
    inBin.set(bin, n + 1)
    dots.push({ id: p.id, total: p.total, x: pos(p.total), stack: Math.min(n, MAX_STACK) })
  }
  return { lo, hi, budgetX: pos(budget), stretchX: Math.min(1, pos(budget * 1.1)), dots, beyond }
}
