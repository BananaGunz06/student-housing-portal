import L from 'leaflet'
import { CAMPUS } from '../data/campus'

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

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
