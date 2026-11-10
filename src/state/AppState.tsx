import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { clampBudget } from '../lib/cost'
import { DEFAULT_FILTERS, type Filters } from '../lib/filters'
import { getById } from '../lib/listingsRepo'
import { useLocalStorage } from '../lib/storage'

export interface AppState {
  /** null until the student has told us their budget. */
  budget: number | null
  setBudget: (n: number) => void
  filters: Filters
  setFilters: (f: Filters) => void
  /** Saved listing ids that still exist in the data. */
  savedIds: string[]
  isSaved: (id: string) => boolean
  toggleSaved: (id: string) => void
}

const Ctx = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [budget, setBudgetRaw] = useLocalStorage<number | null>('shp.budget', null)
  const [storedFilters, setFilters] = useLocalStorage<Filters>('shp.filters', DEFAULT_FILTERS)
  const [savedRaw, setSaved] = useLocalStorage<string[]>('shp.saved', [])

  // Stored filters may predate a new field; fill gaps from the defaults.
  const filters = useMemo(() => ({ ...DEFAULT_FILTERS, ...storedFilters }), [storedFilters])
  // A saved place that is no longer listed is dropped quietly.
  const savedIds = useMemo(
    () => (Array.isArray(savedRaw) ? savedRaw.filter((id) => getById(id)) : []),
    [savedRaw],
  )
  const setBudget = useCallback((n: number) => setBudgetRaw(clampBudget(n)), [setBudgetRaw])
  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds])
  const toggleSaved = useCallback(
    (id: string) =>
      setSaved((prev) => {
        const clean = (Array.isArray(prev) ? prev : []).filter((x) => getById(x))
        return clean.includes(id) ? clean.filter((x) => x !== id) : [...clean, id]
      }),
    [setSaved],
  )

  const value = useMemo(
    () => ({
      budget: typeof budget === 'number' ? budget : null,
      setBudget,
      filters,
      setFilters,
      savedIds,
      isSaved,
      toggleSaved,
    }),
    [budget, setBudget, filters, setFilters, savedIds, isSaved, toggleSaved],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAppState(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppState must be used inside AppStateProvider')
  return v
}
