import { describe, expect, test } from 'vitest'
import { makeListing } from '../test/makeListing'
import { DEFAULT_FILTERS, applyFilters, evaluate, nearestBudgetWithResults } from './filters'

const cheap = makeListing({ id: 'a', rent: 700 })
const mid = makeListing({ id: 'b', rent: 900, type: 'studio', bedrooms: 0, furnished: true })
const pricey = makeListing({ id: 'c', rent: 950, type: 'apartment', bedrooms: 2, availableFrom: '2027-09' })
const big = makeListing({ id: 'd', rent: 2500, type: 'house', bedrooms: 4 })
const far = makeListing({ id: 'e', rent: 650, lat: 43.4961, lng: -80.2121 })
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

  test('move-in month keeps places available by then', () => {
    expect(ids(5000, { ...DEFAULT_FILTERS, moveIn: '2027-05' })).toEqual(['e', 'a', 'b', 'd'])
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

  test('returns null when no budget would help', () => {
    expect(
      nearestBudgetWithResults(all, { ...DEFAULT_FILTERS, types: ['basement'] }, 500),
    ).toBeNull()
  })
})
