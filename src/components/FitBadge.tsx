import { FIT_ICON, FIT_LABEL, type FitStatus } from '../lib/cost'

const STYLE: Record<FitStatus, string> = {
  fits: 'bg-fits-bg text-fits border-fits/30',
  stretch: 'bg-stretch-bg text-stretch border-stretch/30',
  over: 'bg-over-bg text-over border-over/30',
}

/** Fit status as text + icon, never colour alone. */
export default function FitBadge({ fit, className = '' }: { fit: FitStatus; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-bold ${STYLE[fit]} ${className}`}
    >
      <span aria-hidden="true">{FIT_ICON[fit]}</span>
      {FIT_LABEL[fit]}
    </span>
  )
}
