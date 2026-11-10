import type { Route, Stop } from '../types'
import routesRaw from './routes.geojson?raw'
import stopsRaw from './stops.geojson?raw'

interface PointFeature {
  properties: { id: string; name: string; routes: string[] }
  geometry: { coordinates: [number, number] }
}
interface LineFeature {
  properties: { id: string; name: string; color: string }
  geometry: { coordinates: [number, number][] }
}

/** Sample bus stops (hand-made, approximate — see README). */
export const STOPS: Stop[] = (
  JSON.parse(stopsRaw) as { features: PointFeature[] }
).features.map((f) => ({
  ...f.properties,
  lat: f.geometry.coordinates[1],
  lng: f.geometry.coordinates[0],
}))

/** Sample bus routes (hand-made, approximate — see README). */
export const ROUTES: Route[] = (
  JSON.parse(routesRaw) as { features: LineFeature[] }
).features.map((f) => ({
  ...f.properties,
  path: f.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
}))
