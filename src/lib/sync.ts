import type { HousingType } from '../data/types'
import type { CloudState } from './backend/types'
import { DEFAULT_FILTERS, type Filters } from './filters'
import { getById } from './listingsRepo'
import { isMessage, isValidEmail, type Message } from './messages'

export const EMPTY_CLOUD: CloudState = { budget: null, filters: null, savedIds: [], messages: [] }

const TYPES: readonly string[] = ['room', 'studio', 'apartment', 'basement', 'house']
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function cleanFilters(raw: unknown): Filters | null {
  if (!isObj(raw)) return null
  const f: Filters = { ...DEFAULT_FILTERS, types: [] }
  if (raw.bedrooms === 'any' || raw.bedrooms === 0 || raw.bedrooms === 1 || raw.bedrooms === 2 || raw.bedrooms === 3) {
    f.bedrooms = raw.bedrooms
  }
  if (Array.isArray(raw.types)) {
    f.types = raw.types.filter((t): t is HousingType => typeof t === 'string' && TYPES.includes(t))
  }
  if (typeof raw.furnishedOnly === 'boolean') f.furnishedOnly = raw.furnishedOnly
  if (raw.maxCommute === null || (typeof raw.maxCommute === 'number' && Number.isFinite(raw.maxCommute))) {
    f.maxCommute = raw.maxCommute
  }
  if (raw.moveIn === null || (typeof raw.moveIn === 'string' && /^\d{4}-\d{2}$/.test(raw.moveIn))) f.moveIn = raw.moveIn
  if (typeof raw.showOver === 'boolean') f.showOver = raw.showOver
  return f
}

/** Tolerates anything; keeps only what is valid and still points at a real listing. */
export function cleanCloudState(raw: unknown): CloudState {
  if (!isObj(raw)) return { ...EMPTY_CLOUD, savedIds: [], messages: [] }
  const budget =
    typeof raw.budget === 'number' && Number.isFinite(raw.budget) && raw.budget >= 300 && raw.budget <= 5000
      ? Math.round(raw.budget)
      : null
  const savedIds = Array.isArray(raw.savedIds)
    ? [...new Set(raw.savedIds.filter((id): id is string => typeof id === 'string' && !!getById(id)))]
    : []
  const messages = Array.isArray(raw.messages) ? raw.messages.filter((m): m is Message => isMessage(m) && !!getById(m.listingId)) : []
  return { budget, filters: cleanFilters(raw.filters), savedIds, messages }
}

/** Combine what this device has with what the account has. The account wins when it has a budget. */
export function mergeStates(device: CloudState, account: CloudState): CloudState {
  const useAccount = account.budget !== null
  const byId = new Map<string, Message>()
  for (const m of [...account.messages, ...device.messages]) if (!byId.has(m.id)) byId.set(m.id, m)
  return {
    budget: useAccount ? account.budget : device.budget,
    filters: useAccount ? (account.filters ?? device.filters) : device.filters,
    savedIds: [...new Set([...account.savedIds, ...device.savedIds])],
    messages: [...byId.values()].sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
  }
}

export function validateSignUp(
  name: string,
  email: string,
  password: string,
): Partial<Record<'name' | 'email' | 'password', string>> {
  const errors: Partial<Record<'name' | 'email' | 'password', string>> = {}
  const n = name.trim()
  if (!n) errors.name = 'Enter your name.'
  else if (n.length > 80) errors.name = 'Keep your name under 80 characters.'
  if (!isValidEmail(email)) errors.email = 'Enter an email like name@example.com.'
  if (password.length < 8) errors.password = 'Use at least 8 characters.'
  return errors
}
