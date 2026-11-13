import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import { campusCommute } from '../lib/commute'
import { evaluateOne } from '../lib/filters'
import { getAll } from '../lib/listingsRepo'
import { AccountProvider } from '../state/AccountState'
import { AppStateProvider } from '../state/AppState'
import { createFakeBackend } from '../test/fakeBackend'
import MapView from './MapView'
import { TILE_ATTRIBUTION } from './mapShared'

describe('MapView copy', () => {
  test('the notice names Guelph Transit and the schedule it uses', () => {
    render(
      <MemoryRouter>
        <MapView results={[]} onShowList={() => {}} />
      </MemoryRouter>,
    )
    expect(
      screen.getByText('0 places, all-in prices. Bus routes: Guelph Transit, Winter 2026 schedule.'),
    ).toBeInTheDocument()
  })

  test('the tile attribution keeps OpenStreetMap and credits the city transit data', () => {
    expect(TILE_ATTRIBUTION).toContain('<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors')
    expect(TILE_ATTRIBUTION).toContain('Transit data: <a href="https://mobilitydatabase.org/feeds/gtfs/mdb-3140"')
    expect(TILE_ATTRIBUTION).toContain('>City of Guelph</a>')
  })
})

const results = getAll().slice(0, 6).map((l) => evaluateOne(l, 5000))
const transferListing = getAll().find((l) => {
  const c = campusCommute(l)
  return c.mode === 'bus' && c.transfer
})!
const withTransfer = [...results, evaluateOne(transferListing, 5000)]
const dashed = (c: HTMLElement) =>
  [...c.querySelectorAll('path.leaflet-interactive')].filter((p) => p.getAttribute('stroke-dasharray'))

describe('MapView with a selected place', () => {
  test('draws that place’s commute (dashed walk, routes, change stop) like the mini map', () => {
    const { container } = render(
      <MemoryRouter>
        <MapView results={withTransfer} onShowList={() => {}} selectedId={transferListing.id} onSelect={() => {}} />
      </MemoryRouter>,
    )
    expect(dashed(container)).toHaveLength(2) // walk to the stop, and the short walk between the platforms
    expect(container.querySelector('.pin--selected')).toHaveTextContent(/\$/)
    expect(container.querySelectorAll('.pin--selected')).toHaveLength(1)
  })

  test('draws no commute while nothing is selected', () => {
    const { container } = render(
      <MemoryRouter>
        <MapView results={results} onShowList={() => {}} onSelect={() => {}} />
      </MemoryRouter>,
    )
    expect(dashed(container)).toHaveLength(0)
  })

  test('the hovered pin gets the hover style', () => {
    const { container } = render(
      <MemoryRouter>
        <MapView results={results} onShowList={() => {}} hoveredId={results[1].listing.id} onSelect={() => {}} />
      </MemoryRouter>,
    )
    expect(container.querySelectorAll('.pin--hover')).toHaveLength(1)
    expect(container.querySelector('.pin--hover')?.getAttribute('title')).toContain(results[1].listing.title)
  })

  test('with onSelect, a pin click selects the place instead of opening the preview card', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <MemoryRouter>
        <MapView results={results} onShowList={() => {}} onSelect={onSelect} />
      </MemoryRouter>,
    )
    const pin = container.querySelector('.leaflet-marker-icon.pin-icon') as HTMLElement
    act(() => void fireEvent.click(pin))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('region', { name: 'Selected place' })).toBeNull()
  })

  test('without onSelect (phones), a pin click opens the preview card as before', () => {
    const { container } = render(
      <MemoryRouter>
        <AccountProvider backend={createFakeBackend({ users: [] })}>
          <AppStateProvider>
            <MapView results={results} onShowList={() => {}} />
          </AppStateProvider>
        </AccountProvider>
      </MemoryRouter>,
    )
    const pin = container.querySelector('.leaflet-marker-icon.pin-icon') as HTMLElement
    act(() => void fireEvent.click(pin))
    expect(screen.getByRole('region', { name: 'Selected place' })).toBeInTheDocument()
  })
})
