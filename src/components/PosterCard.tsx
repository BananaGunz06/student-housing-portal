import { Link } from 'react-router-dom'
import { POSTER_ROLE_LABELS, type Listing } from '../data/types'
import { formatDay } from '../lib/format'
import { greetingName, phoneHref } from '../lib/messages'
import { useAppState } from '../state/AppState'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .filter((c) => /[A-Za-z]/.test(c))
    .slice(0, 2)
    .join('')
    .toUpperCase()

const linkClass = 'inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line bg-paper px-4 font-bold'

/** Who posted the listing, and how to reach them without them having to share anything. */
export default function PosterCard({ listing, onMessage }: { listing: Listing; onMessage: () => void }) {
  const { messages } = useAppState()
  const p = listing.poster
  const first = greetingName(p)
  const mine = messages.filter((m) => m.listingId === listing.id)
  const last = mine[mine.length - 1]

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-highlight font-display text-lg font-bold">
          {initials(p.name)}
        </span>
        <div className="min-w-0">
          <p className="font-bold">{p.name}</p>
          <p className="text-sm text-ink-soft">
            {POSTER_ROLE_LABELS[p.role]} · <span>{p.replyTime}</span>
          </p>
        </div>
      </div>

      {last && (
        <p className="mt-3 rounded-xl bg-paper px-3 py-2">
          You messaged {first} on {formatDay(last.sentAt)}.{' '}
          <Link to={`/messages/${listing.id}`} className="font-bold underline">
            See conversation
          </Link>
        </p>
      )}

      <button
        type="button"
        onClick={onMessage}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 font-bold text-white sm:w-auto"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Message {first}
      </button>
      <p className="mt-2 text-sm text-ink-soft">Your phone number and email stay private unless you choose to share them.</p>

      {p.phone || p.email ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm text-ink-soft">{p.name} also shared:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.phone && (
              <>
                <a href={`tel:${phoneHref(p.phone)}`} className={linkClass} aria-label={`Call ${p.phone}`}>
                  Call <span className="font-normal">{p.phone}</span>
                </a>
                <a href={`sms:${phoneHref(p.phone)}`} className={linkClass} aria-label={`Text ${p.phone}`}>
                  Text
                </a>
              </>
            )}
            {p.email && (
              <a href={`mailto:${p.email}`} className={`${linkClass} max-w-full`} aria-label={`Email ${p.email}`}>
                Email <span className="truncate font-normal">{p.email}</span>
              </a>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 border-t border-line pt-4">
          {p.name} chose not to share a phone number or email. Send a message here instead.
        </p>
      )}
    </div>
  )
}
