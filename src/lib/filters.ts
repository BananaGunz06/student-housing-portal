import { HOUSING_TYPE_LABELS, type HousingType, type Listing } from '../data/types'
import { campusCommute, commuteMinutes, type Commute } from './commute'
import { fitStatus, trueMonthlyCost, type CostBreakdown, type FitStatus } from './cost'
import { termLabel, termOfMonth } from './profile'

/** How long the student needs a place: any, 4 months, 8 months, or 8 or more. */
export type Stay = 'any' | 4 | 8 | '8+'

export const STAY_OPTIONS: { value: Stay; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 4, label: '4 months' },
  { value: 8, label: '8 months' },
  { value: '8+', label: '8+ months' },
]

const HOUSING_TYPES: readonly string[] = ['room', 'studio', 'apartment', 'basement', 'house']

export interface Filters {
  /** 3 means 3 or more; 0 means studios. */
  bedrooms: 'any' | 0 | 1 | 2 | 3
  /** Empty means every type. */
  types: HousingType[]
  furnishedOnly: boolean
  /** Maximum commute in minutes; null means no limit. */
  maxCommute: number | null
  /** YYYY-season (for example 2027-fall); keep places that start in this term. */
  moveInTerm: string | null
  stay: Stay
  showOver: boolean
}

export const DEFAULT_FILTERS: Filters = {
  bedrooms: 'any',
  types: [],
  furnishedOnly: false,
  maxCommute: null,
  moveInTerm: null,
  stay: 'any',
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
  if (f.moveInTerm && termOfMonth(l.availableFrom) !== f.moveInTerm) return false
  if (l.leaseMonths < (f.stay === 4 ? 4 : f.stay === 'any' ? 0 : 8)) return false
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
    (f.moveInTerm ? 1 : 0) +
    (f.stay !== 'any' ? 1 : 0) +
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
  if (f.moveInTerm) {
    chips.push({ id: 'move-in', label: `Moving in ${termLabel(f.moveInTerm)}`, without: { ...f, moveInTerm: null } })
  }
  if (f.stay !== 'any') {
    chips.push({ id: 'stay', label: STAY_OPTIONS.find((o) => o.value === f.stay)!.label, without: { ...f, stay: 'any' } })
  }
  if (f.showOver) chips.push({ id: 'over', label: 'Including over budget', without: { ...f, showOver: false } })
  return chips
}

/** Months of the lease the student would have to sublet; 0 when there is nothing to flag. */
export function subletMonths(leaseMonths: number, stay: Stay): number {
  if (stay === 4) return Math.max(0, leaseMonths - 4)
  if (stay === 8) return Math.max(0, leaseMonths - 8)
  return 0
}

/** "12-month lease · you'd sublet the last 8 months", or null when the lease is not longer than needed. */
export function subletNote(leaseMonths: number, stay: Stay): string | null {
  const m = subletMonths(leaseMonths, stay)
  return m > 0 ? `${leaseMonths}-month lease · you'd sublet the last ${m} months` : null
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Tolerates anything (browser or account data): keeps what is valid, converts an old
 * "available by" month to its term, and falls back to the defaults. Never throws.
 */
export function cleanFilters(raw: unknown): Filters {
  const f: Filters = { ...DEFAULT_FILTERS, types: [] }
  if (!isObj(raw)) return f
  if (raw.bedrooms === 'any' || raw.bedrooms === 0 || raw.bedrooms === 1 || raw.bedrooms === 2 || raw.bedrooms === 3) {
    f.bedrooms = raw.bedrooms
  }
  if (Array.isArray(raw.types)) {
    f.types = raw.types.filter((t): t is HousingType => typeof t === 'string' && HOUSING_TYPES.includes(t))
  }
  if (typeof raw.furnishedOnly === 'boolean') f.furnishedOnly = raw.furnishedOnly
  if (raw.maxCommute === null || (typeof raw.maxCommute === 'number' && Number.isFinite(raw.maxCommute))) {
    f.maxCommute = raw.maxCommute
  }
  if (typeof raw.moveInTerm === 'string' && /^\d{4}-(winter|summer|fall)$/.test(raw.moveInTerm)) {
    f.moveInTerm = raw.moveInTerm
  } else if (typeof raw.moveIn === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw.moveIn)) {
    f.moveInTerm = termOfMonth(raw.moveIn)
  }
  if (raw.stay === 'any' || raw.stay === 4 || raw.stay === 8 || raw.stay === '8+') f.stay = raw.stay
  if (typeof raw.showOver === 'boolean') f.showOver = raw.showOver
  return f
}
