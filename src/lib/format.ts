import type { Listing } from '../data/types'

/** '2027-01' → 'January 2027' */
export function formatMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
}

export function bedroomsLabel(l: Pick<Listing, 'bedrooms' | 'type'>): string {
  if (l.type === 'room') return 'Private bedroom'
  if (l.bedrooms === 0) return 'Studio'
  return `${l.bedrooms} bedroom${l.bedrooms === 1 ? '' : 's'}`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
