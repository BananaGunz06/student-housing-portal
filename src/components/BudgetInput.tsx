import { useState } from 'react'
import { BUDGET_MIN, BUDGET_SLIDER_MAX, clampBudget } from '../lib/cost'

/**
 * Number field + slider for a monthly budget. The field can be empty or
 * mid-edit; it commits a clamped value on blur or Enter, and reverts if
 * nothing usable was typed.
 */
export default function BudgetInput({
  id,
  value,
  onChange,
  size = 'md',
}: {
  id: string
  value: number
  onChange: (n: number) => void
  size?: 'md' | 'lg'
}) {
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    if (draft === null) return
    if (draft !== '') onChange(clampBudget(Number(draft)))
    setDraft(null)
  }

  const big = size === 'lg'
  return (
    <div>
      <div
        className={`flex items-baseline gap-1 rounded-xl border-2 border-ink bg-card px-3 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-ink ${
          big ? 'py-2' : 'py-1'
        }`}
      >
        <span className={`font-display font-bold ${big ? 'text-4xl' : 'text-2xl'}`} aria-hidden="true">
          $
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className={`w-full min-w-0 bg-transparent font-display font-bold outline-none ${big ? 'text-5xl' : 'text-3xl'}`}
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
        />
        <span className="shrink-0 text-ink-soft">a month</span>
      </div>
      <input
        type="range"
        aria-label="Budget slider"
        className="mt-4 h-8 w-full"
        min={BUDGET_MIN}
        max={BUDGET_SLIDER_MAX}
        step={25}
        value={Math.min(value, BUDGET_SLIDER_MAX)}
        onChange={(e) => {
          setDraft(null)
          onChange(Number(e.target.value))
        }}
      />
      <div className="flex justify-between text-sm text-ink-soft" aria-hidden="true">
        <span>${BUDGET_MIN}</span>
        <span>${BUDGET_SLIDER_MAX.toLocaleString('en-CA')}+</span>
      </div>
    </div>
  )
}
