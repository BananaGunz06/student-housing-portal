import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { campusCommute } from '../lib/commute'
import { getAll } from '../lib/listingsRepo'
import MiniMap from './MiniMap'

const listings = getAll()
const withMode = (pred: (c: ReturnType<typeof campusCommute>) => boolean) =>
  listings.find((l) => pred(campusCommute(l)))!

const strokes = (container: HTMLElement) =>
  [...container.querySelectorAll('path.leaflet-interactive')].map((p) => p.getAttribute('stroke')?.toLowerCase())
const dashed = (container: HTMLElement) =>
  [...container.querySelectorAll('path.leaflet-interactive')].filter((p) => p.getAttribute('stroke-dasharray'))

describe('MiniMap', () => {
  test('a one-transfer trip draws both routes, the change stop and the dashed walk', () => {
    const l = withMode((c) => c.mode === 'bus' && !!c.transfer)
    const c = campusCommute(l)
    if (c.mode !== 'bus' || !c.transfer) throw new Error('expected a one-transfer commute')
    const { container } = render(<MiniMap listing={l} commute={c} />)
    const got = strokes(container)
    // 2 route lines, 1 dashed walk line, stop marker, change-stop marker (circle markers are paths too)
    expect(got.filter((x) => x === c.route.color.toLowerCase()).length).toBeGreaterThanOrEqual(1)
    expect(got.filter((x) => x === c.transfer!.secondRoute.color.toLowerCase()).length).toBeGreaterThanOrEqual(1)
    expect(dashed(container)).toHaveLength(1)
    expect(got).toHaveLength(5)
  })

  test('a direct trip draws one route and the dashed walk to the stop', () => {
    const l = withMode((c) => c.mode === 'bus' && !c.transfer)
    const c = campusCommute(l)
    if (c.mode !== 'bus') throw new Error('expected a bus commute')
    const { container } = render(<MiniMap listing={l} commute={c} />)
    expect(strokes(container)).toHaveLength(3) // route, dashed walk, stop marker
    expect(dashed(container)).toHaveLength(1)
  })

  test('a no-bus walk draws only the dashed line to campus, labelled with the walk time', () => {
    const l = { ...listings[0], lat: 43.45, lng: -80.4 }
    const c = campusCommute(l)
    expect(c).toMatchObject({ mode: 'walk', noBusNearby: true })
    const { container } = render(<MiniMap listing={l} commute={c} />)
    expect(strokes(container)).toHaveLength(1)
    expect(dashed(container)).toHaveLength(1)
    expect(container.querySelector('.leaflet-tooltip')).toHaveTextContent(`≈${c.minutes} min walk`)
  })
})
