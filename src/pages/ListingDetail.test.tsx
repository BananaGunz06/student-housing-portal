import { screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { campusCommute, describeCommute } from '../lib/commute'
import { formatMoney, trueMonthlyCost } from '../lib/cost'
import { getAll } from '../lib/listingsRepo'
import { renderApp, setBudget } from '../test/renderApp'

vi.mock('../components/MiniMap', () => ({ default: () => <div>mini map</div> }))

// A made-up listing far outside the city, so its commute is a walk with no bus nearby.
const REMOTE_ID = 'test-remote'
vi.mock('../lib/listingsRepo', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/listingsRepo')>()
  return {
    ...real,
    getById: (id: string) =>
      id === 'test-remote'
        ? { ...real.getAll()[0], id: 'test-remote', title: 'Remote cabin', lat: 43.45, lng: -80.4 }
        : real.getById(id),
  }
})

const withExtras = getAll().find((l) => !l.utilitiesIncluded && !l.internetIncluded)!

describe('Listing detail', () => {
  test('the cost breakdown adds up to the true monthly cost', () => {
    setBudget(5000)
    renderApp(`/listing/${withExtras.id}`)
    const cost = trueMonthlyCost(withExtras)
    expect(cost.rent + cost.utilities + cost.internet + cost.transit).toBe(cost.total)
    expect(screen.getByRole('heading', { level: 1, name: withExtras.title })).toBeInTheDocument()
    expect(screen.getByTestId('true-total')).toHaveTextContent(formatMoney(cost.total))
    expect(screen.getByText(`≈${formatMoney(cost.utilities)}`)).toBeInTheDocument()
    expect(screen.getByText(`≈${formatMoney(cost.internet)}`)).toBeInTheDocument()
    expect(screen.getByText('Bus pass included in U of G student fees')).toBeInTheDocument()
  })

  test('shows how much of the budget is left', () => {
    const cost = trueMonthlyCost(withExtras)
    setBudget(cost.total + 150)
    renderApp(`/listing/${withExtras.id}`)
    expect(screen.getByText('$150')).toBeInTheDocument()
    expect(screen.getByText(/left of your/)).toBeInTheDocument()
  })

  test('shows how far over budget it is', () => {
    const cost = trueMonthlyCost(withExtras)
    setBudget(cost.total - 40)
    renderApp(`/listing/${withExtras.id}`)
    expect(screen.getByText('$40')).toBeInTheDocument()
    expect(screen.getByText(/over your/)).toBeInTheDocument()
  })

  test('describes a bus commute with the real route number', () => {
    const bus = getAll().find((l) => {
      const c = campusCommute(l)
      return c.mode === 'bus' && !c.transfer
    })!
    setBudget(5000)
    renderApp(`/listing/${bus.id}`)
    expect(screen.getByText(/^≈\d+ min walk to stop · Route \S+( \S)? · ≈\d+ min to campus$/)).toBeInTheDocument()
    expect(screen.getByText(describeCommute(campusCommute(bus)))).toBeInTheDocument()
  })

  test('describes a one-transfer bus commute', () => {
    const l = getAll().find((x) => {
      const c = campusCommute(x)
      return c.mode === 'bus' && c.transfer
    })!
    setBudget(5000)
    renderApp(`/listing/${l.id}`)
    expect(screen.getByText(/Route \S+( \S)? then Route \S+( \S)? \(change at .+\) · ≈\d+ min to campus, 1 transfer$/)).toBeInTheDocument()
  })

  test('explains where the times come from and what they leave out', () => {
    setBudget(5000)
    renderApp(`/listing/${withExtras.id}`)
    expect(
      screen.getByText(
        'Estimates from Guelph Transit’s Winter 2026 timetable for a typical weekday morning. Walking uses straight-line distance plus 30% at about 80 metres a minute. Times don’t include waiting for the bus; a change of buses adds 5 minutes.',
      ),
    ).toBeInTheDocument()
  })

  test('says so when no bus is nearby', () => {
    setBudget(5000)
    renderApp(`/listing/${REMOTE_ID}`)
    expect(screen.getByText(/^≈\d+ min walk to campus \(no bus nearby\)$/)).toBeInTheDocument()
  })

  test('an unknown listing shows a friendly not-found', () => {
    setBudget(1000)
    renderApp('/listing/does-not-exist')
    expect(screen.getByRole('heading', { name: 'We couldn’t find that place' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to search' })).toBeInTheDocument()
  })
})
