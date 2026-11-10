import { screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { formatMoney } from '../lib/cost'
import { applyFilters, DEFAULT_FILTERS, evaluate, nearestBudgetWithResults } from '../lib/filters'
import { getAll } from '../lib/listingsRepo'
import { renderApp, setBudget } from '../test/renderApp'

const expectedCount = (budget: number) => applyFilters(evaluate(getAll(), budget), DEFAULT_FILTERS).length

describe('Results', () => {
  test('shows only places that fit or stretch, cheapest first', () => {
    setBudget(1000)
    renderApp('/results')
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(expectedCount(1000))
    const totals = cards.map((c) => Number(within(c).getByText(/^\$[\d,]+$/).textContent!.replace(/[$,]/g, '')))
    expect(totals).toEqual([...totals].sort((a, b) => a - b))
    expect(screen.queryByText('Over budget')).not.toBeInTheDocument()
  })

  test('changing the budget updates the results', async () => {
    setBudget(1000)
    const { user } = renderApp('/results')
    const before = screen.getAllByRole('article').length
    await user.click(screen.getByRole('button', { name: 'Change budget' }))
    const field = screen.getByLabelText('Monthly budget')
    await user.clear(field)
    await user.type(field, '700{Enter}')
    expect(screen.getAllByRole('article')).toHaveLength(expectedCount(700))
    expect(expectedCount(700)).toBeLessThan(before)
    expect(JSON.parse(localStorage.getItem('shp.budget')!)).toBe(700)
  })

  test('empty state suggests the nearest budget that has results', async () => {
    setBudget(300)
    const { user } = renderApp('/results')
    const hint = nearestBudgetWithResults(getAll(), DEFAULT_FILTERS, 300)!
    expect(screen.getByRole('heading', { name: 'Nothing fits $300' })).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`fits? at \\${formatMoney(hint.budget)}`))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: `Try ${formatMoney(hint.budget)}` }))
    expect(screen.getAllByRole('article').length).toBeGreaterThanOrEqual(hint.count)
  })

  test('filters apply from the bottom sheet', async () => {
    setBudget(5000)
    const { user } = renderApp('/results')
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const sheet = screen.getByRole('dialog', { name: 'Filters' })
    await user.click(within(sheet).getByRole('button', { name: 'Studio' }))
    const studios = getAll().filter((l) => l.type === 'studio').length
    await user.click(within(sheet).getByRole('button', { name: `Show ${studios} places` }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(studios)
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument()
  })

  test('Escape closes the filter sheet without applying', async () => {
    setBudget(5000)
    const { user } = renderApp('/results')
    const n = screen.getAllByRole('article').length
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('button', { name: 'Studio' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(n)
  })

  test('without a budget, sends the student to the welcome screen', () => {
    renderApp('/results')
    expect(screen.getByRole('heading', { name: 'What can you spend per month, all-in?' })).toBeInTheDocument()
  })
})

describe('Welcome', () => {
  test('saves the budget and optional details, then shows results', async () => {
    const { user } = renderApp('/')
    const field = screen.getByLabelText('What can you spend per month, all-in?')
    await user.clear(field)
    await user.type(field, '850')
    await user.click(screen.getByText('More details (optional)'))
    await user.click(screen.getByRole('button', { name: 'Studio' }))
    await user.click(screen.getByRole('button', { name: 'Show places that fit' }))
    expect(screen.getByRole('heading', { name: 'Places in Guelph for your budget' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('shp.budget')!)).toBe(850)
    expect(JSON.parse(localStorage.getItem('shp.filters')!).bedrooms).toBe(0)
  })
})
