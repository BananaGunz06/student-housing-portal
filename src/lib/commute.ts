import { CAMPUS } from '../data/campus'
import { ROUTES, STOPS } from '../data/transit'
import type { LatLng, Route, Stop } from '../data/types'

/** Straight-line walking is about 30% shorter than real streets. */
const DETOUR_FACTOR = 1.3
const WALK_M_PER_MIN = 80
/** Under this many minutes, walking is the obvious choice. */
const ALWAYS_WALK_MIN = 15
/** Only stops within this many minutes' walk count as a way onto the bus. */
const MAX_WALK_TO_STOP_MIN = 15

export type BusCommute = {
      mode: 'bus'
      minutes: number
      walkToStopMinutes: number
      stop: Stop
      route: Route
      /** Ride time; with a transfer, ride plus the change. */
      rideMinutes: number
      /** Present when the trip changes buses once; `route` is then the first bus. */
      transfer?: {
        secondRoute: Route
        /** Where you board the second bus. */
        stop: { id: string; name: string }
        /** Where the first bus lets you off, when it is a different stop nearby. */
        alightStop?: { id: string; name: string }
      }
    }

export type Commute =
  /** `noBusNearby`: no stop within walking range has a ride to campus, so walking is the only estimate. */
  | { mode: 'walk'; minutes: number; noBusNearby?: true }
  | BusCommute

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
 * Estimated door-to-campus commute: walk, or walk to a stop within 15 minutes
 * and ride its scheduled time (direct, or with one change of bus), whichever
 * total is smallest. With no such stop the walk is returned, flagged `noBusNearby`.
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
        options.push({ route, rideMinutes: via.minutes, transfer: { secondRoute, stop: via.transferStop, ...(via.alightStop && { alightStop: via.alightStop }) } })
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
  if (walk <= ALWAYS_WALK_MIN) return { mode: 'walk', minutes: walk }
  if (!best) return { mode: 'walk', minutes: walk, noBusNearby: true }
  return walk <= best.minutes ? { mode: 'walk', minutes: walk } : best
}

function compareRoutes(a: Route, b: Route, order: Map<string, number>): number {
  return a.shortName.localeCompare(b.shortName, undefined, { numeric: true }) ||
    (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
}

/** Door-to-campus minutes. */
export function commuteMinutes(c: Commute): number {
  return c.minutes
}

/** "≈4 min walk to stop · Route 99 · ≈12 min to campus" / "… · Route 2 then Route 99 (change at X) · ≈34 min to campus, 1 transfer" */
export function describeCommute(c: Commute): string {
  if (c.mode === 'walk') return `≈${c.minutes} min walk to campus${c.noBusNearby ? ' (no bus nearby)' : ''}`
  const routes = c.transfer
    ? `Route ${c.route.label} then Route ${c.transfer.secondRoute.label} (change at ${c.transfer.stop.name})`
    : `Route ${c.route.label}`
  return `≈${c.walkToStopMinutes} min walk to stop · ${routes} · ≈${c.minutes} min to campus${c.transfer ? ', 1 transfer' : ''}`
}

/**
 * Short form: "≈9 min walk" / "≈18 min by bus" / "≈34 min by bus, 1 transfer".
 * With `toCampus`: "≈9 min walk to campus" / "≈18 min by bus to campus" / "≈34 min by bus to campus, 1 transfer".
 */
export function shortCommute(c: Commute, opts: { toCampus?: boolean } = {}): string {
  const to = opts.toCampus ? ' to campus' : ''
  if (c.mode === 'walk') return `≈${c.minutes} min walk${to}`
  return `≈${c.minutes} min by bus${to}${c.transfer ? ', 1 transfer' : ''}`
}
