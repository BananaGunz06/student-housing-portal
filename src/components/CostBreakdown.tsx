import { CAMPUS } from '../data/campus'
import type { Listing } from '../data/types'
import { formatMoney, type CostBreakdown as Cost } from '../lib/cost'

function Row({ label, note, value }: { label: string; note?: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt>
        {label}
        {note && <span className="block text-sm text-ink-soft">{note}</span>}
      </dt>
      <dd className="shrink-0 font-bold tabular-nums">{value}</dd>
    </div>
  )
}

/** Rent + utilities + internet + transit = true monthly cost. */
export default function CostBreakdown({
  listing,
  cost,
  budget,
}: {
  listing: Listing
  cost: Cost
  budget: number | null
}) {
  const extra = (included: boolean, n: number) => (included ? 'Included' : `≈${formatMoney(n)}`)
  const left = budget === null ? null : budget - cost.total
  return (
    <div className="rounded-2xl border border-line bg-card px-4">
      <dl className="divide-y divide-dashed divide-line">
        <Row label="Rent" note="As advertised" value={formatMoney(cost.rent)} />
        <Row
          label="Utilities"
          note={listing.utilitiesIncluded ? 'Heat, hydro and water in the rent' : 'Estimate for heat, hydro and water'}
          value={extra(listing.utilitiesIncluded, cost.utilities)}
        />
        <Row
          label="Internet"
          note={listing.internetIncluded ? 'In the rent' : 'Estimate for a basic plan'}
          value={extra(listing.internetIncluded, cost.internet)}
        />
        <Row label="Bus pass" note={CAMPUS.transitNote} value={formatMoney(cost.transit)} />
        <div className="flex items-baseline justify-between gap-4 border-t-2 border-ink py-3">
          <dt className="font-bold">True monthly cost</dt>
          <dd className="font-display text-3xl font-bold tabular-nums" data-testid="true-total">
            {formatMoney(cost.total)}
          </dd>
        </div>
      </dl>
      {left !== null && (
        <p className="border-t border-line py-3 text-ink-soft">
          {left >= 0 ? (
            <>
              <strong className="text-ink">{formatMoney(left)}</strong> left of your {formatMoney(budget!)} budget
            </>
          ) : (
            <>
              <strong className="text-over">{formatMoney(-left)}</strong> over your {formatMoney(budget!)} budget
            </>
          )}
        </p>
      )}
    </div>
  )
}
