import { useId, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { POSTER_ROLE_LABELS } from '../data/types'
import { formatSent } from '../lib/format'
import { getById } from '../lib/listingsRepo'
import { EMPTY_DRAFT, greetingName, validateDraft, type SharedDetails } from '../lib/messages'
import { useAppState } from '../state/AppState'
import { DemoBanner } from './Messages'
import NotFound from './NotFound'

const SHARED_LABELS: Record<keyof SharedDetails, string> = {
  name: 'Name',
  phone: 'Phone',
  email: 'Email',
  other: 'Also',
}

export default function Conversation() {
  const { listingId = '' } = useParams()
  const { messages, sendMessage } = useAppState()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | undefined>()
  const fieldId = useId()
  const listing = getById(listingId)
  if (!listing) {
    return <NotFound title="We couldn’t find that conversation" body="The place may have been taken off the list." />
  }
  const p = listing.poster
  const mine = messages.filter((m) => m.listingId === listing.id)

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    const err = validateDraft({ ...EMPTY_DRAFT, body }).body
    setError(err)
    if (err) return
    sendMessage(listing.id, body, {})
    setBody('')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3">
      <Link to="/messages" className="inline-flex min-h-11 items-center font-bold underline">
        All messages
      </Link>
      <h1 className="font-display text-3xl font-bold">{p.name}</h1>
      <p className="text-ink-soft">
        {POSTER_ROLE_LABELS[p.role]} ·{' '}
        <Link to={`/listing/${listing.id}`} className="underline" aria-label={`Open ${listing.title}`}>
          {listing.title}
        </Link>
      </p>
      <DemoBanner />

      {mine.length === 0 ? (
        <p className="mt-6">You haven’t messaged {p.name} yet.</p>
      ) : (
        <>
          <ol className="mt-6 flex flex-col gap-3">
            {mine.map((m) => {
              const shared = Object.entries(m.shared) as [keyof SharedDetails, string][]
              return (
                <li key={m.id} className="flex justify-end">
                  <article className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-3 text-white">
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {shared.length > 0 && (
                      <div className="mt-3 border-t border-white/30 pt-2 text-sm">
                        <p className="font-bold">You shared with {greetingName(p)}:</p>
                        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                          {shared.map(([k, v]) => (
                            <div key={k} className="contents">
                              <dt className="opacity-80">{SHARED_LABELS[k]}</dt>
                              <dd className="break-words">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                    <p className="mt-2 text-right text-xs opacity-80">
                      <time dateTime={m.sentAt}>{formatSent(m.sentAt)}</time>
                    </p>
                  </article>
                </li>
              )
            })}
          </ol>
          <p className="mt-4 text-center text-sm text-ink-soft">
            Waiting for {greetingName(p)} to reply. {p.replyTime}.
          </p>
        </>
      )}

      {mine.length === 0 ? (
        <Link
          to={`/listing/${listing.id}`}
          className="mt-4 inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-bold text-white"
        >
          Go to the listing to message {greetingName(p)}
        </Link>
      ) : (
        <form noValidate onSubmit={send} className="mt-6 flex flex-col gap-2 border-t border-line pt-4">
          <label htmlFor={fieldId} className="font-bold">
            Write a follow-up
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id={fieldId}
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${fieldId}-error` : undefined}
              className="min-h-11 flex-1 rounded-xl border-2 border-line bg-card px-3 py-2 aria-[invalid=true]:border-over"
            />
            <button type="submit" className="min-h-12 rounded-full bg-ink px-5 font-bold text-white">
              Send
            </button>
          </div>
          {error && (
            <span id={`${fieldId}-error`} className="text-sm font-bold text-over">
              {error}
            </span>
          )}
        </form>
      )}
    </div>
  )
}
