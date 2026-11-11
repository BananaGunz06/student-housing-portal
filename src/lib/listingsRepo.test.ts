import { describe, expect, test } from 'vitest'
import { CAMPUS } from '../data/campus'
import { ROUTES, STOPS } from '../data/transit'
import { getAll, getById } from './listingsRepo'

describe('listingsRepo', () => {
  test('has 40 listings with unique ids', () => {
    const all = getAll()
    expect(all).toHaveLength(40)
    expect(new Set(all.map((l) => l.id)).size).toBe(40)
  })

  test('every listing is inside Guelph', () => {
    for (const l of getAll()) {
      expect(l.lat).toBeGreaterThan(43.48)
      expect(l.lat).toBeLessThan(43.58)
      expect(l.lng).toBeGreaterThan(-80.32)
      expect(l.lng).toBeLessThan(-80.15)
    }
  })

  test('getById finds a listing and misses unknown ids', () => {
    const first = getAll()[0]
    expect(getById(first.id)).toEqual(first)
    expect(getById('does-not-exist')).toBeUndefined()
  })
})

describe('sample transit', () => {
  test('the campus stop exists and is served by every route', () => {
    const campus = STOPS.find((s) => s.id === CAMPUS.stopId)
    expect(campus).toBeDefined()
    expect([...campus!.routes].sort()).toEqual(ROUTES.map((r) => r.id).sort())
  })

  test('every route passes through the campus loop', () => {
    for (const r of ROUTES) {
      expect(
        r.path.some((p) => p.lat === CAMPUS.lat && p.lng === CAMPUS.lng),
      ).toBe(true)
    }
  })

  test("every stop's routes exist", () => {
    const ids = new Set(ROUTES.map((r) => r.id))
    for (const s of STOPS) {
      expect(s.routes.length).toBeGreaterThan(0)
      for (const r of s.routes) expect(ids.has(r)).toBe(true)
    }
  })
})
