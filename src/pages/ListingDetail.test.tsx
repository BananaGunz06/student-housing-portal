import { screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { formatMoney, trueMonthlyCost } from '../lib/cost'
import { getAll } from '../lib/listingsRepo'
import { renderApp, setBudget } from '../test/renderApp'

vi.mock('../components/MiniMap', () => ({ default: () => <div>mini map</div> }))

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

  test('describes the commute with estimates', () => {
    setBudget(1000)
    renderApp(`/listing/${withExtras.id}`)
    expect(screen.getByText(/^≈\d+ min walk/)).toBeInTheDocument()
  })

  test('an unknown listing shows a friendly not-found', () => {
    setBudget(1000)
    renderApp('/listing/does-not-exist')
    expect(screen.getByRole('heading', { name: 'We couldn’t find that place' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to search' })).toBeInTheDocument()
  })
})
