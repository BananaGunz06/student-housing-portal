import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import BudgetInput from '../components/BudgetInput'
import { CAMPUS } from '../data/campus'
import { STAY_OPTIONS, type Stay } from '../lib/filters'
import { termOptionsWith, upcomingTerms } from '../lib/profile'
import { useAppState } from '../state/AppState'

export default function Welcome() {
  const { budget, setBudget, filters, setFilters } = useAppState()
  const [draft, setDraft] = useState(budget ?? 900)
  const [term, setTerm] = useState(filters.moveInTerm ?? '')
  const [stay, setStay] = useState<Stay>(filters.stay)
  const [upcoming] = useState(() => upcomingTerms(new Date()))
  const terms = termOptionsWith(upcoming, filters.moveInTerm)
  const navigate = useNavigate()

  function submit(e: FormEvent) {
    e.preventDefault()
    // Commit anything still being typed in the budget field.
    const active = document.activeElement
    if (active instanceof HTMLInputElement) active.blur()
    setBudget(draft)
    setFilters({ ...filters, moveInTerm: term || null, stay })
    navigate('/results')
  }

  return (
    <main className="mx-auto flex min-h-[calc(100%-var(--banner-h,0px))] max-w-md flex-col px-5 pt-10 pb-8">
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

          <label className="mt-6 flex flex-col gap-1">
            <span>Which term do you move in?</span>
            <select
              className="min-h-11 rounded-xl border-2 border-line bg-paper px-3"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            >
              <option value="">Not sure yet</option>
              {terms.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="mt-5">
            <legend className="mb-2">For how long?</legend>
            <div className="flex flex-wrap gap-2">
              {STAY_OPTIONS.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={stay === o.value}
                  onClick={() => setStay(o.value)}
                  className={`min-h-11 rounded-full border-2 px-4 font-bold ${
                    stay === o.value ? 'border-ink bg-ink text-white' : 'border-line bg-paper'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>

        <button type="submit" className="mt-auto min-h-14 rounded-full bg-ink px-6 text-lg font-bold text-white sm:mt-8">
          Show places that fit
        </button>
        <p className="mt-3 text-center text-sm text-ink-soft">No sign-up needed to browse. Your budget stays on this device unless you sign in.</p>
      </form>
    </main>
  )
}
