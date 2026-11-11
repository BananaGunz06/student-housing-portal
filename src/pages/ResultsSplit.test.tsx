import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ListingResult } from '../lib/filters'
import { applyFilters, DEFAULT_FILTERS, evaluate } from '../lib/filters'
import { getAll } from '../lib/listingsRepo'
import { greetingName } from '../lib/messages'
import { renderApp, sessionReady, setBudget } from '../test/renderApp'
import { stubLaptop, unstubMedia } from '../test/stubMedia'

// A stand-in for the real map: shows what Results tells it, and lets a test click a "pin".
vi.mock('../components/MapView', () => ({
  default: (props: {
    results: ListingResult[]
    selectedId?: string | null
    hoveredId?: string | null
    onSelect?: (id: string) => void
  }) => (
    <div data-testid="map" data-selected={props.selectedId ?? ''} data-hovered={props.hoveredId ?? ''}>
      {props.results.map((r) => (
        <button key={r.listing.id} type="button" onClick={() => props.onSelect?.(r.listing.id)}>
          pin {r.listing.id}
        </button>
      ))}
    </div>
  ),
}))

const BUDGET = 5000
const shown = applyFilters(evaluate(getAll(), BUDGET), DEFAULT_FILTERS)
const first = shown[0].listing
const second = shown[1].listing

const cardLink = (title: string) => screen.getByRole('link', { name: title })
const openFromList = async (user: ReturnType<typeof renderApp>['user'], title: string) => {
  await user.click(cardLink(title))
  return screen.findByRole('button', { name: 'Back to list' })
}

describe('laptop split view', () => {
  beforeEach(() => {
    setBudget(BUDGET)
    stubLaptop(true)
  })
  afterEach(unstubMedia)

  test('shows the list and the map together, with no List/Map toggle', async () => {
    renderApp('/results')
    expect(await screen.findByTestId('map')).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(shown.length)
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull()
    expect(screen.getByRole('complementary', { name: 'Filters' })).toBeInTheDocument()
  })

  test('hovering or focusing a card tells the map which pin to raise', async () => {
    const { user } = renderApp('/results')
    const map = await screen.findByTestId('map')
    await user.hover(cardLink(first.title))
    expect(map).toHaveAttribute('data-hovered', first.id)
    await user.unhover(cardLink(first.title))
    expect(map).toHaveAttribute('data-hovered', '')
    act(() => cardLink(second.title).focus())
    expect(map).toHaveAttribute('data-hovered', second.id)
    act(() => cardLink(second.title).blur())
    expect(map).toHaveAttribute('data-hovered', '')
  })

  test('clicking a card opens its details in the column, with Back to list, and selects it on the map', async () => {
    const { user, location } = renderApp('/results')
    const map = await screen.findByTestId('map')
    await openFromList(user, first.title)
    expect(location().pathname).toBe('/results')
    expect(location().search).toBe(`?listing=${first.id}`)
    const heading = screen.getByRole('heading', { level: 1, name: first.title })
    expect(heading).toHaveFocus()
    expect(map).toHaveAttribute('data-selected', first.id)
    expect(screen.getByText('What you’d really pay each month')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Posted by' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Getting to campus' })).toBeInTheDocument()
    // The big map is the commute map here, so the panel has no second one.
    expect(document.querySelector('.leaflet-container')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Back to results' })).toBeNull()
  })

  test('clicking a pin opens that place, and another pin switches to it', async () => {
    const { user, location } = renderApp('/results')
    await user.click(await screen.findByRole('button', { name: `pin ${first.id}` }))
    expect(await screen.findByRole('heading', { level: 1, name: first.title })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: `pin ${second.id}` }))
    expect(await screen.findByRole('heading', { level: 1, name: second.title })).toBeInTheDocument()
    expect(location().search).toBe(`?listing=${second.id}`)
    // Still one step back to the list.
    await user.click(screen.getByRole('button', { name: 'Back to list' }))
    expect(location().search).toBe('')
    expect(screen.getByTestId('map')).toHaveAttribute('data-selected', '')
  })

  test('Back to list returns to the list and puts focus on the card that opened it', async () => {
    const { user, location } = renderApp('/results')
    await screen.findByTestId('map')
    await openFromList(user, second.title)
    await user.click(screen.getByRole('button', { name: 'Back to list' }))
    expect(screen.queryByRole('button', { name: 'Back to list' })).toBeNull()
    expect(location().search).toBe('')
    expect(screen.getAllByRole('article')).toHaveLength(shown.length)
    expect(cardLink(second.title)).toHaveFocus()
    expect(screen.getByTestId('map')).toHaveAttribute('data-selected', '')
  })

  test('the browser Back button closes the details', async () => {
    const { user, navigate, location } = renderApp('/results')
    await screen.findByTestId('map')
    await openFromList(user, first.title)
    act(() => void navigate(-1))
    expect(screen.queryByRole('button', { name: 'Back to list' })).toBeNull()
    expect(location().search).toBe('')
    expect(screen.getAllByRole('article')).toHaveLength(shown.length)
  })

  test('opening a ?listing= link shows that place straight away; Back to list still works', async () => {
    const { user, location } = renderApp(`/results?listing=${second.id}`)
    expect(await screen.findByRole('heading', { level: 1, name: second.title })).toHaveFocus()
    expect(await screen.findByTestId('map')).toHaveAttribute('data-selected', second.id)
    await user.click(screen.getByRole('button', { name: 'Back to list' }))
    expect(location().pathname).toBe('/results')
    expect(location().search).toBe('')
    expect(screen.getAllByRole('article')).toHaveLength(shown.length)
  })

  test('an unknown ?listing= id just shows the list', async () => {
    renderApp('/results?listing=nope')
    expect(await screen.findByTestId('map')).toHaveAttribute('data-selected', '')
    expect(screen.queryByRole('button', { name: 'Back to list' })).toBeNull()
    expect(screen.getAllByRole('article')).toHaveLength(shown.length)
  })

  test('Hide filters folds the sidebar away, and the choice is remembered', async () => {
    const { user, unmount } = renderApp('/results')
    await screen.findByTestId('map')
    const hide = screen.getByRole('button', { name: 'Hide filters' })
    expect(hide).toHaveAttribute('aria-expanded', 'true')
    await user.click(hide)
    expect(screen.queryByRole('complementary', { name: 'Filters' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Show filters' })).toHaveAttribute('aria-expanded', 'false')
    expect(JSON.parse(localStorage.getItem('shp.filtersOpen')!)).toBe(false)
    unmount()

    const again = renderApp('/results')
    await screen.findByTestId('map')
    expect(screen.queryByRole('complementary', { name: 'Filters' })).toBeNull()
    await again.user.click(screen.getByRole('button', { name: 'Show filters' }))
    expect(screen.getByRole('complementary', { name: 'Filters' })).toBeInTheDocument()
  })

  test('applied-filter chips stay above the list while filters are hidden', async () => {
    localStorage.setItem('shp.filters', JSON.stringify({ ...DEFAULT_FILTERS, furnishedOnly: true }))
    localStorage.setItem('shp.filtersOpen', 'false')
    renderApp('/results')
    await screen.findByTestId('map')
    expect(screen.getByRole('list', { name: 'Applied filters' })).toBeInTheDocument()
  })

  test('Save works from the details column', async () => {
    const { user } = renderApp(`/results?listing=${first.id}`, { signedInAs: 'student@example.com' })
    await sessionReady()
    const save = await screen.findByRole('button', { name: `Save ${first.title}` })
    await user.click(save)
    expect(save).toHaveAttribute('aria-pressed', 'true')
  })

  test('Message works from the details column', async () => {
    const { user } = renderApp(`/results?listing=${first.id}`, { signedInAs: 'student@example.com' })
    await sessionReady()
    const name = greetingName(first.poster)
    const buttons = await screen.findAllByRole('button', { name: `Message ${name}` })
    await user.click(buttons[0])
    const dialog = screen.getByRole('dialog', { name: `Message ${name}` })
    await user.click(within(dialog).getByRole('button', { name: 'Send message' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText(/Saved to Messages/)).toBeInTheDocument()
  })
})

describe('phones and tablets', () => {
  beforeEach(() => setBudget(BUDGET))
  afterEach(unstubMedia)

  test('a card click still goes to the listing page', async () => {
    stubLaptop(false)
    const { user, location } = renderApp('/results')
    await user.click(cardLink(first.title))
    expect(location().pathname).toBe(`/listing/${first.id}`)
    expect(await screen.findByRole('link', { name: 'Back to results' })).toBeInTheDocument()
  })

  test('the List/Map toggle is still there', () => {
    stubLaptop(false)
    renderApp('/results')
    expect(screen.getByRole('group', { name: 'View' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hide filters' })).toBeNull()
  })

  test('a shared ?listing= link redirects to that listing’s page', async () => {
    stubLaptop(false)
    const { location } = renderApp(`/results?listing=${second.id}`)
    expect(await screen.findByRole('heading', { level: 1, name: second.title })).toBeInTheDocument()
    expect(location().pathname).toBe(`/listing/${second.id}`)
  })

  test('a ?listing= link with an unknown id shows the list', () => {
    stubLaptop(false)
    const { location } = renderApp('/results?listing=nope')
    expect(location().pathname).toBe('/results')
    expect(screen.getAllByRole('article')).toHaveLength(shown.length)
  })
})
