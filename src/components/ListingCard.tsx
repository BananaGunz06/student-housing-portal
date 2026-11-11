import { Link } from 'react-router-dom'
import { HOUSING_TYPE_LABELS } from '../data/types'
import { shortCommute } from '../lib/commute'
import { budgetGapText, formatMoney } from '../lib/cost'
import type { ListingResult } from '../lib/filters'
import BudgetMeter from './BudgetMeter'
import FitBadge from './FitBadge'
import ListingArt from './ListingArt'
import SaveButton from './SaveButton'

export default function ListingCard({ result, budget }: { result: ListingResult; budget: number }) {
  const { listing: l, cost, fit, commute } = result
  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-card">
      <ListingArt id={l.id} type={l.type} className="h-28 w-full" />
      <SaveButton id={l.id} title={l.title} className="absolute top-3 right-3 z-10 min-h-10 px-3 text-sm" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-3xl leading-none font-bold tabular-nums">
            {formatMoney(cost.total)}
            <span className="ml-1 font-sans text-sm font-normal text-ink-soft">a month, all-in</span>
          </p>
          <FitBadge fit={fit} />
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Advertised rent {formatMoney(l.rent)}
        </p>
        <BudgetMeter total={cost.total} budget={budget} fit={fit} />
        <p className="mt-1.5 text-sm text-ink-soft">{budgetGapText(cost.total, budget)}</p>
        <h2 className="mt-3 text-lg leading-snug font-bold">
          <Link
            to={`/listing/${l.id}`}
            className="after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-ink focus-visible:after:rounded-2xl"
          >
            {l.title}
          </Link>
        </h2>
        <p className="text-sm text-ink-soft">
          {HOUSING_TYPE_LABELS[l.type]} in {l.neighbourhood}
        </p>
        <p className="mt-2 text-sm font-bold">{shortCommute(commute)} to campus</p>
      </div>
    </article>
  )
}
