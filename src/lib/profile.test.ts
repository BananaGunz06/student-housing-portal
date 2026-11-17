import { describe, expect, test } from 'vitest'
import { profileSummary, termLabel, termOfMonth, termStartMonthName, termOptionsWith, upcomingTerms, validateDetails } from './profile'

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

describe('termOptionsWith', () => {
  const terms = upcomingTerms(new Date('2026-11-12'))
  const values = (list: { value: string }[]) => list.map((t) => t.value)

  test('a far-future stored term goes last', () => {
    const out = termOptionsWith(terms, '2031-winter')
    expect(values(out)).toEqual([...values(terms), '2031-winter'])
    expect(out.at(-1)).toEqual({ value: '2031-winter', label: 'Winter 2031' })
  })
  test('a past stored term goes first', () => {
    expect(values(termOptionsWith(terms, '2025-fall'))).toEqual(['2025-fall', ...values(terms)])
  })
  test('a stored term between the options goes in date order', () => {
    const gap = terms.filter((t) => t.value !== '2028-winter')
    expect(values(termOptionsWith(gap, '2028-winter'))).toEqual(values(terms))
  })
  test('seasons order winter, summer, fall within a year', () => {
    const out = termOptionsWith([{ value: '2027-winter', label: 'Winter 2027' }, { value: '2027-fall', label: 'Fall 2027' }], '2027-summer')
    expect(values(out)).toEqual(['2027-winter', '2027-summer', '2027-fall'])
  })
  test('a present term or null leaves the list unchanged', () => {
    expect(termOptionsWith(terms, terms[2].value)).toEqual(terms)
    expect(termOptionsWith(terms, null)).toEqual(terms)
  })
})

describe('termOfMonth', () => {
  test.each([
    ['2027-01', '2027-winter'],
    ['2027-04', '2027-winter'],
    ['2027-05', '2027-summer'],
    ['2027-08', '2027-summer'],
    ['2027-09', '2027-fall'],
    ['2027-12', '2027-fall'],
  ])('%s is %s', (month, term) => {
    expect(termOfMonth(month)).toBe(term)
  })
})

test('termStartMonthName', () => {
  expect(termStartMonthName('2027-winter')).toBe('January')
  expect(termStartMonthName('2027-summer')).toBe('May')
  expect(termStartMonthName('2027-fall')).toBe('September')
})
