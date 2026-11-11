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

/** ISO timestamp → 'Nov 11' (adds the year when it isn't this year). */
export function formatDay(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  })
}

/** ISO timestamp → 'Nov 11, 2:05 p.m.' */
export function formatSent(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${formatDay(iso, now)}, ${d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}`
}
