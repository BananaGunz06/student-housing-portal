import { activeFilterCount, filterChips, type Filters } from '../lib/filters'

/**
 * The filters you've applied, always visible above the results. On phones the
 * row starts with "All filters", which opens the slide-in panel.
 */
export default function FilterChips({
  filters,
  onChange,
  onOpenAll,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  onOpenAll: () => void
}) {
  const chips = filterChips(filters)
  const n = activeFilterCount(filters)
  return (
    <div className={`flex items-center gap-2 ${chips.length ? '' : 'lg:hidden'}`}>
      <button
        type="button"
        onClick={onOpenAll}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-2 border-ink bg-card px-3.5 text-sm font-bold lg:hidden"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        All filters{n > 0 && ` (${n})`}
      </button>
      {chips.length > 0 && (
        <ul aria-label="Applied filters" className="-my-1 flex min-w-0 gap-2 overflow-x-auto py-1 lg:flex-wrap lg:overflow-visible">
          {chips.map((c) => (
            <li key={c.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onChange(c.without)}
                aria-label={`Remove filter: ${c.label}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink py-1 pr-2 pl-3.5 text-sm font-bold text-on-ink"
              >
                {c.label}
                <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-on-ink/20">
                  ✕
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
