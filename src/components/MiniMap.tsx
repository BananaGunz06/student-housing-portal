import 'leaflet/dist/leaflet.css'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet'
import { CAMPUS } from '../data/campus'
import type { Listing } from '../data/types'
import type { Commute } from '../lib/commute'
import { campusIcon, homeIcon, TILE_ATTRIBUTION, TILE_URL } from './mapShared'
import TransitLayer from './TransitLayer'

type Pt = [number, number]

/** The listing, its nearest stop with a dashed walking line, the route, and campus. */
export default function MiniMap({ listing, commute }: { listing: Listing; commute: Commute }) {
  const home: Pt = [listing.lat, listing.lng]
  const campus: Pt = [CAMPUS.lat, CAMPUS.lng]
  const walkTo: Pt = commute.mode === 'bus' ? [commute.stop.lat, commute.stop.lng] : campus
  const walkMin = commute.mode === 'bus' ? commute.walkToStopMinutes : commute.minutes

  return (
    <MapContainer
      bounds={[home, walkTo, campus]}
      boundsOptions={{ paddingTopLeft: [40, 64], paddingBottomRight: [40, 32] }}
      zoomControl={false}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <TransitLayer highlightRoute={commute.mode === 'bus' ? commute.route.id : 'none'} />
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
      <Marker position={campus} icon={campusIcon} alt={CAMPUS.name}>
        <Tooltip>{CAMPUS.name}</Tooltip>
      </Marker>
      <Marker position={home} icon={homeIcon} zIndexOffset={1000} alt={listing.title} />
    </MapContainer>
  )
}
