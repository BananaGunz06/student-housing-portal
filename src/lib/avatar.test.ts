import { describe, expect, test } from 'vitest'
import { checkPhoto } from './avatar'

const MB5 = 5 * 1024 * 1024
const file = (type: string, size: number) => new File([new Uint8Array(size)], 'p', { type })

describe('checkPhoto', () => {
  test('rejects other types', () => {
    expect(checkPhoto(file('image/gif', 10))).toBe('type')
    expect(checkPhoto(file('application/pdf', 10))).toBe('type')
  })
  test('rejects over 5 MB', () => expect(checkPhoto(file('image/jpeg', MB5 + 1))).toBe('size'))
  test('accepts a 5 MB PNG, JPEG and WebP', () => {
    expect(checkPhoto(file('image/png', MB5))).toBeNull()
    expect(checkPhoto(file('image/jpeg', 10))).toBeNull()
    expect(checkPhoto(file('image/webp', 10))).toBeNull()
  })
})
