import { describe, expect, test } from 'vitest'
import { makeListing } from '../test/makeListing'
import {
  DEFAULT_FILTERS,
  STAY_OPTIONS,
  applyFilters,
  cleanFilters,
  evaluate,
  filterChips,
  nearestBudgetWithResults,
  subletMonths,
  subletNote,
  type Filters,
  type Stay,
} from './filters'

const cheap = makeListing({ id: 'a', rent: 700 })
const mid = makeListing({ id: 'b', rent: 900, type: 'studio', bedrooms: 0, furnished: true })
const pricey = makeListing({ id: 'c', rent: 950, type: 'apartment', bedrooms: 2, availableFrom: '2027-09' })
const big = makeListing({ id: 'd', rent: 2500, type: 'house', bedrooms: 4 })
// Exhibition Park: a long Route 99 ride, so a longer commute than the walkers.
const far = makeListing({ id: 'e', rent: 650, lat: 43.55124, lng: -80.26554 })
// Outside the city, nowhere near a campus-bound stop.
const stranded = makeListing({ id: 'f', rent: 600, lat: 43.45, lng: -80.4 })
// Kitchener-side spot whose best trip changes buses once (Route 20 then Route 18).
const changer = makeListing({ id: 'g', rent: 700, lat: 43.53968, lng: -80.27128 })
const all = [pricey, big, cheap, mid, far]

const ids = (budget: number, f = DEFAULT_FILTERS) =>
  applyFilters(evaluate(all, budget), f).map((r) => r.listing.id)

describe('applyFilters', () => {
  test('sorts by true cost and hides over-budget by default', () => {
    expect(ids(900)).toEqual(['e', 'a', 'b', 'c']) // 950 is a stretch at 900
  })

  test('shows over-budget when asked', () => {
    expect(ids(900, { ...DEFAULT_FILTERS, showOver: true })).toEqual(['e', 'a', 'b', 'c', 'd'])
  })

  test('each result carries cost, fit and commute', () => {
    const [r] = applyFilters(evaluate([cheap], 650), DEFAULT_FILTERS)
    expect(r.cost.total).toBe(700)
    expect(r.fit).toBe('stretch')
    expect(r.commute.mode).toBe('walk')
  })

  test('far places take the bus; stranded ones walk with no bus nearby', () => {
    expect(evaluate([far], 5000)[0].commute.mode).toBe('bus')
    expect(evaluate([stranded], 5000)[0].commute).toMatchObject({ mode: 'walk', noBusNearby: true })
  })

  test('no-bus-nearby places count with their walking minutes', () => {
    const minutes = evaluate([stranded], 5000)[0].commute.minutes
    const f = (maxCommute: number | null) =>
      applyFilters(evaluate([stranded], 5000), { ...DEFAULT_FILTERS, maxCommute }).length
    expect(f(null)).toBe(1)
    expect(f(minutes)).toBe(1)
    expect(f(minutes - 1)).toBe(0)
  })

  test('a one-transfer commute counts with its minutes against the limit', () => {
    const c = evaluate([changer], 5000)[0].commute
    expect(c.mode === 'bus' && c.transfer).toBeTruthy()
    const minutes = (c as { minutes: number }).minutes
    const f = (maxCommute: number | null) =>
      applyFilters(evaluate([changer], 5000), { ...DEFAULT_FILTERS, maxCommute }).length
    expect(f(minutes)).toBe(1)
    expect(f(minutes - 1)).toBe(0)
    expect(f(null)).toBe(1)
  })

  test('a bus commute within the limit stays, beyond it goes', () => {
    const minutes = (evaluate([far], 5000)[0].commute as { minutes: number }).minutes
    expect(applyFilters(evaluate([far], 5000), { ...DEFAULT_FILTERS, maxCommute: minutes })).toHaveLength(1)
    expect(applyFilters(evaluate([far], 5000), { ...DEFAULT_FILTERS, maxCommute: minutes - 1 })).toHaveLength(0)
  })

  test('bedrooms 3 means 3 or more', () => {
    expect(ids(5000, { ...DEFAULT_FILTERS, bedrooms: 3 })).toEqual(['d'])
  })

  test('bedrooms 0 means studios', () => {
    expect(ids(5000, { ...DEFAULT_FILTERS, bedrooms: 0 })).toEqual(['b'])
  })

  test('filters by housing type', () => {
    expect(ids(5000, { ...DEFAULT_FILTERS, types: ['studio', 'house'] })).toEqual(['b', 'd'])
  })

  test('furnished only', () => {
    expect(ids(5000, { ...DEFAULT_FILTERS, furnishedOnly: true })).toEqual(['b'])
  })

  test('max commute drops far places', () => {
    expect(ids(5000, { ...DEFAULT_FILTERS, maxCommute: 10 })).toEqual(['a', 'b', 'c', 'd'])
  })

  test('move-in term keeps places that start in that term', () => {
    // a, b, d, e start 2027-01 (Winter 2027); c starts 2027-09 (Fall 2027)
    expect(ids(5000, { ...DEFAULT_FILTERS, moveInTerm: '2027-winter' })).toEqual(['e', 'a', 'b', 'd'])
    expect(ids(5000, { ...DEFAULT_FILTERS, moveInTerm: '2027-fall' })).toEqual(['c'])
    expect(ids(5000, { ...DEFAULT_FILTERS, moveInTerm: '2027-summer' })).toEqual([])
  })
})

describe('length of stay', () => {
  const lease = (months: 4 | 8 | 12) => makeListing({ id: `l${months}`, leaseMonths: months })
  const shown = (stay: Stay) =>
    applyFilters(evaluate([lease(4), lease(8), lease(12)], 5000), { ...DEFAULT_FILTERS, stay }).map((r) => r.listing.leaseMonths)
      .sort((a, b) => a - b)

  test('the spec table: which leases show for each choice', () => {
    expect(shown('any')).toEqual([4, 8, 12])
    expect(shown(4)).toEqual([4, 8, 12])
    expect(shown(8)).toEqual([8, 12])
    expect(shown('8+')).toEqual([8, 12])
  })

  test('sublet months and note', () => {
    expect(subletMonths(4, 4)).toBe(0)
    expect(subletMonths(8, 4)).toBe(4)
    expect(subletMonths(12, 4)).toBe(8)
    expect(subletMonths(4, 8)).toBe(0)
    expect(subletMonths(8, 8)).toBe(0)
    expect(subletMonths(12, 8)).toBe(4)
    for (const n of [4, 8, 12]) {
      expect(subletMonths(n, 'any')).toBe(0)
      expect(subletMonths(n, '8+')).toBe(0)
    }
    expect(subletNote(12, 4)).toBe("12-month lease · you'd sublet the last 8 months")
    expect(subletNote(8, 4)).toBe("8-month lease · you'd sublet the last 4 months")
    expect(subletNote(12, 8)).toBe("12-month lease · you'd sublet the last 4 months")
    expect(subletNote(12, 'any')).toBeNull()
    expect(subletNote(12, '8+')).toBeNull()
    expect(subletNote(4, 4)).toBeNull()
  })

  test('options are Any, 4 months, 8 months, 8+ months in that order', () => {
    expect(STAY_OPTIONS.map((o) => o.label)).toEqual(['Any', '4 months', '8 months', '8+ months'])
  })
})

describe('cleanFilters', () => {
  test('converts an old available-by month to its term and drops the old key', () => {
    const f = cleanFilters({ moveIn: '2027-01', furnishedOnly: true })
    expect(f).toEqual({ ...DEFAULT_FILTERS, furnishedOnly: true, moveInTerm: '2027-winter' })
    expect('moveIn' in f).toBe(false)
    expect(cleanFilters({ moveIn: '2027-09' }).moveInTerm).toBe('2027-fall')
  })

  test('drops what it does not recognise', () => {
    expect(cleanFilters({ moveIn: 'junk' }).moveInTerm).toBeNull()
    expect(cleanFilters({ moveInTerm: '2027-spring' }).moveInTerm).toBeNull()
    expect(cleanFilters({ stay: 12 }).stay).toBe('any')
    expect(cleanFilters({ stay: '4' }).stay).toBe('any')
  })

  test('keeps valid terms and lengths', () => {
    expect(cleanFilters({ moveInTerm: '2027-fall', stay: '8+' })).toEqual({ ...DEFAULT_FILTERS, moveInTerm: '2027-fall', stay: '8+' })
    expect(cleanFilters({ stay: 4 }).stay).toBe(4)
  })

  test('null and non-objects give the defaults and never throw', () => {
    for (const junk of [null, undefined, 5, 'x', [], true]) {
      expect(cleanFilters(junk)).toEqual(DEFAULT_FILTERS)
    }
  })
})

describe('nearestBudgetWithResults', () => {
  test('suggests the next $50 budget where something fits', () => {
    // Nothing within 10% of 580 (cheapest is 650 > 638). At 650, one place fits.
    expect(nearestBudgetWithResults(all, DEFAULT_FILTERS, 580)).toEqual({ budget: 650, count: 1 })
  })

  test('rounds up to the next $50', () => {
    const odd = [makeListing({ id: 'x', rent: 712 })]
    expect(nearestBudgetWithResults(odd, DEFAULT_FILTERS, 500)).toEqual({ budget: 750, count: 1 })
  })

  test('respects non-budget filters', () => {
    expect(
      nearestBudgetWithResults(all, { ...DEFAULT_FILTERS, bedrooms: 3 }, 1000),
    ).toEqual({ budget: 2500, count: 1 })
  })

  test('respects the term and length filters', () => {
    const short = [makeListing({ id: 's', rent: 700, leaseMonths: 4 }), makeListing({ id: 't', rent: 800, leaseMonths: 12, availableFrom: '2027-09' })]
    expect(nearestBudgetWithResults(short, { ...DEFAULT_FILTERS, moveInTerm: '2027-fall' }, 500)).toEqual({ budget: 800, count: 1 })
    expect(nearestBudgetWithResults(short, { ...DEFAULT_FILTERS, stay: 8 }, 500)).toEqual({ budget: 800, count: 1 })
    expect(nearestBudgetWithResults(short, { ...DEFAULT_FILTERS, moveInTerm: '2027-summer' }, 500)).toBeNull()
  })

  test('returns null when no budget would help', () => {
    expect(
      nearestBudgetWithResults(all, { ...DEFAULT_FILTERS, types: ['basement'] }, 500),
    ).toBeNull()
  })
})

describe('filterChips', () => {
  test('no chips for the defaults', () => {
    expect(filterChips(DEFAULT_FILTERS)).toEqual([])
  })

  test('one chip per applied filter, each removing only itself', () => {
    const f: Filters = {
      bedrooms: 0,
      types: ['room', 'studio'],
      furnishedOnly: true,
      maxCommute: 15,
      moveInTerm: '2027-winter',
      stay: 4,
      showOver: true,
    }
    const chips = filterChips(f)
    expect(chips.map((c) => c.label)).toEqual([
      'Studio',
      'Room in shared house',
      'Studio apartment',
      'Furnished',
      'Commute ≤ 15 min',
      'Moving in Winter 2027',
      '4 months',
      'Including over budget',
    ])
    expect(chips[0].without).toEqual({ ...f, bedrooms: 'any' })
    expect(chips[1].without).toEqual({ ...f, types: ['studio'] })
    expect(chips[4].without).toEqual({ ...f, maxCommute: null })
    expect(chips[5].without).toEqual({ ...f, moveInTerm: null })
    expect(chips[6].without).toEqual({ ...f, stay: 'any' })
    expect(new Set(chips.map((c) => c.id)).size).toBe(chips.length)
  })

  test('bedroom labels', () => {
    const label = (bedrooms: Filters['bedrooms']) => filterChips({ ...DEFAULT_FILTERS, bedrooms })[0].label
    expect(label(1)).toBe('1 bedroom')
    expect(label(2)).toBe('2 bedrooms')
    expect(label(3)).toBe('3+ bedrooms')
  })
})
