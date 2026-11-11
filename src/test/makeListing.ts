import type { Listing } from '../data/types'

/** A listing right next to campus, overridable per test. */
export function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'test-1',
    title: 'Test room',
    address: '1 Test St, Guelph',
    neighbourhood: 'Old University',
    type: 'room',
    bedrooms: 1,
    bathrooms: 1,
    lat: 43.532,
    lng: -80.2262,
    rent: 700,
    utilitiesIncluded: true,
    utilitiesEstimate: 0,
    internetIncluded: true,
    internetEstimate: 0,
    furnished: false,
    leaseMonths: 12,
    availableFrom: '2027-01',
    included: [],
    description: '',
    poster: { name: 'Sam K.', role: 'landlord', replyTime: 'Usually replies within a day' },
    ...overrides,
  }
}
