import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS } from './filters'
import type { Message } from './messages'
import { cleanCloudState, EMPTY_CLOUD, threeWayMerge, validateSignUp } from './sync'
import type { CloudState } from './backend/types'

const msg = (id: string, sentAt: string, listingId = 'gue-001'): Message => ({ id, listingId, sentAt, body: 'hi', shared: {} })
const merge = (d: CloudState, a: CloudState) => threeWayMerge(EMPTY_CLOUD, d, a)
const state = (o: Partial<CloudState> = {}): CloudState => ({ ...EMPTY_CLOUD, ...o })

describe('threeWayMerge with no history', () => {
  it('takes device budget and filters when the account is empty', () => {
    const f = { ...DEFAULT_FILTERS, furnishedOnly: true }
    const r = merge(state({ budget: 900, filters: f }), state())
    expect(r.budget).toBe(900)
    expect(r.filters).toEqual(f)
  })
  it('keeps the account budget and filters when it has a budget', () => {
    const af = { ...DEFAULT_FILTERS, showOver: true }
    const r = merge(state({ budget: 900, filters: DEFAULT_FILTERS }), state({ budget: 700, filters: af }))
    expect(r.budget).toBe(700)
    expect(r.filters).toEqual(af)
  })
  it('falls back to device filters when account filters are null', () => {
    const df = { ...DEFAULT_FILTERS, furnishedOnly: true }
    expect(merge(state({ filters: df }), state({ budget: 700 })).filters).toEqual(df)
  })
  it('unions saved ids, account first, without duplicates', () => {
    const r = merge(state({ savedIds: ['b', 'c'] }), state({ savedIds: ['a', 'b'] }))
    expect(r.savedIds).toEqual(['a', 'b', 'c'])
  })
  it('unions messages by id, sorted by sentAt', () => {
    const r = merge(
      state({ messages: [msg('2', '2026-01-02'), msg('1', '2026-01-01')] }),
      state({ messages: [msg('2', '2026-01-02'), msg('3', '2026-01-03')] }),
    )
    expect(r.messages.map((m) => m.id)).toEqual(['1', '2', '3'])
  })
})

describe('threeWayMerge against a synced copy', () => {
  const base = state({ budget: 800, filters: DEFAULT_FILTERS, savedIds: ['a', 'b'] })
  it('propagates a removal made on this device', () => {
    const r = threeWayMerge(base, state({ ...base, savedIds: ['a'] }), state({ ...base }))
    expect(r.savedIds).toEqual(['a'])
  })
  it('keeps a removal made on another device', () => {
    const r = threeWayMerge(base, state({ ...base }), state({ ...base, savedIds: ['a'] }))
    expect(r.savedIds).toEqual(['a'])
  })
  it('keeps places added here and on the account', () => {
    const r = threeWayMerge(base, state({ ...base, savedIds: ['a', 'b', 'c'] }), state({ ...base, savedIds: ['a', 'b', 'd'] }))
    expect(r.savedIds).toEqual(['a', 'b', 'd', 'c'])
  })
  it('lets a budget changed here win, and takes the account budget otherwise', () => {
    expect(threeWayMerge(base, state({ ...base, budget: 900 }), state({ ...base, budget: 700 })).budget).toBe(900)
    expect(threeWayMerge(base, state({ ...base }), state({ ...base, budget: 700 })).budget).toBe(700)
  })
  it('does not bring back messages the account no longer has', () => {
    const m = msg('1', '2026-01-01')
    const r = threeWayMerge(state({ messages: [m] }), state({ messages: [m] }), state())
    expect(r.messages).toEqual([])
  })
})

describe('cleanCloudState', () => {
  it('returns safe defaults for junk', () => {
    for (const junk of [null, 'x', 5, undefined, [], { filters: 5 }]) {
      expect(cleanCloudState(junk)).toEqual(EMPTY_CLOUD)
    }
  })
  it('validates budget range and rounds', () => {
    expect(cleanCloudState({ budget: 299 }).budget).toBeNull()
    expect(cleanCloudState({ budget: 5001 }).budget).toBeNull()
    expect(cleanCloudState({ budget: '800' }).budget).toBeNull()
    expect(cleanCloudState({ budget: 800.6 }).budget).toBe(801)
  })
  it('merges filters over defaults keeping valid known keys only', () => {
    const r = cleanCloudState({ filters: { furnishedOnly: true, bedrooms: 9, bogus: 1, maxCommute: 20 } })
    expect(r.filters).toEqual({ ...DEFAULT_FILTERS, furnishedOnly: true, maxCommute: 20 })
  })
  it('drops unknown listings, duplicates and bad messages', () => {
    const r = cleanCloudState({
      savedIds: ['gue-001', 'gue-001', 'nope', 7],
      messages: [msg('1', '2026-01-01'), msg('2', '2026-01-01', 'nope'), { id: 3 }],
    })
    expect(r.savedIds).toEqual(['gue-001'])
    expect(r.messages.map((m) => m.id)).toEqual(['1'])
  })
})

describe('validateSignUp', () => {
  it('returns nothing when valid', () => {
    expect(validateSignUp(' Sam ', 'sam@example.com', 'password1')).toEqual({})
  })
  it('flags each field', () => {
    expect(validateSignUp('  ', 'nope', '1234567')).toEqual({
      name: 'Enter your name.',
      email: 'Enter an email like name@example.com.',
      password: 'Use at least 8 characters.',
    })
  })
  it('limits name length', () => {
    expect(validateSignUp('a'.repeat(81), 'a@b.co', 'password1').name).toBe('Keep your name under 80 characters.')
  })
})
