import type { BudgetBand } from './types'

/** A budget band as a range: more than `over`, and at most `upTo`. A missing end is open. */
export function bandBounds(band: BudgetBand): { over?: number; upTo?: number } {
  switch (band) {
    case 'any':
      return {}
    case 'under600':
      return { upTo: 600 }
    case '600-800':
      return { over: 600, upTo: 800 }
    case '800-1000':
      return { over: 800, upTo: 1000 }
    case 'over1000':
      return { over: 1000 }
  }
}

/** Whether a budget falls in the band. A student with no budget matches only 'any'. */
export function inBand(budget: number | null, band: BudgetBand): boolean {
  if (band === 'any') return true
  if (budget === null) return false
  const { over, upTo } = bandBounds(band)
  return (over === undefined || budget > over) && (upTo === undefined || budget <= upTo)
}
