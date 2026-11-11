import { useState } from 'react'
import { CircleMarker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { ROUTES, STOPS } from '../data/transit'

/** Stops only appear once the map is zoomed in this far. */
const STOP_MIN_ZOOM = 15

function useZoom(): number {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  return zoom
}

/** Guelph Transit routes as thin coloured lines, and stops as dots when zoomed in. */
export default function TransitLayer({ highlightRoute }: { highlightRoute?: string }) {
  const zoom = useZoom()
  return (
    <>
      {ROUTES.map((r) => (
        <Polyline
          key={r.id}
          positions={r.paths.map((path) => path.map((p) => [p.lat, p.lng] as [number, number]))}
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
            <Tooltip>{s.name}</Tooltip>
          </CircleMarker>
        ))}
    </>
  )
}
