import type { Listing, Poster } from '../data/types'
import { formatMonth } from './format'

/**
 * Messages a student sends to a poster. In this demo they are saved on the
 * student's device only; a backend would deliver them and add replies.
 */

/** What the student chose to share with the poster. Blank fields are left out. */
export interface SharedDetails {
  name?: string
  phone?: string
  email?: string
  other?: string
}

export interface Message {
  id: string
  listingId: string
  /** ISO timestamp. */
  sentAt: string
  body: string
  shared: SharedDetails
}

/** The message form, as typed. */
export interface Draft {
  body: string
  name: string
  phone: string
  email: string
  other: string
}

export const EMPTY_DRAFT: Draft = { body: '', name: '', phone: '', email: '', other: '' }
export const MAX_BODY = 1000

export type DraftErrors = Partial<Record<'body' | 'phone' | 'email', string>>

const digits = (s: string) => s.replace(/\D/g, '')

export function isValidPhone(s: string): boolean {
  // Only separators people normally type, then 10 digits (or 11 starting with 1).
  if (!/^\+?[\d\s().-]+$/.test(s.trim())) return false
  const d = digits(s)
  return d.length === 10 || (d.length === 11 && d.startsWith('1'))
}

export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

export function validateDraft(d: Draft): DraftErrors {
  const errors: DraftErrors = {}
  const body = d.body.trim()
  if (!body) errors.body = 'Write a message to send.'
  else if (body.length > MAX_BODY) errors.body = `Keep it under 1,000 characters (it’s ${body.length.toLocaleString('en-CA')}).`
  if (d.phone.trim() && !isValidPhone(d.phone)) errors.phone = 'Enter a 10-digit phone number, or leave it blank.'
  if (d.email.trim() && !isValidEmail(d.email)) errors.email = 'Enter an email like name@example.com, or leave it blank.'
  return errors
}

/** Only what the student filled in, trimmed. */
export function sharedFrom(d: Pick<Draft, keyof SharedDetails>): SharedDetails {
  const out: SharedDetails = {}
  for (const k of ['name', 'phone', 'email', 'other'] as const) {
    const v = d[k].trim()
    if (v) out[k] = v
  }
  return out
}

/** "Sam" for "Sam K.", the full name for a company. */
export function greetingName(p: Poster): string {
  return p.role === 'property-manager' ? p.name : p.name.split(' ')[0]
}

export function starterMessage(l: Listing): string {
  const hi = l.poster.role === 'property-manager' ? 'Hi there' : `Hi ${greetingName(l.poster)}`
  const place = l.title.charAt(0).toLowerCase() + l.title.slice(1)
  return `${hi}, is the ${place} still available from ${formatMonth(l.availableFrom)}? `
}

/** Value for a tel: or sms: link. */
export function phoneHref(phone: string): string {
  const d = digits(phone)
  return `+${d.length === 10 ? `1${d}` : d}`
}

export interface Conversation {
  listingId: string
  messages: Message[]
  last: Message
}

/** One conversation per listing: newest conversation first, messages oldest first. */
export function conversations(messages: Message[]): Conversation[] {
  const byListing = new Map<string, Message[]>()
  for (const m of [...messages].sort((a, b) => a.sentAt.localeCompare(b.sentAt))) {
    byListing.set(m.listingId, [...(byListing.get(m.listingId) ?? []), m])
  }
  return [...byListing.entries()]
    .map(([listingId, ms]) => ({ listingId, messages: ms, last: ms[ms.length - 1] }))
    .sort((a, b) => b.last.sentAt.localeCompare(a.last.sentAt))
}

const isStr = (v: unknown) => typeof v === 'string'

/** Guards data read back from storage. */
export function isMessage(v: unknown): v is Message {
  if (!v || typeof v !== 'object') return false
  const m = v as Record<string, unknown>
  if (!isStr(m.id) || !isStr(m.listingId) || !isStr(m.sentAt) || !isStr(m.body)) return false
  if (!m.shared || typeof m.shared !== 'object') return false
  return Object.values(m.shared).every(isStr)
}

let counter = 0
export function newMessageId(): string {
  return `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
