import { CAMPUS } from '../data/campus'
import type { Listing } from '../data/types'

export type FitStatus = 'fits' | 'stretch' | 'over'

export const FIT_LABEL: Record<FitStatus, string> = {
  fits: 'Fits',
  stretch: 'Stretch',
  over: 'Over budget',
}
export const FIT_ICON: Record<FitStatus, string> = { fits: '✓', stretch: '!', over: '✕' }

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

export const BUDGET_MIN = 300
export const BUDGET_MAX = 5000
/** The slider stops here; type a larger number if you need to. */
export const BUDGET_SLIDER_MAX = 3200

export function clampBudget(n: number): number {
  if (!Number.isFinite(n)) return BUDGET_MIN
  return Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, Math.round(n)))
}

export function budgetGapText(total: number, budget: number): string {
  if (total === budget) return 'Exactly your budget'
  return total < budget
    ? `${formatMoney(budget - total)} left each month`
    : `${formatMoney(total - budget)} over your budget`
}
