import { describe, expect, test } from 'vitest'
import { CAMPUS } from '../data/campus'
import { ROUTES, STOPS, TRANSIT_META } from '../data/transit'
import { campusCommute, distanceMeters } from './commute'
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

  test('every listing has a fictional poster', () => {
    const roles = ['landlord', 'property-manager', 'student-sublet']
    for (const { poster } of getAll()) {
      expect(poster.name.trim()).not.toBe('')
      expect(roles).toContain(poster.role)
      expect(poster.replyTime).toMatch(/^Usually replies/)
      // Reserved fictional ranges only, so no real person is listed.
      if (poster.phone) expect(poster.phone).toMatch(/^519-555-01\d\d$/)
      if (poster.email) expect(poster.email).toMatch(/@example\.com$/)
    }
  })

  test('posters choose what to share: some keep phone and email private', () => {
    const posters = getAll().map((l) => l.poster)
    expect(posters.filter((p) => !p.phone && !p.email).length).toBeGreaterThanOrEqual(10)
    expect(posters.some((p) => p.phone && !p.email)).toBe(true)
    expect(posters.some((p) => p.email && !p.phone)).toBe(true)
    expect(posters.some((p) => p.email && p.phone)).toBe(true)
  })

  test('getById finds a listing and misses unknown ids', () => {
    const first = getAll()[0]
    expect(getById(first.id)).toEqual(first)
    expect(getById('does-not-exist')).toBeUndefined()
  })
})

describe('real Guelph Transit network', () => {
  test('University Centre platforms exist and are marked as campus', () => {
    const uc = STOPS.filter((s) => s.campus)
    expect(uc.length).toBeGreaterThan(0)
    for (const s of uc) expect(distanceMeters(s, CAMPUS)).toBeLessThan(300)
  })

  test('every route has a colour, a short name and at least one path', () => {
    expect(ROUTES.length).toBeGreaterThan(0)
    for (const r of ROUTES) {
      expect(r.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(r.shortName).not.toBe('')
      expect(r.paths.length).toBeGreaterThanOrEqual(1)
      for (const p of r.paths) expect(p.length).toBeGreaterThan(1)
    }
  })

  test("every stop's routes exist and every ride time belongs to one of its routes", () => {
    const ids = new Set(ROUTES.map((r) => r.id))
    for (const s of STOPS) {
      for (const r of s.routes) expect(ids.has(r)).toBe(true)
      for (const [r, mins] of Object.entries(s.toCampus)) {
        expect(s.routes).toContain(r)
        expect(mins).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('a Gordon St stop off campus has a ride time to the University Centre', () => {
    expect(
      STOPS.some((s) => !s.campus && /gordon/i.test(s.name) && Object.keys(s.toCampus).length > 0),
    ).toBe(true)
  })

  test('some listings get a direct bus, some a one-transfer bus, and a spot next to campus walks', () => {
    const commutes = getAll().map((l) => campusCommute(l))
    expect(commutes.some((c) => c.mode === 'bus' && !c.transfer)).toBe(true)
    expect(commutes.some((c) => c.mode === 'bus' && c.transfer)).toBe(true)
    const nearCampus = { lat: CAMPUS.lat + 0.002, lng: CAMPUS.lng }
    expect(campusCommute(nearCampus).mode).toBe('walk')
  })

  test('TRANSIT_META names the schedule', () => {
    expect(TRANSIT_META.schedule).toBe('Winter 2026')
  })
})
