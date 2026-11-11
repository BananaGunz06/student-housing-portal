import { lazy, Suspense, useId, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CostBreakdown from '../components/CostBreakdown'
import FitBadge from '../components/FitBadge'
import MessageSheet from '../components/MessageSheet'
import PosterCard from '../components/PosterCard'
import ListingArt from '../components/ListingArt'
import SaveButton from '../components/SaveButton'
import { HOUSING_TYPE_LABELS } from '../data/types'
import { describeCommute } from '../lib/commute'
import { formatMoney } from '../lib/cost'
import { evaluateOne } from '../lib/filters'
import { bedroomsLabel, formatMonth } from '../lib/format'
import { getById } from '../lib/listingsRepo'
import { useAccount } from '../state/AccountState'
import { useAppState } from '../state/AppState'
import NotFound from './NotFound'

const MiniMap = lazy(() => import('../components/MiniMap'))

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <section className="mt-8" aria-labelledby={id}>
      <h2 id={id} className="font-display text-xl font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export default function ListingDetail() {
  const { id = '' } = useParams()
  const { budget } = useAppState()
  const { requireAccount } = useAccount()
  const [messaging, setMessaging] = useState(false)
  const [sentNote, setSentNote] = useState(false)
  const listing = getById(id)
  if (!listing) {
    return <NotFound title="We couldn’t find that place" body="It may have been taken off the list." />
  }
  const { cost, fit, commute } = evaluateOne(listing, budget ?? Number.MAX_SAFE_INTEGER)
  const l = listing

  return (
    <article className="mx-auto max-w-3xl pb-24">
      <div className="px-4 py-3">
        <Link to="/results" className="inline-flex min-h-11 items-center font-bold underline">
          Back to results
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-1 sm:px-4">
        <ListingArt id={l.id} type={l.type} className="col-span-3 aspect-[16/9] w-full sm:rounded-t-2xl" />
        <ListingArt id={l.id} type={l.type} variant="room" className="col-span-1 aspect-[16/9] w-full sm:rounded-bl-2xl" />
        <ListingArt id={l.id} type={l.type} variant="kitchen" className="col-span-1 aspect-[16/9] w-full" />
        <div className="col-span-1 flex items-center justify-center bg-card text-center text-xs text-ink-soft sm:rounded-br-2xl">
          Illustrations, not photos
        </div>
      </div>

      <div className="px-4">
        <p className="mt-5 text-ink-soft">
          {HOUSING_TYPE_LABELS[l.type]} in {l.neighbourhood}
        </p>
        <h1 className="font-display text-3xl leading-tight font-bold">{l.title}</h1>
        <p className="mt-1 text-ink-soft">{l.address}</p>
        {budget !== null && <FitBadge fit={fit} className="mt-3" />}

        <Section title="What you’d really pay each month">
          <CostBreakdown listing={l} cost={cost} budget={budget} />
        </Section>

        <Section title="Posted by">
          <PosterCard listing={l} onMessage={() => requireAccount('message', () => setMessaging(true))} />
        </Section>

        <Section title="Getting to campus">
          <p className="font-bold">{describeCommute(commute)}</p>
          <div className="mt-3 h-64 overflow-hidden rounded-2xl border border-line bg-card">
            <Suspense fallback={<p className="p-4">Loading map…</p>}>
              <MiniMap listing={l} commute={commute} />
            </Suspense>
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            Estimates. Walking uses straight-line distance plus 30% at about 80 metres a minute. Bus times are typical
            scheduled rides from the Guelph Transit timetable, not live arrivals.
          </p>
        </Section>

        <Section title="What’s included">
          {l.included.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {l.included.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true" className="font-bold text-fits">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p>Nothing extra listed.</p>
          )}
        </Section>

        <Section title="The details">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-line bg-card p-4">
            <div><dt className="text-sm text-ink-soft">Lease</dt><dd className="font-bold">{l.leaseMonths} months</dd></div>
            <div><dt className="text-sm text-ink-soft">Available from</dt><dd className="font-bold">{formatMonth(l.availableFrom)}</dd></div>
            <div><dt className="text-sm text-ink-soft">Bedrooms</dt><dd className="font-bold">{bedroomsLabel(l)}</dd></div>
            <div><dt className="text-sm text-ink-soft">Bathrooms</dt><dd className="font-bold">{l.bathrooms}{l.type === 'room' ? ' shared' : ''}</dd></div>
            <div><dt className="text-sm text-ink-soft">Furnished</dt><dd className="font-bold">{l.furnished ? 'Yes' : 'No'}</dd></div>
          </dl>
          <p className="mt-4">{l.description}</p>
        </Section>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-[1050] border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <p className="leading-tight">
            <span className="font-display text-2xl font-bold">{formatMoney(cost.total)}</span>
            <span className="block text-sm text-ink-soft sm:inline"> a month, all-in</span>
          </p>
          <div className="flex shrink-0 gap-2">
            <SaveButton id={l.id} title={l.title} />
            <button
              type="button"
              onClick={() => requireAccount('message', () => setMessaging(true))}
              className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 font-bold text-white"
            >
              Message
            </button>
          </div>
        </div>
      </div>

      <div
        role="status"
        className="fixed inset-x-0 bottom-[calc(7.75rem+env(safe-area-inset-bottom))] z-[1060] flex justify-center px-4 empty:hidden"
      >
        {sentNote && (
          <p className="flex max-w-md items-center gap-3 rounded-2xl bg-fits px-4 py-2 text-white shadow-lg">
            <span>
              Saved to Messages.{' '}
              <Link to={`/messages/${l.id}`} className="font-bold underline">
                Open conversation
              </Link>
            </span>
            <button
              type="button"
              onClick={() => setSentNote(false)}
              className="-mr-2 min-h-11 min-w-11 rounded-full font-bold"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </p>
        )}
      </div>

      {messaging && (
        <MessageSheet
          listing={l}
          onClose={() => setMessaging(false)}
          onSent={() => setSentNote(true)}
        />
      )}
    </article>
  )
}
