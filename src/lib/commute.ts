import { CAMPUS } from '../data/campus'
import { ROUTES, STOPS } from '../data/transit'
import type { LatLng, Route, Stop } from '../data/types'

/** Straight-line walking is about 30% shorter than real streets. */
const DETOUR_FACTOR = 1.3
const WALK_M_PER_MIN = 80
/** About 20 km/h average bus speed including stops. */
const BUS_M_PER_MIN = 330
/** Under this many minutes, walking is the obvious choice. */
const ALWAYS_WALK_MIN = 15

export type Commute =
  | { mode: 'walk'; minutes: number }
  | {
      mode: 'bus'
      minutes: number
      walkToStopMinutes: number
      stop: Stop
      route: Route
      busMinutes: number
    }

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

function nearestVertex(path: LatLng[], p: LatLng): number {
  let best = 0
  let bestD = Infinity
  path.forEach((v, i) => {
    const d = distanceMeters(v, p)
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

/** Distance travelled along a route line between the vertices nearest a and b. */
export function alongRouteMeters(path: LatLng[], a: LatLng, b: LatLng): number {
  const i = nearestVertex(path, a)
  const j = nearestVertex(path, b)
  let total = 0
  for (let k = Math.min(i, j); k < Math.max(i, j); k++) {
    total += distanceMeters(path[k], path[k + 1])
  }
  return total
}

/** Estimated door-to-campus commute: walk, or walk to a stop and ride. */
export function campusCommute(
  p: LatLng,
  stops: Stop[] = STOPS,
  routes: Route[] = ROUTES,
  campus: LatLng = CAMPUS,
): Commute {
  const walk = walkMinutes(distanceMeters(p, campus))
  let best: Extract<Commute, { mode: 'bus' }> | null = null
  for (const route of routes) {
    const onRoute = stops.filter((s) => s.routes.includes(route.id))
    if (onRoute.length === 0) continue
    const { stop, meters } = nearestStop(p, onRoute)
    const walkToStopMinutes = walkMinutes(meters)
    const busMinutes = Math.ceil(
      alongRouteMeters(route.path, stop, campus) / BUS_M_PER_MIN,
    )
    const minutes = walkToStopMinutes + busMinutes
    if (!best || minutes < best.minutes) {
      best = { mode: 'bus', minutes, walkToStopMinutes, stop, route, busMinutes }
    }
  }
  if (!best || walk <= ALWAYS_WALK_MIN || walk <= best.minutes) {
    return { mode: 'walk', minutes: walk }
  }
  return best
}

/** "≈4 min walk to stop · Route 99 · ≈12 min to campus" */
export function describeCommute(c: Commute): string {
  if (c.mode === 'walk') return `≈${c.minutes} min walk to campus`
  return `≈${c.walkToStopMinutes} min walk to stop · ${c.route.name.replace(/^(Route \d+).*/, '$1')} · ≈${c.minutes} min to campus`
}

/** Short form for cards: "≈9 min walk" / "≈18 min by bus" */
export function shortCommute(c: Commute): string {
  return c.mode === 'walk' ? `≈${c.minutes} min walk` : `≈${c.minutes} min by bus`
}
