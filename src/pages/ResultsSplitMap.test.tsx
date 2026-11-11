import { screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { applyFilters, DEFAULT_FILTERS, evaluate } from '../lib/filters'
import { getAll } from '../lib/listingsRepo'
import { renderApp, setBudget } from '../test/renderApp'
import { stubLaptop, unstubMedia } from '../test/stubMedia'

const shown = applyFilters(evaluate(getAll(), 5000), DEFAULT_FILTERS)

beforeEach(() => {
  setBudget(5000)
})
afterEach(unstubMedia)

test.each([false, true])('on a laptop the real map shows the opened place’s commute, then all pins again (reduced motion: %s)', async (reduced) => {
  stubLaptop(true, { reducedMotion: reduced })
  const { user, container } = renderApp('/results')
  await screen.findByText(/places, all-in prices/)
  expect(container.querySelectorAll('.pin')).toHaveLength(getAll().length)
  expect(container.querySelectorAll('path.leaflet-interactive[stroke-dasharray]')).toHaveLength(0)

  await user.click(screen.getByRole('link', { name: shown[0].listing.title }))
  await screen.findByRole('button', { name: 'Back to list' })
  expect(container.querySelectorAll('.pin--selected')).toHaveLength(1)
  expect(container.querySelectorAll('path.leaflet-interactive[stroke-dasharray]')).toHaveLength(1)
  // The big map is the commute map, so the details have no mini map of their own.
  expect(container.querySelectorAll('.leaflet-container')).toHaveLength(1)

  await user.click(screen.getByRole('button', { name: 'Back to list' }))
  expect(container.querySelectorAll('.pin--selected')).toHaveLength(0)
  expect(container.querySelectorAll('path.leaflet-interactive[stroke-dasharray]')).toHaveLength(0)
})
