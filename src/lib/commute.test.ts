import { describe, expect, test } from 'vitest'
import { CAMPUS } from '../data/campus'
import { STOPS } from '../data/transit'
import type { Route, Stop } from '../data/types'
import {
  campusCommute,
  commuteMinutes,
  describeCommute,
  distanceMeters,
  nearestStop,
  shortCommute,
  walkMinutes,
  type Commute,
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

const route = (id: string, shortName: string): Route => ({
  id,
  shortName,
  longName: `Route ${shortName}`,
  color: '#123456',
  paths: [[{ lat: 43.5, lng: -80.2 }, { lat: 43.51, lng: -80.2 }]],
})
const R1 = route('r1', '1')
const R2 = route('r2', '2')
const R99 = route('r99', '99')
// 0.001 degrees of latitude is about 111 m, so about 2 minutes' walk.
const stopAt = (id: string, dLat: number, toCampus: Record<string, number>): Stop => ({
  id,
  name: id,
  lat: 43.5 + dLat,
  lng: -80.2,
  routes: Object.keys(toCampus),
  toCampus,
})
const FAR_CAMPUS = { lat: 43.6, lng: -80.2 }
const HOME = { lat: 43.5, lng: -80.2 }

describe('nearestStop', () => {
  test('picks the closest stop', () => {
    const { stop, meters } = nearestStop(HOME, [stopAt('far', 0.004, {}), stopAt('near', 0.001, {})])
    expect(stop.id).toBe('near')
    expect(meters).toBeGreaterThan(100)
    expect(meters).toBeLessThan(120)
  })
})

describe('campusCommute (synthetic network)', () => {
  test('a direct bus beats a long walk: walk to stop plus ride', () => {
    const c = campusCommute(HOME, [stopAt('s', 0.001, { r1: 10 })], [R1], FAR_CAMPUS)
    expect(c).toMatchObject({ mode: 'bus', walkToStopMinutes: 2, rideMinutes: 10, minutes: 12 })
    if (c.mode === 'bus') {
      expect(c.stop.id).toBe('s')
      expect(c.route.id).toBe('r1')
    }
  })

  test('picks the lower total, not the nearest stop', () => {
    const near = stopAt('near-slow', 0.001, { r1: 30 }) // 2 + 30
    const farther = stopAt('far-fast', 0.0045, { r2: 8 }) // 7 + 8
    const c = campusCommute(HOME, [near, farther], [R1, R2], FAR_CAMPUS)
    expect(c.mode).toBe('bus')
    if (c.mode !== 'bus') return
    expect(c.stop.id).toBe('far-fast')
    expect(c.route.id).toBe('r2')
    expect(c.minutes).toBe(c.walkToStopMinutes + c.rideMinutes)
  })

  test('on a tie, the shorter walk wins, then the lower route number', () => {
    const a = stopAt('a', 0.001, { r1: 14 }) // 2 + 14 = 16
    const b = stopAt('b', 0.0045, { r1: 9 }) // 7 + 9 = 16
    const first = campusCommute(HOME, [b, a], [R1], FAR_CAMPUS)
    expect(first.mode === 'bus' && first.stop.id).toBe('a')
    const sameStop = stopAt('s', 0.001, { r99: 10, r2: 10 })
    const second = campusCommute(HOME, [sameStop], [R99, R2], FAR_CAMPUS)
    expect(second.mode === 'bus' && second.route.shortName).toBe('2')
  })

  test('stops more than a 10 minute walk away do not count', () => {
    // 0.0055 degrees is about 610 m: 10 min; 0.0065 is about 720 m: 12 min.
    const ok = campusCommute(HOME, [stopAt('ten', 0.0055, { r1: 5 })], [R1], FAR_CAMPUS)
    expect(ok.mode).toBe('bus')
    const tooFar = campusCommute(HOME, [stopAt('twelve', 0.0065, { r1: 5 })], [R1], FAR_CAMPUS)
    expect(tooFar).toEqual({ mode: 'transfer' })
  })

  test('a stop that does not reach campus (no toCampus) is ignored', () => {
    const c = campusCommute(HOME, [stopAt('dead-end', 0.001, {})], [R1], FAR_CAMPUS)
    expect(c).toEqual({ mode: 'transfer' })
  })

  test('campus platforms are never boarding stops', () => {
    const platform: Stop = { ...stopAt('uc', 0.001, { r1: 0 }), campus: true }
    expect(campusCommute(HOME, [platform], [R1], FAR_CAMPUS)).toEqual({ mode: 'transfer' })
  })

  test('walks when walking is no slower than the bus', () => {
    const campus = { lat: 43.505, lng: -80.2 } // about 560 m: 8 min walk
    const c = campusCommute(HOME, [stopAt('s', 0.001, { r1: 20 })], [R1], campus)
    expect(c).toEqual({ mode: 'walk', minutes: walkMinutes(distanceMeters(HOME, campus)) })
  })

  test('walks when under 15 minutes even if a bus would be faster', () => {
    const campus = { lat: 43.509, lng: -80.2 } // about 1 km: 17 min, over the limit
    expect(campusCommute(HOME, [stopAt('s', 0.0001, { r1: 1 })], [R1], campus).mode).toBe('bus')
    const near = { lat: 43.507, lng: -80.2 } // about 780 m: 13 min
    expect(campusCommute(HOME, [stopAt('s', 0.0001, { r1: 1 })], [R1], near).mode).toBe('walk')
  })
})

describe('campusCommute (real Guelph Transit network)', () => {
  test('a place 300 m from campus is a walk', () => {
    const c = campusCommute({ lat: CAMPUS.lat + 0.0027, lng: CAMPUS.lng })
    expect(c.mode).toBe('walk')
    expect(c).toEqual({ mode: 'walk', minutes: 5 })
  })

  test('right next to campus is a walk, never a transfer', () => {
    for (const d of [0, 0.0003, -0.0005]) {
      expect(campusCommute({ lat: CAMPUS.lat + d, lng: CAMPUS.lng - d }).mode).toBe('walk')
    }
  })

  test('a place by a Gordon St stop takes a real route to campus', () => {
    const gordon = STOPS.find(
      (s) => !s.campus && /gordon/i.test(s.name) && Object.keys(s.toCampus).length > 0 && distanceMeters(s, CAMPUS) > 2000,
    )!
    const c = campusCommute({ lat: gordon.lat, lng: gordon.lng })
    expect(c.mode).toBe('bus')
    if (c.mode !== 'bus') return
    expect(c.rideMinutes).toBeGreaterThan(0)
    expect(c.minutes).toBe(c.walkToStopMinutes + c.rideMinutes)
    expect(c.stop.toCampus[c.route.id]).toBe(c.rideMinutes)
    expect(c.stop.routes).toContain(c.route.id)
  })

  test('a spot far from any campus-bound stop needs a transfer', () => {
    expect(campusCommute({ lat: 43.45, lng: -80.4 })).toEqual({ mode: 'transfer' })
  })
})

describe('commute text', () => {
  const bus: Commute = {
    mode: 'bus',
    minutes: 20,
    walkToStopMinutes: 6,
    rideMinutes: 14,
    stop: stopAt('s', 0, { r99: 14 }),
    route: R99,
  }
  const walk: Commute = { mode: 'walk', minutes: 9 }
  const transfer: Commute = { mode: 'transfer' }

  test('describeCommute', () => {
    expect(describeCommute(walk)).toBe('≈9 min walk to campus')
    expect(describeCommute(bus)).toBe('≈6 min walk to stop · Route 99 · ≈20 min to campus')
    expect(describeCommute(transfer)).toBe('Transfer needed')
  })
  test('shortCommute', () => {
    expect(shortCommute(walk)).toBe('≈9 min walk')
    expect(shortCommute(bus)).toBe('≈20 min by bus')
    expect(shortCommute(transfer)).toBe('Transfer needed')
  })
  test('commuteMinutes is null for a transfer', () => {
    expect(commuteMinutes(walk)).toBe(9)
    expect(commuteMinutes(bus)).toBe(20)
    expect(commuteMinutes(transfer)).toBeNull()
  })
})
