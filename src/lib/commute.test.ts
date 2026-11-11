import { describe, expect, test } from 'vitest'
import { CAMPUS } from '../data/campus'
import { ROUTES, STOPS } from '../data/transit'
import {
  alongRouteMeters,
  campusCommute,
  distanceMeters,
  nearestStop,
  walkMinutes,
} from './commute'

describe('distanceMeters', () => {
  test('0.009 degrees of latitude is about 1 km', () => {
    const d = distanceMeters({ lat: 43.5305, lng: -80.2262 }, { lat: 43.5395, lng: -80.2262 })
    expect(d).toBeGreaterThan(990)
    expect(d).toBeLessThan(1010)
  })
  test('same point is 0', () => {
    expect(distanceMeters(CAMPUS, CAMPUS)).toBe(0)
  })
})

describe('walkMinutes', () => {
  test('800 m straight line is 13 minutes (x1.3 at 80 m/min)', () => {
    expect(walkMinutes(800)).toBe(13)
  })
  test('rounds up', () => expect(walkMinutes(100)).toBe(2))
  test('never less than 1 minute', () => expect(walkMinutes(0)).toBe(1))
})

test('nearestStop picks the closest stop', () => {
  const { stop, meters } = nearestStop({ lat: 43.4961, lng: -80.2121 }, STOPS)
  expect(stop.name).toBe('Gordon & Clair')
  expect(meters).toBeLessThan(20)
})

test('alongRouteMeters sums segments between the nearest vertices', () => {
  const path = [
    { lat: 43.5, lng: -80.2 },
    { lat: 43.509, lng: -80.2 },
    { lat: 43.518, lng: -80.2 },
  ]
  const full = alongRouteMeters(path, path[0], path[2])
  expect(full).toBeGreaterThan(1990)
  expect(full).toBeLessThan(2010)
  expect(alongRouteMeters(path, path[2], path[0])).toBeCloseTo(full)
  expect(alongRouteMeters(path, path[1], path[1])).toBe(0)
})

describe('campusCommute', () => {
  test('a place 300 m from campus is a walk', () => {
    const c = campusCommute({ lat: CAMPUS.lat + 0.0027, lng: CAMPUS.lng })
    expect(c).toEqual({ mode: 'walk', minutes: 5 })
  })

  test('a place in the south end takes the bus', () => {
    const c = campusCommute({ lat: 43.4961, lng: -80.2121 })
    expect(c.mode).toBe('bus')
    if (c.mode !== 'bus') return
    expect(c.stop.name).toBe('Gordon & Clair')
    expect(c.route.id).toBe('99')
    expect(c.walkToStopMinutes).toBe(1)
    expect(c.busMinutes).toBeGreaterThan(5)
    expect(c.minutes).toBe(c.walkToStopMinutes + c.busMinutes)
  })

  test('picks a stop on a route that reaches campus', () => {
    const c = campusCommute({ lat: 43.556, lng: -80.205 }, STOPS, ROUTES)
    expect(c.mode).toBe('bus')
    if (c.mode === 'bus') expect(c.stop.routes).toContain(c.route.id)
  })
})
