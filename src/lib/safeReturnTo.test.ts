import { describe, expect, test } from 'vitest'
import { safeReturnTo } from './safeReturnTo'

const at = (returnTo: unknown) => safeReturnTo({ returnTo })

describe('safeReturnTo', () => {
  test('lets in-app paths through', () => {
    expect(at('/listing/gue-001')).toBe('/listing/gue-001')
    expect(at('/results?x=1')).toBe('/results?x=1')
    expect(at('/')).toBe('/')
  })
  test.each([
    ['//example.com'],
    ['/\\example.com'],
    ['/a\\b'],
    ['https://example.com'],
    ['/a\tb'],
    ['/a\nb'],
    ['/a\u0000b'],
    [''],
    [null],
    [undefined],
    [42],
    [{}],
  ])('sends %j to /results', (value) => {
    expect(at(value)).toBe('/results')
  })
  test('no state at all gives /results', () => {
    expect(safeReturnTo(null)).toBe('/results')
    expect(safeReturnTo(undefined)).toBe('/results')
    expect(safeReturnTo('/listing/gue-001')).toBe('/results')
    expect(safeReturnTo({})).toBe('/results')
  })
})
