import { Link, useSearchParams } from 'react-router-dom'
import CompareTable from '../components/CompareTable'
import { evaluateOne } from '../lib/filters'
import { getById } from '../lib/listingsRepo'
import { useAppState } from '../state/AppState'

export default function Compare() {
  const [params] = useSearchParams()
  const { budget } = useAppState()
  const ids = [...new Set((params.get('ids') ?? '').split(',').filter(Boolean))]
  const results = ids
    .map((id) => getById(id))
    .filter((l) => l !== undefined)
    .slice(0, 3)
    .map((l) => evaluateOne(l, budget ?? Number.MAX_SAFE_INTEGER))

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6">
      <Link to="/saved" className="inline-flex min-h-11 items-center font-bold underline">
        Back to saved
      </Link>
      {results.length < 2 ? (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-line bg-card p-6">
          <h1 className="font-display text-2xl font-bold">Pick at least 2 places to compare</h1>
          <p className="mt-2 text-ink-soft">Choose 2 or 3 from your saved places.</p>
        </div>
      ) : (
        <>
          <h1 className="mt-2 font-display text-3xl font-bold">Compare {results.length} places</h1>
          <p className="mt-1 mb-4 text-ink-soft">True monthly cost includes utilities, internet and the bus pass.</p>
          <CompareTable results={results} showFit={budget !== null} />
        </>
      )}
    </div>
  )
}
