import type { Route, Stop, ViaTransfer } from '../types'
import metaRaw from './meta.json'
import routesRaw from './routes.geojson?raw'
import stopsRaw from './stops.geojson?raw'

interface PointFeature {
  properties: {
    id: string
    name: string
    routes: string[]
    toCampus: Record<string, number>
    campus?: boolean
    viaTransfer?: ViaTransfer
  }
  geometry: { coordinates: [number, number] }
}
interface LineFeature {
  properties: { id: string; shortName: string; longName: string; label: string; color: string }
  geometry: { coordinates: [number, number][][] }
}

/** Guelph Transit stops (GTFS, see meta.json). */
export const STOPS: Stop[] = (
  JSON.parse(stopsRaw) as { features: PointFeature[] }
).features.map((f) => ({
  ...f.properties,
  lat: f.geometry.coordinates[1],
  lng: f.geometry.coordinates[0],
}))

/** Guelph Transit routes (GTFS, see meta.json). */
export const ROUTES: Route[] = (
  JSON.parse(routesRaw) as { features: LineFeature[] }
).features.map((f) => ({
  ...f.properties,
  paths: f.geometry.coordinates.map((line) => line.map(([lng, lat]) => ({ lat, lng }))),
}))

export interface TransitMeta {
  schedule: string
  serviceStart: string
  serviceEnd: string
  source: string
  representativeDate: string
  generated: string
  note: string
}

export const TRANSIT_META: TransitMeta = metaRaw
