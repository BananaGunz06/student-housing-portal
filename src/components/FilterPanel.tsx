import type { ReactNode } from 'react'
import { HOUSING_TYPE_LABELS, type HousingType } from '../data/types'
import { activeFilterCount, DEFAULT_FILTERS, type Filters } from '../lib/filters'
import { plural } from '../lib/format'

const BEDROOMS: { value: Filters['bedrooms']; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 0, label: 'Studio' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3+' },
]
const COMMUTES = [null, 10, 15, 20, 30] as const

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="py-4">
      <legend className="mb-2 font-bold">{legend}</legend>
      {children}
    </fieldset>
  )
}

const chip = (on: boolean) =>
  `min-h-11 rounded-full border-2 px-3.5 text-sm font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card text-ink'}`

/**
 * Every filter, applied as soon as it changes. Used in the laptop sidebar
 * and the phone slide-in, so both look and behave the same.
 */
export default function FilterPanel({
  filters: f,
  onChange,
  count,
  titleId,
  headerAction,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  /** Places shown with these filters. */
  count: number
  titleId: string
  headerAction?: ReactNode
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...f, ...patch })
  const toggleType = (t: HousingType) =>
    set({ types: f.types.includes(t) ? f.types.filter((x) => x !== t) : [...f.types, t] })
  const active = activeFilterCount(f)

  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2 id={titleId} className="font-display text-2xl font-bold">
            Filters
          </h2>
          <p className="text-sm text-ink-soft" aria-live="polite">
            {plural(count, 'place')}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={active === 0}
            onClick={() => onChange({ ...DEFAULT_FILTERS })}
            className="min-h-11 rounded-full px-3 font-bold underline disabled:text-ink-soft disabled:no-underline"
          >
            Clear all
          </button>
          {headerAction}
        </div>
      </div>
      <div className="divide-y divide-line">
        <Group legend="Bedrooms">
          <div className="flex flex-wrap gap-2">
            {BEDROOMS.map((b) => (
              <button key={b.label} type="button" aria-pressed={f.bedrooms === b.value} className={chip(f.bedrooms === b.value)} onClick={() => set({ bedrooms: b.value })}>
                {b.label}
              </button>
            ))}
          </div>
        </Group>
        <Group legend="Type of place">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(HOUSING_TYPE_LABELS) as HousingType[]).map((t) => (
              <button key={t} type="button" aria-pressed={f.types.includes(t)} className={chip(f.types.includes(t))} onClick={() => toggleType(t)}>
                {HOUSING_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </Group>
        <Group legend="Longest commute to campus">
          <div className="flex flex-wrap gap-2">
            {COMMUTES.map((m) => (
              <button key={String(m)} type="button" aria-pressed={f.maxCommute === m} className={chip(f.maxCommute === m)} onClick={() => set({ maxCommute: m })}>
                {m === null ? 'Any' : `${m} min`}
              </button>
            ))}
          </div>
        </Group>
        <Group legend="Moving in">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-ink-soft">Only show places available by</span>
            <input
              type="month"
              className="min-h-11 rounded-xl border-2 border-line bg-card px-3"
              value={f.moveIn ?? ''}
              onChange={(e) => set({ moveIn: e.target.value || null })}
            />
          </label>
        </Group>
        <Group legend="More">
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5 accent-ink" checked={f.furnishedOnly} onChange={(e) => set({ furnishedOnly: e.target.checked })} />
            Furnished only
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5 accent-ink" checked={f.showOver} onChange={(e) => set({ showOver: e.target.checked })} />
            Also show places over my budget
          </label>
        </Group>
      </div>
    </div>
  )
}
