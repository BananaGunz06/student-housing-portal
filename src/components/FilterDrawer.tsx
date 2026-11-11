import { useId, useRef } from 'react'
import type { Filters } from '../lib/filters'
import { plural } from '../lib/format'
import { useModal } from '../lib/useModal'
import FilterPanel from './FilterPanel'

/** Phones: the filter sidebar slides in from the left. Changes apply as you tap. */
export default function FilterDrawer({
  filters,
  onChange,
  count,
  onClose,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  count: number
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useModal(onClose, closeRef)
  const titleId = useId()

  return (
    <div className="fixed inset-0 z-[1200] flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="drawer-in relative flex h-full w-[min(22rem,88vw)] flex-col bg-paper shadow-xl"
      >
        <div className="flex-1 overflow-y-auto px-5 pt-[max(1rem,env(safe-area-inset-top))]">
          <FilterPanel
            filters={filters}
            onChange={onChange}
            count={count}
            titleId={titleId}
            headerAction={
              <button ref={closeRef} type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-full text-xl font-bold" aria-label="Close filters">
                ✕
              </button>
            }
          />
        </div>
        <div className="border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="min-h-12 w-full rounded-full bg-ink px-6 font-bold text-on-ink">
            Show {plural(count, 'place')}
          </button>
        </div>
      </div>
    </div>
  )
}
