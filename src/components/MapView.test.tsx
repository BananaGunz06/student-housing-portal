import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
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
    expect(TILE_ATTRIBUTION).toBe(
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Transit data: City of Guelph',
    )
  })
})
