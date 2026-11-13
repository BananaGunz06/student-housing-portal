import { useState } from 'react'
import { CircleMarker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { ROUTES, STOPS } from '../data/transit'
import { stopLabel } from './mapShared'

/** Stops only appear once the map is zoomed in this far. */
const STOP_MIN_ZOOM = 15

function useZoom(): number {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  return zoom
}

// Built once: react-leaflet resets a Polyline whenever its positions array changes identity.
const ROUTE_LINES = ROUTES.map((r) => ({
  route: r,
  positions: r.paths.map((path) => path.map((p) => [p.lat, p.lng] as [number, number])),
}))
/** Guelph Transit routes as thin coloured lines, and stops as dots when zoomed in. */
export default function TransitLayer({ highlightRoute }: { highlightRoute?: string }) {
  const zoom = useZoom()
  return (
    <>
      {ROUTE_LINES.map(({ route: r, positions }) => (
        <Polyline
          key={r.id}
          positions={positions}
          pathOptions={{
            color: r.color,
            weight: highlightRoute === r.id ? 5 : 3,
            opacity: highlightRoute && highlightRoute !== r.id ? 0.2 : 0.65,
          }}
        />
      ))}
      {zoom >= STOP_MIN_ZOOM &&
        STOPS.map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={4}
            pathOptions={{ color: '#1c2a35', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }}
          >
            <Tooltip>{stopLabel(s)}</Tooltip>
          </CircleMarker>
        ))}
    </>
  )
}
