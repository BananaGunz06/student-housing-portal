import { screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { getAll } from '../lib/listingsRepo'
import { renderApp, sessionReady, setBudget } from '../test/renderApp'

const ids = getAll().map((l) => l.id)
const saveIds = (list: string[]) => localStorage.setItem('shp.saved', JSON.stringify(list))

describe('Saved and Compare', () => {
  test('save two places, then compare them side by side', async () => {
    setBudget(5000)
    const { user } = renderApp('/results', { signedInAs: 'student@example.com' })
    await sessionReady()
    const [first, second] = screen.getAllByRole('article')
    const t1 = within(first).getByRole('heading', { level: 2 }).textContent!
    const t2 = within(second).getByRole('heading', { level: 2 }).textContent!
    await user.click(within(first).getByRole('button', { name: `Save ${t1}` }))
    await user.click(within(second).getByRole('button', { name: `Save ${t2}` }))
    expect(within(first).getByRole('button', { name: `Save ${t1}` })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('link', { name: /Saved \(2\)/ }))
    expect(screen.getByRole('heading', { name: 'Saved places' })).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: `Compare ${t1}` }))
    await user.click(screen.getByRole('checkbox', { name: `Compare ${t2}` }))
    await user.click(screen.getByRole('button', { name: 'Compare 2 places' }))

    expect(screen.getByRole('heading', { name: 'Compare 2 places' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    for (const label of ['True monthly cost', 'Advertised rent', 'Included', 'Commute', 'Lease', 'Bedrooms']) {
      expect(screen.getByRole('rowheader', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByText('Lowest')).toBeInTheDocument()
  })

  test('saved places are remembered after a reload', () => {
    saveIds([ids[0]])
    setBudget(1000)
    renderApp('/saved')
    expect(screen.getAllByRole('listitem').filter((li) => li.closest('main'))).toHaveLength(1)
  })

  test('a saved place that is no longer listed is dropped quietly', () => {
    saveIds(['gone-forever', ids[0]])
    setBudget(1000)
    renderApp('/saved')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Saved (1)' })).toBeInTheDocument()
  })

  test('no more than 3 can be picked', async () => {
    saveIds(ids.slice(0, 4))
    setBudget(1000)
    const { user } = renderApp('/saved')
    const boxes = screen.getAllByRole('checkbox')
    for (const b of boxes.slice(0, 3)) await user.click(b)
    expect(boxes[3]).toBeDisabled()
    expect(screen.getByText(/up to 3 at a time/)).toBeInTheDocument()
  })

  test('nothing saved shows a way to start', () => {
    setBudget(1000)
    renderApp('/saved')
    expect(screen.getByRole('heading', { name: 'Nothing saved yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Find places' })).toBeInTheDocument()
  })

  test('compare with fewer than 2 valid places asks for more', () => {
    renderApp(`/compare?ids=${ids[0]},nope`)
    expect(screen.getByRole('heading', { name: 'Pick at least 2 places to compare' })).toBeInTheDocument()
  })

  test('compare shows at most 3 places', () => {
    renderApp(`/compare?ids=${ids.slice(0, 4).join(',')}`)
    expect(screen.getByRole('heading', { name: 'Compare 3 places' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
  })
})
