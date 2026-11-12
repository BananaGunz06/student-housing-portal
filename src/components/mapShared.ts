import L from 'leaflet'
import { CAMPUS } from '../data/campus'
import { STOPS, TRANSIT_META } from '../data/transit'
import type { Listing } from '../data/types'
import type { Commute } from '../lib/commute'

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Transit data: ' +
  `<a href="${TRANSIT_META.source}" target="_blank" rel="noopener">City of Guelph</a>`

export const campusIcon = L.divIcon({
  className: 'campus-icon',
  html: CAMPUS.shortName,
  iconSize: [48, 28],
  iconAnchor: [24, 14],
})

export const homeIcon = L.divIcon({
  className: 'pin-icon',
  html: '<span class="pin pin--home">This place</span>',
  iconSize: [0, 0],
})

type Pt = [number, number]

/** The points a listing's commute touches, for fitting a map around it. */
export function commutePoints(listing: Listing, commute: Commute): Pt[] {
  const campus: Pt = [CAMPUS.lat, CAMPUS.lng]
  const walkTo: Pt = commute.mode === 'bus' ? [commute.stop.lat, commute.stop.lng] : campus
  const transferStop =
    commute.mode === 'bus' && commute.transfer ? STOPS.find((s) => s.id === commute.transfer!.stop.id) : undefined
  const alightId = commute.mode === 'bus' ? commute.transfer?.alightStop?.id : undefined
  const alightStop = alightId ? STOPS.find((s) => s.id === alightId) : undefined
  return [
    [listing.lat, listing.lng],
    walkTo,
    campus,
    ...(transferStop ? [[transferStop.lat, transferStop.lng] as Pt] : []),
    ...(alightStop ? [[alightStop.lat, alightStop.lng] as Pt] : []),
  ]
}
