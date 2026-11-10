import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FitBadge from '../components/FitBadge'
import ListingArt from '../components/ListingArt'
import { formatMoney } from '../lib/cost'
import { evaluateOne } from '../lib/filters'
import { getById } from '../lib/listingsRepo'
import { useAppState } from '../state/AppState'

const MAX_COMPARE = 3

export default function Saved() {
  const { savedIds, toggleSaved, budget } = useAppState()
  const [picked, setPicked] = useState<string[]>([])
  const navigate = useNavigate()
  const items = savedIds.map((id) => evaluateOne(getById(id)!, budget ?? Number.MAX_SAFE_INTEGER))
  const chosen = picked.filter((id) => savedIds.includes(id))
  const full = chosen.length >= MAX_COMPARE

  const pick = (id: string, on: boolean) =>
    setPicked((p) => (on ? [...p.filter((x) => savedIds.includes(x)), id] : p.filter((x) => x !== id)))

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <h1 className="font-display text-3xl font-bold">Saved places</h1>
      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-line bg-card p-6">
          <h2 className="font-display text-xl font-bold">Nothing saved yet</h2>
          <p className="mt-2 text-ink-soft">Tap Save on any place to keep it here, then compare up to 3 side by side.</p>
          <Link to="/results" className="mt-4 inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-bold text-white">
            Find places
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-1 text-ink-soft" id="compare-hint">
            Pick 2 or 3 to compare side by side.{full && ' You can compare up to 3 at a time.'}
          </p>
          <ul className="mt-4 grid gap-3">
            {items.map(({ listing: l, cost, fit }) => {
              const isPicked = chosen.includes(l.id)
              return (
                <li key={l.id} className="flex gap-3 rounded-2xl border border-line bg-card p-3">
                  <ListingArt id={l.id} type={l.type} className="h-20 w-24 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/listing/${l.id}`} className="font-bold underline">
                      {l.title}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="font-display text-xl font-bold">{formatMoney(cost.total)}</span>
                      {budget !== null && <FitBadge fit={fit} />}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4">
                      <label className="flex min-h-11 items-center gap-2">
                        <input
                          type="checkbox"
                          className="size-5 accent-ink"
                          checked={isPicked}
                          disabled={!isPicked && full}
                          aria-label={`Compare ${l.title}`}
                          aria-describedby="compare-hint"
                          onChange={(e) => pick(l.id, e.target.checked)}
                        />
                        Compare
                      </label>
                      <button
                        type="button"
                        aria-label={`Remove ${l.title}`}
                        className="min-h-11 text-sm font-bold underline"
                        onClick={() => toggleSaved(l.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] mt-4 flex justify-center">
            <button
              type="button"
              disabled={chosen.length < 2}
              onClick={() => navigate(`/compare?ids=${chosen.join(',')}`)}
              className="min-h-12 rounded-full bg-ink px-8 font-bold text-white disabled:bg-line disabled:text-ink-soft"
            >
              {chosen.length < 2 ? 'Pick 2 or 3 to compare' : `Compare ${chosen.length} places`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
