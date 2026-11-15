import { useEffect, useState } from 'react'
import { CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet'
import { CAMPUS } from '../data/campus'
import { STOPS } from '../data/transit'
import type { Listing } from '../data/types'
import type { Commute } from '../lib/commute'
import { labelsCrowd } from './mapShared'

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

  // When the stop is close on screen, the walk label would cover the "This place" pin: move it below the line.
  const map = useMap()
  const [crowded, setCrowded] = useState(false)
  const [homeLat, homeLng] = home
  const [toLat, toLng] = walkTo
  useEffect(() => {
    const measure = () => setCrowded(labelsCrowd(map.latLngToContainerPoint([homeLat, homeLng]), map.latLngToContainerPoint([toLat, toLng])))
    measure()
    map.on('zoomend', measure)
    return () => void map.off('zoomend', measure)
  }, [map, homeLat, homeLng, toLat, toLng])

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
        <Tooltip key={crowded ? 'below' : 'center'} permanent direction={crowded ? 'bottom' : 'center'} offset={crowded ? [0, 18] : [0, 0]}>
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
