import { Link } from 'react-router-dom'
import ListingArt from '../components/ListingArt'
import { formatDay } from '../lib/format'
import { getById } from '../lib/listingsRepo'
import { conversations } from '../lib/messages'
import { useAppState } from '../state/AppState'

export function DemoBanner() {
  return (
    <p className="mt-3 rounded-xl bg-highlight/50 px-3 py-2 text-sm">
      Demo: messages are saved on this device only and aren’t sent to anyone. Poster replies will come with a real
      server.
    </p>
  )
}

export default function Messages() {
  const { messages } = useAppState()
  const list = conversations(messages)

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <h1 className="font-display text-3xl font-bold">Messages</h1>
      <DemoBanner />
      {list.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-line bg-card p-6">
          <h2 className="font-display text-xl font-bold">No messages yet.</h2>
          <p className="mt-2 text-ink-soft">
            Open any place and tap Message to contact whoever posted it. You don’t have to share your phone number or
            email.
          </p>
          <Link to="/results" className="mt-4 inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-bold text-white">
            Find places
          </Link>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3">
          {list.map(({ listingId, last, messages: ms }) => {
            const l = getById(listingId)!
            return (
              <li key={listingId} className="min-w-0">
                <Link
                  to={`/messages/${listingId}`}
                  className="flex gap-3 rounded-2xl border border-line bg-card p-3 hover:border-ink"
                >
                  <ListingArt id={l.id} type={l.type} className="h-16 w-16 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-bold">{l.poster.name}</span>
                      <span className="shrink-0 text-sm text-ink-soft">{formatDay(last.sentAt)}</span>
                    </p>
                    <p className="truncate text-sm text-ink-soft">{l.title}</p>
                    <p className="mt-1 truncate">You: {last.body}</p>
                    <p className="mt-1 text-sm font-bold text-stretch">
                      Waiting for a reply{ms.length > 1 ? ` · ${ms.length} sent` : ''}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
