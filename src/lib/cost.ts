import { CAMPUS } from '../data/campus'
import type { Listing } from '../data/types'

export type FitStatus = 'fits' | 'stretch' | 'over'

export interface CostBreakdown {
  rent: number
  utilities: number
  internet: number
  transit: number
  total: number
}

export interface CostSettings {
  defaultUtilities: number
  defaultInternet: number
  transitMonthly: number
}

/** Rent plus everything a student actually pays each month to live there. */
export function trueMonthlyCost(
  listing: Listing,
  campus: CostSettings = CAMPUS,
): CostBreakdown {
  const utilities = listing.utilitiesIncluded
    ? 0
    : listing.utilitiesEstimate || campus.defaultUtilities
  const internet = listing.internetIncluded
    ? 0
    : listing.internetEstimate || campus.defaultInternet
  const transit = campus.transitMonthly
  return {
    rent: listing.rent,
    utilities,
    internet,
    transit,
    total: listing.rent + utilities + internet + transit,
  }
}

/** Fits = at or under budget; Stretch = up to 10% over; otherwise Over. */
export function fitStatus(total: number, budget: number): FitStatus {
  if (total <= budget) return 'fits'
  // Integer maths so 770 vs 700 is exactly 10% with no float error.
  if (total * 10 <= budget * 11) return 'stretch'
  return 'over'
}

const money = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 0,
})

export function formatMoney(n: number): string {
  return money.format(n)
}
