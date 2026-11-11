import { expect, test } from 'vitest'
import { evaluateOne } from '../lib/filters'
import { makeListing } from '../test/makeListing'
import { pricePinHtml } from './pricePin'

test.each([
  [1000, 'fits', '✓'],
  [1050, 'stretch', '!'],
  [1500, 'over', '✕'],
] as const)('a $%i place on a $1,000 budget is %s', (rent, fit, icon) => {
  const html = pricePinHtml(evaluateOne(makeListing({ rent, title: 'A "quoted" room' }), 1000))
  expect(html).toContain(`pin--${fit}`)
  expect(html).toContain(icon)
  expect(html).toContain(`$${rent.toLocaleString('en-CA')}`)
  expect(html).toContain('&quot;quoted&quot;')
})

test('marks the selected pin', () => {
  expect(pricePinHtml(evaluateOne(makeListing(), 1000), true)).toContain('pin--selected')
})

test('marks the hovered pin (the stylesheet lifts, enlarges and dashed-outlines it, so it is not just a colour)', () => {
  const html = pricePinHtml(evaluateOne(makeListing(), 1000), false, true)
  expect(html).toContain('pin--hover')
  expect(pricePinHtml(evaluateOne(makeListing(), 1000))).not.toContain('pin--hover')
})
