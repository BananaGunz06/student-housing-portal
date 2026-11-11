import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import BudgetInput from '../components/BudgetInput'
import FilterSheet from '../components/FilterSheet'
import ListingCard from '../components/ListingCard'
import { formatMoney } from '../lib/cost'
import {
  activeFilterCount,
  applyFilters,
  evaluate,
  nearestBudgetWithResults,
  type Filters,
} from '../lib/filters'
import { plural } from '../lib/format'
import { getAll } from '../lib/listingsRepo'
import { useAppState } from '../state/AppState'

const MapView = lazy(() => import('../components/MapView'))

export default function Results() {
  const { budget, setBudget, filters, setFilters } = useAppState()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const view = params.get('view') === 'map' ? 'map' : 'list'

  const results = useMemo(() => evaluate(getAll(), budget ?? 0), [budget])
  const shown = useMemo(() => applyFilters(results, filters), [results, filters])
  const onMap = useMemo(() => applyFilters(results, { ...filters, showOver: true }), [results, filters])
  const countFor = useCallback((f: Filters) => applyFilters(results, f).length, [results])
  const closeSheet = useCallback(() => setSheetOpen(false), [])

  if (budget === null) return <Navigate to="/" replace />

  const fits = shown.filter((r) => r.fit === 'fits').length
  const stretch = shown.filter((r) => r.fit === 'stretch').length
  const over = shown.length - fits - stretch
  const nFilters = activeFilterCount(filters)
  const suggestion = shown.length === 0 ? nearestBudgetWithResults(getAll(), filters, budget) : null

  const setView = (v: 'list' | 'map') => setParams(v === 'map' ? { view: 'map' } : {}, { replace: true })
  const toggle = (on: boolean) =>
    `min-h-11 flex-1 rounded-full px-4 font-bold ${on ? 'bg-ink text-white' : 'text-ink'}`

  return (
    <>
      <header className="sticky top-0 z-[1050] border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3">
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
          <div className="mt-3 flex gap-2">
            <div className="flex flex-1 rounded-full border-2 border-ink p-0.5" role="group" aria-label="View">
              <button type="button" aria-pressed={view === 'list'} className={toggle(view === 'list')} onClick={() => setView('list')}>
                List
              </button>
              <button type="button" aria-pressed={view === 'map'} className={toggle(view === 'map')} onClick={() => setView('map')}>
                Map
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="min-h-12 rounded-full border-2 border-ink bg-card px-4 font-bold"
            >
              Filters{nFilters > 0 && ` (${nFilters})`}
            </button>
          </div>
        </div>
      </header>

      {view === 'map' ? (
        <Suspense fallback={<p className="p-4">Loading map…</p>}>
          <MapView results={onMap} onShowList={() => setView('list')} />
        </Suspense>
      ) : (
        <section className="mx-auto max-w-5xl px-4 pt-5" aria-labelledby="results-title">
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
                    onClick={() => setSheetOpen(true)}
                    className="mt-4 min-h-12 rounded-full bg-ink px-6 font-bold text-white"
                  >
                    Change filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((r) => (
                <li key={r.listing.id} className="flex">
                  <div className="w-full">
                    <ListingCard result={r} budget={budget} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-8 text-center text-sm text-ink-soft">
            Sample listings for a demo. <Link to="/saved" className="underline">See your saved places</Link>
          </p>
        </section>
      )}

      {sheetOpen && (
        <FilterSheet initial={filters} countFor={countFor} onApply={setFilters} onClose={closeSheet} />
      )}
    </>
  )
}
