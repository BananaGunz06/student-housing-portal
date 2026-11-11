import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { campusCommute } from '../lib/commute'
import { getAll } from '../lib/listingsRepo'
import MiniMap from './MiniMap'

const listings = getAll()
const withMode = (pred: (c: ReturnType<typeof campusCommute>) => boolean) =>
  listings.find((l) => pred(campusCommute(l)))!

describe('MiniMap', () => {
  test('a one-transfer trip draws both routes and the change stop', () => {
    const l = withMode((c) => c.mode === 'bus' && !!c.transfer)
    const { container } = render(<MiniMap listing={l} commute={campusCommute(l)} />)
    // two route lines + the dashed walk line
    expect(container.querySelectorAll('path.leaflet-interactive').length).toBeGreaterThanOrEqual(5)
  })

  test('a direct trip and a no-bus trip render', () => {
    for (const pred of [
      (c: ReturnType<typeof campusCommute>) => c.mode === 'bus' && !c.transfer,
      (c: ReturnType<typeof campusCommute>) => c.mode === 'transfer',
    ]) {
      const l = withMode(pred)
      const { container } = render(<MiniMap listing={l} commute={campusCommute(l)} />)
      expect(container.querySelector('.leaflet-container')).not.toBeNull()
    }
  })
})
