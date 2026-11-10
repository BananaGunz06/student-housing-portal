import listingsData from '../data/listings.json'
import type { Listing } from '../data/types'

/**
 * The only way screens get listings. Swap this module's internals for API
 * calls when a backend exists; screens stay unchanged.
 */
const LISTINGS = listingsData as Listing[]
const BY_ID = new Map(LISTINGS.map((l) => [l.id, l]))

export function getAll(): Listing[] {
  return LISTINGS
}

export function getById(id: string): Listing | undefined {
  return BY_ID.get(id)
}
