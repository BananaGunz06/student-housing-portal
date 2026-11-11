import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import BudgetInput from '../components/BudgetInput'
import FilterChips from '../components/FilterChips'
import FilterDrawer from '../components/FilterDrawer'
import FilterPanel from '../components/FilterPanel'
import ListingCard from '../components/ListingCard'
import ListingDetailContent from '../components/ListingDetailContent'
import { formatMoney } from '../lib/cost'
import {
  applyFilters,
  DEFAULT_FILTERS,
  evaluate,
  nearestBudgetWithResults,
} from '../lib/filters'
import { plural } from '../lib/format'
import { getAll, getById } from '../lib/listingsRepo'
import { useLocalStorage } from '../lib/storage'
import { useMediaQuery } from '../lib/useMediaQuery'
import { useAppState } from '../state/AppState'

const MapView = lazy(() => import('../components/MapView'))

export default function Results() {
  const { budget, setBudget, filters, setFilters } = useAppState()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const sidebarTitleId = useId()
  const view = params.get('view') === 'map' ? 'map' : 'list'

  // Laptop split view: list and map side by side, details open in the list column.
  const isLg = useMediaQuery('(min-width: 1024px)')
  const navigate = useNavigate()
  const location = useLocation()
  const [filtersOpen, setFiltersOpen] = useLocalStorage('shp.filtersOpen', true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const openedRef = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const selectedListing = useMemo(() => {
    const id = params.get('listing')
    return id ? getById(id) : undefined
  }, [params])
  const selectedId = selectedListing?.id ?? null

  const results = useMemo(() => evaluate(getAll(), budget ?? 0), [budget])
  const shown = useMemo(() => applyFilters(results, filters), [results, filters])
  const onMap = useMemo(() => applyFilters(results, { ...filters, showOver: true }), [results, filters])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  // The map always shows the open place, even if the filters would hide it.
  const mapResults = useMemo(() => {
    const open = selectedId ? results.find((r) => r.listing.id === selectedId) : undefined
    return open && !onMap.includes(open) ? [...onMap, open] : onMap
  }, [onMap, results, selectedId])

  // Opening a place moves focus to its heading; closing it returns focus to the card that opened it.
  useEffect(() => {
    if (!isLg) return
    if (selectedId) {
      openedRef.current = selectedId
      headingRef.current?.focus()
    } else if (openedRef.current) {
      listRef.current?.querySelector<HTMLElement>(`[data-card-link="${openedRef.current}"]`)?.focus()
      openedRef.current = null
    }
  }, [isLg, selectedId])

  if (budget === null) return <Navigate to="/" replace />
  // Phones have no side panel: a shared ?listing= link goes to the listing page.
  if (!isLg && selectedId) return <Navigate to={`/listing/${selectedId}`} replace />

  const fits = shown.filter((r) => r.fit === 'fits').length
  const stretch = shown.filter((r) => r.fit === 'stretch').length
  const over = shown.length - fits - stretch
  const suggestion = shown.length === 0 ? nearestBudgetWithResults(getAll(), filters, budget) : null

  const setView = (v: 'list' | 'map') => setParams(v === 'map' ? { view: 'map' } : {}, { replace: true })
  const openListing = (id: string) =>
    navigate(
      { pathname: '/results', search: `?listing=${id}` },
      // First open adds a history step (so the browser Back button closes it); switching pins swaps it.
      { replace: selectedId !== null, state: { inApp: selectedId ? location.state?.inApp : true } },
    )
  const closeListing = () => {
    if (location.state?.inApp) navigate(-1)
    else navigate('/results', { replace: true })
  }
  const toggle = (on: boolean) =>
    `min-h-11 flex-1 rounded-full px-4 font-bold ${on ? 'bg-ink text-white' : 'text-ink'}`

  const listHeading = (
    <>
      <h1 id="results-title" className="font-display text-2xl font-bold">
        Places in Guelph for your budget
      </h1>
      <p className="mt-1 text-ink-soft" aria-live="polite">
        {shown.length === 0
          ? 'No places match yet.'
          : `${plural(fits, 'place')} ${fits === 1 ? 'fits' : 'fit'}${stretch ? `, ${stretch} ${stretch === 1 ? 'is a stretch' : 'are a stretch'} (up to 10% over)` : ''}${over ? `, ${over} over budget` : ''}. Cheapest first.`}
      </p>

      {shown.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-line bg-card p-6">
          <h2 className="font-display text-2xl font-bold">Nothing fits {formatMoney(budget)}</h2>
          {suggestion ? (
            <>
              <p className="mt-2 text-ink-soft">
                {plural(suggestion.count, 'place')} {suggestion.count === 1 ? 'fits' : 'fit'} at {formatMoney(suggestion.budget)}.
              </p>
              <button
                type="button"
                onClick={() => setBudget(suggestion.budget)}
                className="mt-4 min-h-12 rounded-full bg-ink px-6 font-bold text-white"
              >
                Try {formatMoney(suggestion.budget)}
              </button>
            </>
          ) : (
            <>
              <p className="mt-2 text-ink-soft">No place matches these filters at any price.</p>
              <button
                type="button"
                onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                className="mt-4 min-h-12 rounded-full bg-ink px-6 font-bold text-on-ink"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <ul className={`mt-4 grid gap-4 ${isLg ? '' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
          {shown.map((r) => (
            <li key={r.listing.id} className="flex">
              <div className="w-full">
                <ListingCard
                  result={r}
                  budget={budget}
                  {...(isLg && {
                    to: { pathname: '/results', search: `?listing=${r.listing.id}` },
                    linkState: { inApp: true },
                    onHover: setHoveredId,
                  })}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-center text-sm text-ink-soft">
        Sample listings for a demo. <Link to="/saved" className="underline">See your saved places</Link>
      </p>
    </>
  )

  return (
    <>
      <header className="sticky top-0 z-[1050] border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 lg:max-w-none">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-ink-soft">Your budget, all-in</p>
              <p className="font-display text-3xl leading-tight font-bold">
                <span className="highlight">{formatMoney(budget)}</span>
                <span className="font-sans text-base font-normal text-ink-soft"> a month</span>
              </p>
            </div>
            <button
              type="button"
              aria-expanded={editing}
              aria-controls="budget-editor"
              onClick={() => setEditing((e) => !e)}
              className="min-h-11 rounded-full border-2 border-ink px-4 font-bold"
            >
              {editing ? 'Done' : 'Change budget'}
            </button>
          </div>
          {editing && (
            <div id="budget-editor" className="mt-3">
              <label htmlFor="budget-edit" className="sr-only">
                Monthly budget
              </label>
              <BudgetInput id="budget-edit" value={budget} onChange={setBudget} />
            </div>
          )}
          {!isLg && (
            <div className="mt-3 flex gap-2">
              <div className="flex flex-1 rounded-full border-2 border-ink p-0.5" role="group" aria-label="View">
                <button type="button" aria-pressed={view === 'list'} className={toggle(view === 'list')} onClick={() => setView('list')}>
                  List
                </button>
                <button type="button" aria-pressed={view === 'map'} className={toggle(view === 'map')} onClick={() => setView('map')}>
                  Map
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {isLg ? (
        // Header is about 5.25rem; the fixed nav is 3.5rem and the layout leaves 6rem under the page.
        <div
          className={`-mb-10 grid h-[calc(100dvh-5.25rem-3.5rem)] ${
            filtersOpen
              ? 'grid-cols-[17rem_minmax(22rem,28rem)_minmax(0,1fr)]'
              : 'grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)]'
          }`}
        >
          {filtersOpen && (
            <aside
              id="filters-sidebar"
              aria-labelledby={sidebarTitleId}
              className="h-full overflow-y-auto border-r border-line px-4 pt-3 pb-6"
            >
              <FilterPanel filters={filters} onChange={setFilters} count={shown.length} titleId={sidebarTitleId} />
            </aside>
          )}
          <div className="relative h-full min-w-0 border-r border-line">
            <div
              ref={listRef}
              inert={selectedListing ? true : undefined}
              aria-hidden={selectedListing ? true : undefined}
              className="h-full overflow-y-auto px-4 pb-6"
            >
              <div className="flex flex-wrap items-center gap-2 pt-3">
                <button
                  type="button"
                  aria-expanded={filtersOpen}
                  aria-controls="filters-sidebar"
                  onClick={() => setFiltersOpen((o) => !o)}
                  className="min-h-11 rounded-full border-2 border-ink px-4 font-bold"
                >
                  {filtersOpen ? 'Hide filters' : 'Show filters'}
                </button>
              </div>
              <FilterChips filters={filters} onChange={setFilters} onOpenAll={() => setDrawerOpen(true)} />
              <section className="pt-4" aria-labelledby="results-title">
                {listHeading}
              </section>
            </div>
            {selectedListing && (
              <div className="absolute inset-0 overflow-y-auto bg-paper">
                <div className="sticky top-0 z-10 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur">
                  <button
                    type="button"
                    onClick={closeListing}
                    className="inline-flex min-h-11 items-center font-bold underline"
                  >
                    Back to list
                  </button>
                </div>
                <ListingDetailContent
                  key={selectedListing.id}
                  listing={selectedListing}
                  variant="panel"
                  headingRef={headingRef}
                />
              </div>
            )}
          </div>
          <div className="h-full min-w-0">
            <Suspense fallback={<p className="p-4">Loading map…</p>}>
              <MapView
                results={mapResults}
                onShowList={closeListing}
                selectedId={selectedId}
                hoveredId={hoveredId}
                onSelect={openListing}
                className="h-full"
                showHeading={false}
              />
            </Suspense>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-8 lg:px-4">
          {/* Hidden by CSS on phones; where matchMedia is missing, laptop-wide browsers still get it. */}
          <aside
            aria-labelledby={sidebarTitleId}
            className="sticky top-40 hidden max-h-[calc(100dvh-11rem)] self-start overflow-y-auto pt-5 pr-1 pb-6 lg:block"
          >
            <FilterPanel filters={filters} onChange={setFilters} count={shown.length} titleId={sidebarTitleId} />
          </aside>
          <div className="min-w-0">
            <div className="px-4 pt-4 lg:px-0">
              <FilterChips filters={filters} onChange={setFilters} onOpenAll={() => setDrawerOpen(true)} />
            </div>
            {view === 'map' ? (
              <Suspense fallback={<p className="p-4">Loading map…</p>}>
                <MapView results={onMap} onShowList={() => setView('list')} />
              </Suspense>
            ) : (
              <section className="px-4 pt-4 lg:px-0" aria-labelledby="results-title">
                {listHeading}
              </section>
            )}
          </div>
        </div>
      )}

      {drawerOpen && (
        <FilterDrawer filters={filters} onChange={setFilters} count={shown.length} onClose={closeDrawer} />
      )}
    </>
  )
}
