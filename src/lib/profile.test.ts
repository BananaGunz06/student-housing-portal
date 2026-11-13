import { describe, expect, test } from 'vitest'
import { profileSummary, termLabel, upcomingTerms, validateDetails } from './profile'

const empty = { bio: '', program: '', year: null, moveInTerm: null, budget: null, lookingForRoommates: false }

describe('upcomingTerms', () => {
  test('starts with the term after today and gives six', () => {
    expect(upcomingTerms(new Date('2026-11-12')).map((t) => t.value)).toEqual([
      '2027-winter', '2027-summer', '2027-fall', '2028-winter', '2028-summer', '2028-fall',
    ])
  })
  test('in April the next term is this summer', () => {
    expect(upcomingTerms(new Date('2026-04-30'))[0]).toEqual({ value: '2026-summer', label: 'Summer 2026' })
  })
  test('honours the count', () => {
    expect(upcomingTerms(new Date('2026-11-12'), 2)).toHaveLength(2)
  })
})

test('termLabel', () => {
  expect(termLabel('2027-fall')).toBe('Fall 2027')
})

describe('validateDetails', () => {
  test('accepts all-empty', () => expect(validateDetails(empty)).toEqual({}))
  test('rejects a long bio and program', () => {
    const e = validateDetails({ ...empty, bio: 'a'.repeat(301), program: 'b'.repeat(81) })
    expect(e.bio).toBe('Keep your bio to 300 characters.')
    expect(e.program).toBe('Keep your program to 80 characters.')
    expect(validateDetails({ ...empty, bio: 'a'.repeat(300), program: 'b'.repeat(80) })).toEqual({})
  })
  test.each([299, 5001, 650.5])('rejects budget %s', (budget) => {
    expect(validateDetails({ ...empty, budget }).budget).toBe('Enter a whole number from $300 to $5000.')
  })
  test.each([300, 5000])('accepts budget %s', (budget) => {
    expect(validateDetails({ ...empty, budget })).toEqual({})
  })
})

describe('profileSummary', () => {
  test('both', () => expect(profileSummary({ program: 'Biology', year: '2' })).toBe('Biology · 2nd year'))
  test('either alone', () => {
    expect(profileSummary({ program: 'Biology', year: null })).toBe('Biology')
    expect(profileSummary({ program: '', year: 'grad' })).toBe('Graduate')
  })
  test('neither', () => expect(profileSummary({ program: ' ', year: null })).toBe(''))
})
