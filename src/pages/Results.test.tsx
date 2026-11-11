import { screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { formatMoney } from '../lib/cost'
import { applyFilters, DEFAULT_FILTERS, evaluate, nearestBudgetWithResults } from '../lib/filters'
import { campusCommute, shortCommute } from '../lib/commute'
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

  test('the filter sidebar applies filters straight away and shows them as chips', async () => {
    setBudget(5000)
    const { user } = renderApp('/results')
    expect(screen.queryByRole('button', { name: /^Filters/ })).toBeNull()
    const sidebar = screen.getByRole('complementary', { name: 'Filters' })
    const studios = getAll().filter((l) => l.type === 'studio').length

    await user.click(within(sidebar).getByRole('button', { name: 'Studio apartment' }))
    expect(within(sidebar).getByRole('button', { name: 'Studio apartment' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('article')).toHaveLength(studios)
    expect(within(sidebar).getByText(`${studios} places`)).toBeInTheDocument()

    const applied = screen.getByRole('list', { name: 'Applied filters' })
    await user.click(within(applied).getByRole('button', { name: 'Remove filter: Studio apartment' }))
    expect(screen.getAllByRole('article')).toHaveLength(expectedCount(5000))
    expect(within(sidebar).getByRole('button', { name: 'Studio apartment' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('Clear all removes every filter', async () => {
    setBudget(5000)
    localStorage.setItem('shp.filters', JSON.stringify({ ...DEFAULT_FILTERS, furnishedOnly: true, maxCommute: 15 }))
    const { user } = renderApp('/results')
    const sidebar = screen.getByRole('complementary', { name: 'Filters' })
    expect(within(screen.getByRole('list', { name: 'Applied filters' })).getAllByRole('button')).toHaveLength(2)
    await user.click(within(sidebar).getByRole('button', { name: 'Clear all' }))
    expect(screen.getAllByRole('article')).toHaveLength(expectedCount(5000))
    expect(screen.queryByRole('list', { name: 'Applied filters' })).toBeNull()
    expect(within(sidebar).getByRole('button', { name: 'Clear all' })).toBeDisabled()
  })

  test('on phones, All filters slides the same panel in; Escape closes it and returns focus', async () => {
    setBudget(5000)
    const { user } = renderApp('/results')
    const opener = screen.getByRole('button', { name: 'All filters' })
    await user.click(opener)
    const drawer = screen.getByRole('dialog', { name: 'Filters' })
    await user.click(within(drawer).getByRole('checkbox', { name: 'Furnished only' }))
    const furnished = applyFilters(evaluate(getAll(), 5000), { ...DEFAULT_FILTERS, furnishedOnly: true }).length
    expect(screen.getAllByRole('article')).toHaveLength(furnished)
    expect(screen.getByRole('button', { name: 'All filters (1)' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'All filters (1)' })).toHaveFocus()
  })

  test('the drawer closes with its Show button', async () => {
    setBudget(5000)
    const { user } = renderApp('/results')
    await user.click(screen.getByRole('button', { name: 'All filters' }))
    const drawer = screen.getByRole('dialog', { name: 'Filters' })
    await user.click(within(drawer).getByRole('button', { name: `Show ${expectedCount(5000)} places` }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('when no place matches the filters at any price, offers to clear them', async () => {
    setBudget(300)
    localStorage.setItem('shp.filters', JSON.stringify({ ...DEFAULT_FILTERS, bedrooms: 3, types: ['studio'] }))
    const { user } = renderApp('/results')
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.queryByRole('list', { name: 'Applied filters' })).toBeNull()
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

  test('cards say "to campus" before the transfer note', () => {
    setBudget(5000)
    renderApp('/results')
    const l = getAll().find((x) => {
      const c = campusCommute(x)
      return c.mode === 'bus' && c.transfer
    })!
    const card = screen.getAllByRole('article').find((a) => within(a).queryByText(l.title))!
    expect(within(card).getByText(shortCommute(campusCommute(l), { toCampus: true }))).toBeInTheDocument()
    expect(within(card).getByText(/^≈\d+ min by bus to campus, 1 transfer$/)).toBeInTheDocument()
  })
})
