import { CAMPUS } from '../data/campus'
import { ROUTES, STOPS } from '../data/transit'
import type { LatLng, Route, Stop } from '../data/types'

/** Straight-line walking is about 30% shorter than real streets. */
const DETOUR_FACTOR = 1.3
const WALK_M_PER_MIN = 80
/** Under this many minutes, walking is the obvious choice. */
const ALWAYS_WALK_MIN = 15
/** Only stops within this many minutes' walk count as a way onto the bus. */
const MAX_WALK_TO_STOP_MIN = 10

export type Commute =
  | { mode: 'walk'; minutes: number }
  | {
      mode: 'bus'
      minutes: number
      walkToStopMinutes: number
      stop: Stop
      route: Route
      rideMinutes: number
    }
  | { mode: 'transfer' }

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function walkMinutes(meters: number): number {
  return Math.max(1, Math.ceil((meters * DETOUR_FACTOR) / WALK_M_PER_MIN))
}

export function nearestStop(
  p: LatLng,
  stops: Stop[],
): { stop: Stop; meters: number } {
  let best = { stop: stops[0], meters: Infinity }
  for (const stop of stops) {
    const meters = distanceMeters(p, stop)
    if (meters < best.meters) best = { stop, meters }
  }
  return best
}

/** Stops that can reach the University Centre, found once (the default network never changes). */
const hasRide = (s: Stop) => !s.campus && Object.keys(s.toCampus).length > 0
const DEFAULT_CANDIDATES = STOPS.filter(hasRide)

/**
 * Estimated door-to-campus commute: walk, or walk to a stop within 10 minutes
 * and ride its scheduled time. "transfer" means no direct bus is close enough.
 */
export function campusCommute(
  p: LatLng,
  stops: Stop[] = STOPS,
  routes: Route[] = ROUTES,
  campus: LatLng = CAMPUS,
): Commute {
  const walk = walkMinutes(distanceMeters(p, campus))
  const candidates = stops === STOPS ? DEFAULT_CANDIDATES : stops.filter(hasRide)
  const order = new Map(routes.map((r, i) => [r.id, i]))
  const byId = new Map(routes.map((r) => [r.id, r]))
  let best: Extract<Commute, { mode: 'bus' }> | null = null
  for (const stop of candidates) {
    const walkToStopMinutes = walkMinutes(distanceMeters(p, stop))
    if (walkToStopMinutes > MAX_WALK_TO_STOP_MIN) continue
    for (const [routeId, rideMinutes] of Object.entries(stop.toCampus)) {
      const route = byId.get(routeId)
      if (!route) continue
      const minutes = walkToStopMinutes + rideMinutes
      const better =
        !best ||
        minutes < best.minutes ||
        (minutes === best.minutes &&
          (walkToStopMinutes < best.walkToStopMinutes ||
            (walkToStopMinutes === best.walkToStopMinutes &&
              compareRoutes(route, best.route, order) < 0)))
      if (better) best = { mode: 'bus', minutes, walkToStopMinutes, stop, route, rideMinutes }
    }
  }
  if (walk <= ALWAYS_WALK_MIN || (best && walk <= best.minutes)) {
    return { mode: 'walk', minutes: walk }
  }
  return best ?? { mode: 'transfer' }
}

function compareRoutes(a: Route, b: Route, order: Map<string, number>): number {
  return a.shortName.localeCompare(b.shortName, undefined, { numeric: true }) ||
    (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
}

/** Door-to-campus minutes, or null when a transfer is needed. */
export function commuteMinutes(c: Commute): number | null {
  return c.mode === 'transfer' ? null : c.minutes
}

/** "≈4 min walk to stop · Route 99 · ≈12 min to campus" */
export function describeCommute(c: Commute): string {
  if (c.mode === 'walk') return `≈${c.minutes} min walk to campus`
  if (c.mode === 'transfer') return 'Transfer needed'
  return `≈${c.walkToStopMinutes} min walk to stop · Route ${c.route.shortName} · ≈${c.minutes} min to campus`
}

/** Short form for cards: "≈9 min walk" / "≈18 min by bus" / "Transfer needed" */
export function shortCommute(c: Commute): string {
  if (c.mode === 'transfer') return 'Transfer needed'
  return c.mode === 'walk' ? `≈${c.minutes} min walk` : `≈${c.minutes} min by bus`
}
