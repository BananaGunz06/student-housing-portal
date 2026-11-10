import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import BudgetInput from '../components/BudgetInput'
import { CAMPUS } from '../data/campus'
import type { Filters } from '../lib/filters'
import { useAppState } from '../state/AppState'

const BEDROOMS: { value: Filters['bedrooms']; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 1, label: 'A room or 1 bed' },
  { value: 0, label: 'Studio' },
  { value: 2, label: '2 beds' },
  { value: 3, label: '3+ beds' },
]

export default function Welcome() {
  const { budget, setBudget, filters, setFilters } = useAppState()
  const [draft, setDraft] = useState(budget ?? 900)
  const [moveIn, setMoveIn] = useState(filters.moveIn ?? '')
  const [bedrooms, setBedrooms] = useState<Filters['bedrooms']>(filters.bedrooms)
  const navigate = useNavigate()

  function submit(e: FormEvent) {
    e.preventDefault()
    // Commit anything still being typed in the budget field.
    const active = document.activeElement
    if (active instanceof HTMLInputElement) active.blur()
    setBudget(draft)
    setFilters({ ...filters, moveIn: moveIn || null, bedrooms })
    navigate('/results')
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col px-5 pt-10 pb-8">
      <p className="font-bold text-ink-soft">Student housing near {CAMPUS.name}</p>
      <form onSubmit={submit} className="mt-6 flex flex-1 flex-col">
        <h1 className="font-display text-4xl leading-[1.05] font-bold">
          <label htmlFor="budget">What can you spend per month, all-in?</label>
        </h1>
        <p className="mt-3 text-ink-soft">
          Rent, utilities, internet and getting to campus. We’ll only show places where the real total fits.
        </p>
        <div className="mt-6">
          <BudgetInput id="budget" size="lg" value={draft} onChange={setDraft} />
        </div>

        <details className="mt-6 rounded-2xl border border-line bg-card px-4 [&[open]>summary]:mb-2">
          <summary className="flex min-h-12 cursor-pointer items-center font-bold">More details (optional)</summary>
          <label className="mt-2 flex flex-col gap-1">
            <span>When do you move in?</span>
            <input
              type="month"
              className="min-h-11 rounded-xl border-2 border-line bg-paper px-3"
              value={moveIn}
              onChange={(e) => setMoveIn(e.target.value)}
            />
          </label>
          <fieldset className="mt-4 pb-4">
            <legend className="mb-2">How many bedrooms?</legend>
            <div className="flex flex-wrap gap-2">
              {BEDROOMS.map((b) => (
                <button
                  key={b.label}
                  type="button"
                  aria-pressed={bedrooms === b.value}
                  onClick={() => setBedrooms(b.value)}
                  className={`min-h-11 rounded-full border-2 px-4 font-bold ${
                    bedrooms === b.value ? 'border-ink bg-ink text-white' : 'border-line bg-paper'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </fieldset>
        </details>

        <button type="submit" className="mt-auto min-h-14 rounded-full bg-ink px-6 text-lg font-bold text-white sm:mt-8">
          Show places that fit
        </button>
        <p className="mt-3 text-center text-sm text-ink-soft">No sign-up. Your budget stays on this device.</p>
      </form>
    </main>
  )
}
