import { CircleMarker, Polyline, Tooltip } from 'react-leaflet'
import { ROUTES, STOPS } from '../data/transit'

/** Sample bus routes as coloured lines and stops as dots. */
export default function TransitLayer({ highlightRoute }: { highlightRoute?: string }) {
  return (
    <>
      {ROUTES.map((r) => (
        <Polyline
          key={r.id}
          positions={r.path.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{
            color: r.color,
            weight: highlightRoute === r.id ? 6 : 4,
            opacity: highlightRoute && highlightRoute !== r.id ? 0.25 : 0.75,
          }}
        >
          <Tooltip sticky>{r.name}</Tooltip>
        </Polyline>
      ))}
      {STOPS.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.lat, s.lng]}
          radius={4}
          pathOptions={{ color: '#1c2a35', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }}
        >
          <Tooltip>
            {s.name} (Route {s.routes.join(', ')})
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  )
}
