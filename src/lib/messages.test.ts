import { describe, expect, test } from 'vitest'
import { makeListing } from '../test/makeListing'
import {
  EMPTY_DRAFT,
  MAX_BODY,
  conversations,
  greetingName,
  isMessage,
  phoneHref,
  sharedFrom,
  starterMessage,
  validateDraft,
  type Message,
} from './messages'

const draft = (patch: Partial<typeof EMPTY_DRAFT>) => ({ ...EMPTY_DRAFT, body: 'Hi, is it still available?', ...patch })

describe('validateDraft', () => {
  test('a message with no optional details is fine', () => {
    expect(validateDraft(draft({}))).toEqual({})
  })

  test('the message is required', () => {
    expect(validateDraft(draft({ body: '' })).body).toBe('Write a message to send.')
    expect(validateDraft(draft({ body: '   \n ' })).body).toBe('Write a message to send.')
  })

  test('the message has a length limit', () => {
    expect(validateDraft(draft({ body: 'a'.repeat(MAX_BODY) })).body).toBeUndefined()
    expect(validateDraft(draft({ body: 'a'.repeat(MAX_BODY + 1) })).body).toMatch(/1,000 characters/)
  })

  test.each(['519-555-0123', '(519) 555 0123', '+1 519.555.0123', '5195550123'])('accepts phone %s', (phone) => {
    expect(validateDraft(draft({ phone })).phone).toBeUndefined()
  })

  test.each(['555-0123', '519-555-01234567', 'call me', '519-555-01x3'])('rejects phone %s', (phone) => {
    expect(validateDraft(draft({ phone })).phone).toBe('Enter a 10-digit phone number, or leave it blank.')
  })

  test('checks email only when one is given', () => {
    expect(validateDraft(draft({ email: '  ' })).email).toBeUndefined()
    expect(validateDraft(draft({ email: 'me@uoguelph.ca' })).email).toBeUndefined()
    expect(validateDraft(draft({ email: 'me@' })).email).toBe('Enter an email like name@example.com, or leave it blank.')
  })
})

describe('sharedFrom', () => {
  test('trims and drops blank details, so nothing empty is shared', () => {
    expect(sharedFrom(draft({ name: ' Alex ', phone: '', email: '  ', other: ' No pets ' }))).toEqual({
      name: 'Alex',
      other: 'No pets',
    })
    expect(sharedFrom(draft({}))).toEqual({})
  })
})

describe('starter message', () => {
  test('greets a person by first name and names the place and month', () => {
    const l = makeListing({ title: 'Bright room on Dean Ave', availableFrom: '2026-12' })
    expect(greetingName(l.poster)).toBe('Sam')
    expect(starterMessage(l)).toBe('Hi Sam, is the bright room on Dean Ave still available from December 2026? ')
  })

  test('greets a company without a first name', () => {
    const l = makeListing({
      title: 'Modern apartment (1-bed) on Stone Rd E',
      poster: { name: 'Bluebird Rentals', role: 'property-manager', replyTime: 'Usually replies within a day' },
    })
    expect(greetingName(l.poster)).toBe('Bluebird Rentals')
    expect(starterMessage(l)).toMatch(/^Hi there, is the modern apartment \(1-bed\) on Stone Rd E still available/)
  })
})

describe('phoneHref', () => {
  test('makes a dialable link', () => {
    expect(phoneHref('519-555-0123')).toBe('+15195550123')
    expect(phoneHref('+1 (519) 555-0123')).toBe('+15195550123')
  })
})

const msg = (listingId: string, sentAt: string, body = 'hi'): Message => ({
  id: `${listingId}-${sentAt}`,
  listingId,
  sentAt,
  body,
  shared: {},
})

describe('conversations', () => {
  test('groups by listing, newest conversation first, messages oldest first', () => {
    const list = conversations([
      msg('a', '2026-11-01T10:00:00Z'),
      msg('b', '2026-11-02T10:00:00Z'),
      msg('a', '2026-11-03T10:00:00Z', 'follow-up'),
    ])
    expect(list.map((c) => c.listingId)).toEqual(['a', 'b'])
    expect(list[0].messages.map((m) => m.body)).toEqual(['hi', 'follow-up'])
    expect(list[0].last.body).toBe('follow-up')
  })

  test('no messages, no conversations', () => {
    expect(conversations([])).toEqual([])
  })
})

describe('isMessage', () => {
  test('accepts a stored message and rejects junk', () => {
    expect(isMessage(msg('a', '2026-11-01T10:00:00Z'))).toBe(true)
    expect(isMessage({ ...msg('a', 'x'), shared: { phone: '1' } })).toBe(true)
    expect(isMessage(null)).toBe(false)
    expect(isMessage('hello')).toBe(false)
    expect(isMessage({ listingId: 'a', body: 'hi' })).toBe(false)
    expect(isMessage({ ...msg('a', 'x'), shared: { phone: 5 } })).toBe(false)
  })
})
