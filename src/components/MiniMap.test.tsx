import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { campusCommute } from '../lib/commute'
import { getAll } from '../lib/listingsRepo'
import MiniMap from './MiniMap'
import { labelsCrowd, MINI_MAP_BOUNDS_OPTIONS } from './mapShared'

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
    // Same stop for getting off and boarding: no alight marker, no second dashed line.
    const same = { ...c, transfer: { secondRoute: c.transfer.secondRoute, stop: c.transfer.stop } }
    const { container } = render(<MiniMap listing={l} commute={same} />)
    const got = strokes(container)
    // 2 route lines, 1 dashed walk line, stop marker, change-stop marker (circle markers are paths too)
    expect(got.filter((x) => x === c.route.color.toLowerCase()).length).toBeGreaterThanOrEqual(1)
    expect(got.filter((x) => x === c.transfer!.secondRoute.color.toLowerCase()).length).toBeGreaterThanOrEqual(1)
    expect(dashed(container)).toHaveLength(1)
    expect(got).toHaveLength(5)
  })

  test('a transfer to a stop across the street also marks where you get off, with a short dashed walk', () => {
    const l = withMode((c) => c.mode === 'bus' && !!c.transfer?.alightStop)
    const c = campusCommute(l)
    if (c.mode !== 'bus' || !c.transfer) throw new Error('expected a one-transfer commute')
    const { container } = render(<MiniMap listing={l} commute={c} />)
    // 2 routes, 2 dashed lines, stop, get-off and board markers
    expect(strokes(container)).toHaveLength(7)
    expect(dashed(container)).toHaveLength(2)
  })

  test('the chosen route is drawn strongly', () => {
    const l = withMode((c) => c.mode === 'bus' && !c.transfer)
    const c = campusCommute(l)
    if (c.mode !== 'bus') throw new Error('expected a bus commute')
    const { container } = render(<MiniMap listing={l} commute={c} />)
    const line = [...container.querySelectorAll('path.leaflet-interactive')].find(
      (p) => p.getAttribute('stroke')?.toLowerCase() === c.route.color.toLowerCase(),
    )
    expect(Number(line?.getAttribute('stroke-opacity'))).toBeGreaterThanOrEqual(0.85)
    expect(Number(line?.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(4)
  })

  test('the credit links to the licence source in a new tab', async () => {
    const { TILE_ATTRIBUTION } = await import('./mapShared')
    const a = new DOMParser().parseFromString(TILE_ATTRIBUTION, 'text/html').querySelector('a[href*="mobilitydatabase"]')
    expect(a?.textContent).toBe('City of Guelph')
    expect(a?.getAttribute('target')).toBe('_blank')
    expect(a?.getAttribute('rel')).toBe('noopener')
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

describe('MiniMap padding', () => {
  test('leaves room at the bottom for the walk label and the credit bar', () => {
    expect(MINI_MAP_BOUNDS_OPTIONS.paddingBottomRight[1]).toBeGreaterThanOrEqual(90)
    expect(MINI_MAP_BOUNDS_OPTIONS.paddingTopLeft).toEqual([40, 64])
  })
})

describe('labelsCrowd', () => {
  test('is true only when the two screen points are closer than the limit', () => {
    expect(labelsCrowd({ x: 0, y: 0 }, { x: 10, y: 10 })).toBe(true)
    expect(labelsCrowd({ x: 0, y: 0 }, { x: 89, y: 0 })).toBe(true)
    expect(labelsCrowd({ x: 0, y: 0 }, { x: 90, y: 0 })).toBe(false)
    expect(labelsCrowd({ x: 0, y: 0 }, { x: 80, y: 80 })).toBe(false)
    expect(labelsCrowd({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(true)
  })
})

describe('MiniMap walk label', () => {
  const walkLabel = (container: HTMLElement) =>
    [...container.querySelectorAll('.leaflet-tooltip')].find((t) => t.textContent?.includes('min walk')) as HTMLElement

  test('with the stop a few metres from the listing the walk label is drawn below the line', () => {
    const base = withMode((c) => c.mode === 'bus' && !c.transfer)
    const stop = (campusCommute(base) as { stop: { lat: number; lng: number } }).stop
    const l = { ...base, lat: stop.lat + 0.00003, lng: stop.lng }
    const c = campusCommute(l)
    if (c.mode !== 'bus') throw new Error('expected a bus commute')
    const { container } = render(<MiniMap listing={l} commute={c} />)
    expect(walkLabel(container).className).toMatch(/leaflet-tooltip-bottom/)
  })

  test('with a distant stop the walk label stays centred on the line', () => {
    const l = { ...listings[0], lat: 43.45, lng: -80.4 }
    const c = campusCommute(l)
    expect(c).toMatchObject({ mode: 'walk' })
    const { container } = render(<MiniMap listing={l} commute={c} />)
    expect(walkLabel(container).className).not.toMatch(/leaflet-tooltip-bottom/)
    expect(walkLabel(container).className).toMatch(/leaflet-tooltip-center/)
  })
})
