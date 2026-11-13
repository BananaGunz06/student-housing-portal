export type HousingType = 'room' | 'studio' | 'apartment' | 'basement' | 'house'

export interface LatLng {
  lat: number
  lng: number
}

export type PosterRole = 'landlord' | 'property-manager' | 'student-sublet'

/** Who posted a listing. Phone and email appear only if the poster chose to share them. */
export interface Poster {
  name: string
  role: PosterRole
  /** e.g. "Usually replies within a day". */
  replyTime: string
  phone?: string
  email?: string
}

export interface Listing {
  id: string
  title: string
  address: string
  neighbourhood: string
  type: HousingType
  /** Bedrooms you rent. A room in a shared house is 1, a studio is 0. */
  bedrooms: number
  bathrooms: number
  lat: number
  lng: number
  /** Advertised monthly rent in whole dollars. */
  rent: number
  utilitiesIncluded: boolean
  /** Monthly estimate, used only when utilities are not included. */
  utilitiesEstimate: number
  internetIncluded: boolean
  /** Monthly estimate, used only when internet is not included. */
  internetEstimate: number
  furnished: boolean
  leaseMonths: 4 | 8 | 12
  /** First month available, as YYYY-MM. */
  availableFrom: string
  included: string[]
  description: string
  poster: Poster
}

export interface Stop {
  id: string
  name: string
  lat: number
  lng: number
  /** Ids of the routes that serve this stop. */
  routes: string[]
  /** Typical scheduled minutes from this stop to the University Centre, per route id. */
  toCampus: Record<string, number>
  /** True for the University Centre platforms themselves. */
  campus?: boolean
  /** Best trip with one change of bus, present only when it beats every direct ride from this stop. */
  viaTransfer?: ViaTransfer
}

export interface ViaTransfer {
  /** Ride plus the change, in minutes. */
  minutes: number
  firstRoute: string
  secondRoute: string
  /** The stop where the second bus is boarded. */
  transferStop: { id: string; name: string }
  /** Where the first bus lets you off, when that is a different stop (a short walk away). */
  alightStop?: { id: string; name: string }
}

export interface Route {
  id: string
  /** The feed's code, e.g. "99", "50 U" or "IroHarv". */
  shortName: string
  longName: string
  /** What riders see: the number ("99", "50 U") or, for codes like "IroHarv", the long name. */
  label: string
  color: string
  /** One line per piece of the route (MultiLineString). */
  paths: LatLng[][]
}

export const HOUSING_TYPE_LABELS: Record<HousingType, string> = {
  room: 'Room in shared house',
  studio: 'Studio apartment',
  apartment: 'Apartment',
  basement: 'Basement apartment',
  house: 'Whole house',
}

export const POSTER_ROLE_LABELS: Record<PosterRole, string> = {
  landlord: 'Landlord',
  'property-manager': 'Property manager',
  'student-sublet': 'Student subletting',
}
