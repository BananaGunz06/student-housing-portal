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

  test('a direct trip and a no-bus walk render', () => {
    const l = withMode((c) => c.mode === 'bus' && !c.transfer)
    expect(render(<MiniMap listing={l} commute={campusCommute(l)} />).container.querySelector('.leaflet-container')).not.toBeNull()
    const home = { ...l, lat: 43.45, lng: -80.4 }
    const noBus = campusCommute(home)
    expect(noBus).toMatchObject({ mode: 'walk', noBusNearby: true })
    expect(render(<MiniMap listing={home} commute={noBus} />).container.querySelector('.leaflet-container')).not.toBeNull()
  })
})
