import { CircleMarker, Polyline, Tooltip } from 'react-leaflet'
import { CAMPUS } from '../data/campus'
import { STOPS } from '../data/transit'
import type { Listing } from '../data/types'
import type { Commute } from '../lib/commute'

type Pt = [number, number]

/**
 * Inside a Leaflet map: the dashed walk from the listing to its stop (or campus),
 * the bus route(s), the stop and the change-buses stop. The campus and home markers are the map's own.
 */
export default function CommuteLayers({ listing, commute }: { listing: Listing; commute: Commute }) {
  const home: Pt = [listing.lat, listing.lng]
  const campus: Pt = [CAMPUS.lat, CAMPUS.lng]
  const walkTo: Pt = commute.mode === 'bus' ? [commute.stop.lat, commute.stop.lng] : campus
  const walkMin = commute.mode === 'bus' ? commute.walkToStopMinutes : commute.minutes
  const transferStop =
    commute.mode === 'bus' && commute.transfer
      ? STOPS.find((s) => s.id === commute.transfer!.stop.id)
      : undefined
  const transferPt: Pt | null = transferStop ? [transferStop.lat, transferStop.lng] : null
  const alightId = commute.mode === 'bus' ? commute.transfer?.alightStop?.id : undefined
  const alightStop = alightId ? STOPS.find((s) => s.id === alightId) : undefined
  const alightPt: Pt | null = alightStop ? [alightStop.lat, alightStop.lng] : null

  return (
    <>
      {commute.mode === 'bus' &&
        [commute.route, commute.transfer?.secondRoute].map(
          (r) =>
            r && (
              <Polyline
                key={r.id}
                positions={r.paths.map((path) => path.map((p) => [p.lat, p.lng] as Pt))}
                pathOptions={{ color: r.color, weight: 5, opacity: 0.85 }}
              />
            ),
        )}
      {transferPt && alightPt && (
        <Polyline
          positions={[alightPt, transferPt]}
          pathOptions={{ color: '#1c2a35', weight: 3, dashArray: '2 6', lineCap: 'round' }}
        />
      )}
      {alightPt && (
        <CircleMarker
          center={alightPt}
          radius={5}
          pathOptions={{ color: '#1c2a35', weight: 3, fillColor: '#ffffff', fillOpacity: 1 }}
        >
          <Tooltip>Get off: {commute.mode === 'bus' && commute.transfer?.alightStop?.name}</Tooltip>
        </CircleMarker>
      )}
      {transferPt && (
        <CircleMarker
          center={transferPt}
          radius={7}
          pathOptions={{ color: '#1c2a35', weight: 3, fillColor: '#ffffff', fillOpacity: 1 }}
        >
          <Tooltip>{alightPt ? 'Board the second bus: ' : 'Change buses: '}{commute.mode === 'bus' && commute.transfer?.stop.name}</Tooltip>
        </CircleMarker>
      )}
      <Polyline
        positions={[home, walkTo]}
        pathOptions={{ color: '#1c2a35', weight: 4, dashArray: '2 9', lineCap: 'round' }}
      >
        <Tooltip permanent direction="center">
          ≈{walkMin} min walk
        </Tooltip>
      </Polyline>
      {commute.mode === 'bus' && (
        <CircleMarker
          center={walkTo}
          radius={8}
          pathOptions={{ color: '#1c2a35', weight: 3, fillColor: '#f1e84a', fillOpacity: 1 }}
        >
          <Tooltip>{commute.stop.name}</Tooltip>
        </CircleMarker>
      )}
    </>
  )
}
