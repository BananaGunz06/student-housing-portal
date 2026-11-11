import { useRef, useState, type ReactNode } from 'react'
import { HOUSING_TYPE_LABELS, type HousingType } from '../data/types'
import { DEFAULT_FILTERS, type Filters } from '../lib/filters'
import { plural } from '../lib/format'
import { useModal } from '../lib/useModal'

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
  `min-h-11 rounded-full border-2 px-4 font-bold ${on ? 'border-ink bg-ink text-white' : 'border-line bg-card text-ink'}`

/** Bottom sheet; edits a draft and applies it on "Show N places". */
export default function FilterSheet({
  initial,
  countFor,
  onApply,
  onClose,
}: {
  initial: Filters
  countFor: (f: Filters) => number
  onApply: (f: Filters) => void
  onClose: () => void
}) {
  const [f, setF] = useState(initial)
  const closeRef = useRef<HTMLButtonElement>(null)
  const set = (patch: Partial<Filters>) => setF((p) => ({ ...p, ...patch }))
  const count = countFor(f)

  const dialogRef = useModal(onClose, closeRef)

  const toggleType = (t: HousingType) =>
    set({ types: f.types.includes(t) ? f.types.filter((x) => x !== t) : [...f.types, t] })

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filters-title"
        className="relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl bg-paper"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 id="filters-title" className="font-display text-2xl font-bold">
            Filters
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} className="min-h-11 rounded-full px-3 font-bold underline">
            Close
          </button>
        </div>
        <div className="divide-y divide-line overflow-y-auto px-5">
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
        <div className="flex gap-3 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" className="min-h-12 rounded-full px-4 font-bold underline" onClick={() => setF({ ...DEFAULT_FILTERS })}>
            Clear all
          </button>
          <button
            type="button"
            className="min-h-12 flex-1 rounded-full bg-ink px-6 font-bold text-white"
            onClick={() => {
              onApply(f)
              onClose()
            }}
          >
            Show {plural(count, 'place')}
          </button>
        </div>
      </div>
    </div>
  )
}
