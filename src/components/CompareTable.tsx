import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { HOUSING_TYPE_LABELS } from '../data/types'
import { shortCommute } from '../lib/commute'
import { formatMoney } from '../lib/cost'
import type { ListingResult } from '../lib/filters'
import { bedroomsLabel, formatMonth } from '../lib/format'
import FitBadge from './FitBadge'
import ListingArt from './ListingArt'

export default function CompareTable({ results, showFit }: { results: ListingResult[]; showFit: boolean }) {
  const lowest = Math.min(...results.map((r) => r.cost.total))
  const rows: { label: string; cell: (r: ListingResult) => ReactNode }[] = [
    {
      label: 'True monthly cost',
      cell: (r) => (
        <>
          <span className="font-display text-2xl font-bold">{formatMoney(r.cost.total)}</span>
          {r.cost.total === lowest && (
            <span className="mt-1 block w-fit rounded-full bg-highlight px-2 text-sm font-bold">Lowest</span>
          )}
        </>
      ),
    },
    ...(showFit ? [{ label: 'Your budget', cell: (r: ListingResult) => <FitBadge fit={r.fit} /> }] : []),
    { label: 'Advertised rent', cell: (r) => formatMoney(r.listing.rent) },
    {
      label: 'Included',
      cell: (r) =>
        r.listing.included.length ? (
          <ul className="list-disc pl-4">
            {r.listing.included.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        ) : (
          'Nothing extra'
        ),
    },
    { label: 'Commute', cell: (r) => shortCommute(r.commute) },
    { label: 'Lease', cell: (r) => `${r.listing.leaseMonths} months` },
    { label: 'Bedrooms', cell: (r) => bedroomsLabel(r.listing) },
    { label: 'Available from', cell: (r) => formatMonth(r.listing.availableFrom) },
    { label: 'Furnished', cell: (r) => (r.listing.furnished ? 'Yes' : 'No') },
  ]

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full min-w-[34rem] border-collapse text-left align-top">
        <caption className="sr-only">Saved places side by side</caption>
        <thead>
          <tr>
            <td className="sticky left-0 w-28 bg-card" />
            {results.map((r) => (
              <th key={r.listing.id} scope="col" className="p-3 align-top font-normal">
                <ListingArt id={r.listing.id} type={r.listing.type} className="mb-2 h-16 w-full rounded-lg" />
                <Link to={`/listing/${r.listing.id}`} className="font-bold underline">
                  {r.listing.title}
                </Link>
                <span className="block text-sm text-ink-soft">
                  {HOUSING_TYPE_LABELS[r.listing.type]}, {r.listing.neighbourhood}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-line">
              <th scope="row" className="sticky left-0 bg-card p-3 align-top text-sm font-bold text-ink-soft">
                {row.label}
              </th>
              {results.map((r) => (
                <td key={r.listing.id} className="p-3 align-top">
                  {row.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
