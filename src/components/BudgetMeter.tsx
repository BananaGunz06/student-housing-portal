import type { FitStatus } from '../lib/cost'

const FILL: Record<FitStatus, string> = {
  fits: 'bg-fits',
  stretch: 'bg-stretch',
  over: 'bg-over',
}

/** Scale runs to 130% of budget; anything beyond is pinned to the end. */
const SCALE = 1.3

/**
 * A bar showing true cost against the budget, with the budget line and the
 * 10% stretch zone marked. Decorative: the badge and text carry the meaning.
 */
export default function BudgetMeter({
  total,
  budget,
  fit,
}: {
  total: number
  budget: number
  fit: FitStatus
}) {
  const pct = (n: number) => `${Math.min(100, (n / (budget * SCALE)) * 100)}%`
  return (
    <div aria-hidden="true" className="relative mt-3 h-2.5 rounded-full bg-paper">
      <div
        className="absolute inset-y-0 rounded-sm"
        style={{
          left: pct(budget),
          width: `calc(${pct(budget * 1.1)} - ${pct(budget)})`,
          backgroundImage:
            'repeating-linear-gradient(135deg, rgb(140 90 14 / 0.4) 0 3px, transparent 3px 6px)',
        }}
      />
      <div className={`absolute inset-y-0 left-0 rounded-full ${FILL[fit]}`} style={{ width: pct(total) }} />
      <div className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: pct(budget) }} />
    </div>
  )
}

