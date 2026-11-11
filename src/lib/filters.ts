import { HOUSING_TYPE_LABELS, type HousingType, type Listing } from '../data/types'
import { campusCommute, commuteMinutes, type Commute } from './commute'
import { fitStatus, trueMonthlyCost, type CostBreakdown, type FitStatus } from './cost'
import { formatMonth } from './format'

export interface Filters {
  /** 3 means 3 or more; 0 means studios. */
  bedrooms: 'any' | 0 | 1 | 2 | 3
  /** Empty means every type. */
  types: HousingType[]
  furnishedOnly: boolean
  /** Maximum commute in minutes; null means no limit. */
  maxCommute: number | null
  /** YYYY-MM; keep places available by this month. */
  moveIn: string | null
  showOver: boolean
}

export const DEFAULT_FILTERS: Filters = {
  bedrooms: 'any',
  types: [],
  furnishedOnly: false,
  maxCommute: null,
  moveIn: null,
  showOver: false,
}

export interface ListingResult {
  listing: Listing
  cost: CostBreakdown
  fit: FitStatus
  commute: Commute
}

const commuteCache = new Map<string, Commute>()
function commuteFor(l: Listing): Commute {
  const key = `${l.lat},${l.lng}`
  let c = commuteCache.get(key)
  if (!c) {
    c = campusCommute(l)
    commuteCache.set(key, c)
  }
  return c
}

export function evaluateOne(listing: Listing, budget: number): ListingResult {
  const cost = trueMonthlyCost(listing)
  return { listing, cost, fit: fitStatus(cost.total, budget), commute: commuteFor(listing) }
}

export function evaluate(listings: Listing[], budget: number): ListingResult[] {
  return listings.map((l) => evaluateOne(l, budget))
}

/** Every filter except budget fit. */
function matchesNonBudget(r: ListingResult, f: Filters): boolean {
  const l = r.listing
  if (f.bedrooms !== 'any') {
    if (f.bedrooms === 3 ? l.bedrooms < 3 : l.bedrooms !== f.bedrooms) return false
  }
  if (f.types.length > 0 && !f.types.includes(l.type)) return false
  if (f.furnishedOnly && !l.furnished) return false
  if (f.maxCommute !== null) {
    if (commuteMinutes(r.commute) > f.maxCommute) return false
  }
  if (f.moveIn && l.availableFrom > f.moveIn) return false
  return true
}

const byCost = (a: ListingResult, b: ListingResult) =>
  a.cost.total - b.cost.total || a.listing.id.localeCompare(b.listing.id)

/** Filter and sort by true monthly cost, cheapest first. */
export function applyFilters(results: ListingResult[], f: Filters): ListingResult[] {
  return results
    .filter((r) => matchesNonBudget(r, f) && (f.showOver || r.fit !== 'over'))
    .sort(byCost)
}

/**
 * For empty states: the nearest higher budget (rounded up to $50) at which
 * at least one place fits, and how many fit there.
 */
export function nearestBudgetWithResults(
  listings: Listing[],
  f: Filters,
  budget: number,
): { budget: number; count: number } | null {
  const candidates = evaluate(listings, budget)
    .filter((r) => matchesNonBudget(r, f))
    .map((r) => r.cost.total)
  const above = candidates.filter((t) => t > budget)
  if (above.length === 0) return null
  const suggested = Math.ceil(Math.min(...above) / 50) * 50
  return { budget: suggested, count: candidates.filter((t) => t <= suggested).length }
}

/** How many filters differ from the defaults (for the Filters button). */
export function activeFilterCount(f: Filters): number {
  return (
    (f.bedrooms !== 'any' ? 1 : 0) +
    (f.types.length ? 1 : 0) +
    (f.furnishedOnly ? 1 : 0) +
    (f.maxCommute !== null ? 1 : 0) +
    (f.moveIn ? 1 : 0) +
    (f.showOver ? 1 : 0)
  )
}

export interface FilterChip {
  id: string
  label: string
  /** The filters with just this one removed. */
  without: Filters
}

const BEDROOM_LABELS = { 0: 'Studio', 1: '1 bedroom', 2: '2 bedrooms', 3: '3+ bedrooms' } as const

/** The applied filters, one removable chip each, in the order the panel shows them. */
export function filterChips(f: Filters): FilterChip[] {
  const chips: FilterChip[] = []
  if (f.bedrooms !== 'any') chips.push({ id: 'bedrooms', label: BEDROOM_LABELS[f.bedrooms], without: { ...f, bedrooms: 'any' } })
  for (const t of f.types) {
    chips.push({ id: `type-${t}`, label: HOUSING_TYPE_LABELS[t], without: { ...f, types: f.types.filter((x) => x !== t) } })
  }
  if (f.furnishedOnly) chips.push({ id: 'furnished', label: 'Furnished', without: { ...f, furnishedOnly: false } })
  if (f.maxCommute !== null) {
    chips.push({ id: 'commute', label: `Commute ≤ ${f.maxCommute} min`, without: { ...f, maxCommute: null } })
  }
  if (f.moveIn) chips.push({ id: 'move-in', label: `Available by ${formatMonth(f.moveIn)}`, without: { ...f, moveIn: null } })
  if (f.showOver) chips.push({ id: 'over', label: 'Including over budget', without: { ...f, showOver: false } })
  return chips
}
