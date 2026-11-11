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

export type BusCommute = {
      mode: 'bus'
      minutes: number
      walkToStopMinutes: number
      stop: Stop
      route: Route
      /** Ride time; with a transfer, ride plus the change. */
      rideMinutes: number
      /** Present when the trip changes buses once; `route` is then the first bus. */
      transfer?: { secondRoute: Route; stop: { id: string; name: string } }
    }

export type Commute = { mode: 'walk'; minutes: number } | BusCommute | { mode: 'transfer' }

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

/** Stops that can reach the University Centre, found once (the default network never changes). */
const hasRide = (s: Stop) =>
  !s.campus && (Object.keys(s.toCampus).length > 0 || s.viaTransfer !== undefined)
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
  let best: BusCommute | null = null
  for (const stop of candidates) {
    const walkToStopMinutes = walkMinutes(distanceMeters(p, stop))
    if (walkToStopMinutes > MAX_WALK_TO_STOP_MIN) continue
    const options: { route: Route; rideMinutes: number; transfer?: BusCommute['transfer'] }[] = []
    for (const [routeId, rideMinutes] of Object.entries(stop.toCampus)) {
      const route = byId.get(routeId)
      if (route) options.push({ route, rideMinutes })
    }
    const via = stop.viaTransfer
    if (via) {
      const route = byId.get(via.firstRoute)
      const secondRoute = byId.get(via.secondRoute)
      if (route && secondRoute) {
        options.push({ route, rideMinutes: via.minutes, transfer: { secondRoute, stop: via.transferStop } })
      }
    }
    for (const { route, rideMinutes, transfer } of options) {
      const minutes = walkToStopMinutes + rideMinutes
      const better =
        !best ||
        minutes < best.minutes ||
        (minutes === best.minutes &&
          (walkToStopMinutes < best.walkToStopMinutes ||
            (walkToStopMinutes === best.walkToStopMinutes &&
              compareRoutes(route, best.route, order) < 0)))
      if (better) {
        best = { mode: 'bus', minutes, walkToStopMinutes, stop, route, rideMinutes, ...(transfer && { transfer }) }
      }
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
  const routes = c.transfer
    ? `Route ${c.route.shortName} then Route ${c.transfer.secondRoute.shortName}`
    : `Route ${c.route.shortName}`
  return `≈${c.walkToStopMinutes} min walk to stop · ${routes} · ≈${c.minutes} min to campus${c.transfer ? ', 1 transfer' : ''}`
}

/** Short form for cards: "≈9 min walk" / "≈18 min by bus" / "≈34 min by bus, 1 transfer" / "Transfer needed" */
export function shortCommute(c: Commute): string {
  if (c.mode === 'transfer') return 'Transfer needed'
  if (c.mode === 'walk') return `≈${c.minutes} min walk`
  return `≈${c.minutes} min by bus${c.transfer ? ', 1 transfer' : ''}`
}
