import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { clampBudget } from '../lib/cost'
import { DEFAULT_FILTERS, type Filters } from '../lib/filters'
import { getById } from '../lib/listingsRepo'
import { isMessage, newMessageId, type Message, type SharedDetails } from '../lib/messages'
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
  setSaved: (id: string, saved: boolean) => void
  /** Messages sent from this device, for listings that still exist. */
  messages: Message[]
  sendMessage: (listingId: string, body: string, shared: SharedDetails) => void
  /** What the student shared most recently, to prefill the next message. */
  lastShared: SharedDetails
}

const Ctx = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [budget, setBudgetRaw] = useLocalStorage<number | null>('shp.budget', null)
  const [storedFilters, setFilters] = useLocalStorage<Filters>('shp.filters', DEFAULT_FILTERS)
  const [savedRaw, setSavedRaw] = useLocalStorage<string[]>('shp.saved', [])
  const [messagesRaw, setMessages] = useLocalStorage<Message[]>('shp.messages', [])

  // Stored filters may predate a new field; fill gaps from the defaults.
  const filters = useMemo(() => ({ ...DEFAULT_FILTERS, ...storedFilters }), [storedFilters])
  // A saved place that is no longer listed is dropped quietly.
  const savedIds = useMemo(
    () => (Array.isArray(savedRaw) ? savedRaw.filter((id) => getById(id)) : []),
    [savedRaw],
  )
  const messages = useMemo(
    () => (Array.isArray(messagesRaw) ? messagesRaw.filter((m) => isMessage(m) && getById(m.listingId)) : []),
    [messagesRaw],
  )
  const lastShared = useMemo(() => {
    const withDetails = [...messages].reverse().find((m) => Object.keys(m.shared).length > 0)
    return withDetails?.shared ?? {}
  }, [messages])
  const sendMessage = useCallback(
    (listingId: string, body: string, shared: SharedDetails) =>
      setMessages((prev) => [
        ...(Array.isArray(prev) ? prev.filter(isMessage) : []),
        { id: newMessageId(), listingId, sentAt: new Date().toISOString(), body: body.trim(), shared },
      ]),
    [setMessages],
  )
  const setBudget = useCallback((n: number) => setBudgetRaw(clampBudget(n)), [setBudgetRaw])
  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds])
  const toggleSaved = useCallback(
    (id: string) =>
      setSavedRaw((prev) => {
        const clean = (Array.isArray(prev) ? prev : []).filter((x) => getById(x))
        return clean.includes(id) ? clean.filter((x) => x !== id) : [...clean, id]
      }),
    [setSavedRaw],
  )
  /** Set a place to saved or not saved; unlike toggleSaved, safe to repeat. */
  const setSaved = useCallback(
    (id: string, saved: boolean) =>
      setSavedRaw((prev) => {
        const clean = (Array.isArray(prev) ? prev : []).filter((x) => getById(x))
        if (clean.includes(id) === saved) return clean
        return saved ? [...clean, id] : clean.filter((x) => x !== id)
      }),
    [setSavedRaw],
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
      setSaved,
      messages,
      sendMessage,
      lastShared,
    }),
    [budget, setBudget, filters, setFilters, savedIds, isSaved, toggleSaved, setSaved, messages, sendMessage, lastShared],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAppState(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppState must be used inside AppStateProvider')
  return v
}
