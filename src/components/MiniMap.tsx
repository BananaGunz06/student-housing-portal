import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet'
import { CAMPUS } from '../data/campus'
import type { Listing } from '../data/types'
import type { Commute } from '../lib/commute'
import CommuteLayers from './CommuteLayers'
import { campusIcon, commutePoints, homeIcon, TILE_ATTRIBUTION, TILE_URL } from './mapShared'

/** The listing, its nearest stop with a dashed walking line, the route, and campus. */
export default function MiniMap({ listing, commute }: { listing: Listing; commute: Commute }) {
  return (
    <MapContainer
      bounds={commutePoints(listing, commute)}
      boundsOptions={{ paddingTopLeft: [40, 64], paddingBottomRight: [40, 32] }}
      zoomControl={false}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <CommuteLayers listing={listing} commute={commute} />
      <Marker position={[CAMPUS.lat, CAMPUS.lng]} icon={campusIcon} alt={CAMPUS.name}>
        <Tooltip>{CAMPUS.name}</Tooltip>
      </Marker>
      <Marker position={[listing.lat, listing.lng]} icon={homeIcon} zIndexOffset={1000} alt={listing.title} />
    </MapContainer>
  )
}
