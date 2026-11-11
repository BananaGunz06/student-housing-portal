import { useId, useRef, useState, type ReactNode } from 'react'
import type { Listing } from '../data/types'
import {
  EMPTY_DRAFT,
  greetingName,
  sharedFrom,
  starterMessage,
  validateDraft,
  type Draft,
  type DraftErrors,
} from '../lib/messages'
import { useModal } from '../lib/useModal'
import { useAppState } from '../state/AppState'

const fieldClass = 'min-h-11 w-full rounded-xl border-2 border-line bg-card px-3 py-2 aria-[invalid=true]:border-over'

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode
}) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      {hint && (
        <span id={`${id}-hint`} className="text-sm text-ink-soft">
          {hint}
        </span>
      )}
      {children({ id, 'aria-describedby': describedBy, ...(error && { 'aria-invalid': true as const }) })}
      {error && (
        <span id={`${id}-error`} className="text-sm font-bold text-over">
          {error}
        </span>
      )}
    </div>
  )
}

/** Bottom sheet for messaging a poster. Every detail about the student is optional. */
export default function MessageSheet({
  listing,
  onClose,
  onSent,
}: {
  listing: Listing
  onClose: () => void
  onSent: () => void
}) {
  const { sendMessage, lastShared } = useAppState()
  const first = greetingName(listing.poster)
  const [d, setD] = useState<Draft>(() => ({
    ...EMPTY_DRAFT,
    name: lastShared.name ?? '',
    phone: lastShared.phone ?? '',
    email: lastShared.email ?? '',
    other: lastShared.other ?? '',
    body: starterMessage(listing),
  }))
  const [errors, setErrors] = useState<DraftErrors>({})
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const dialogRef = useModal(onClose, bodyRef)
  const titleId = useId()
  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateDraft(d)
    setErrors(errs)
    if (Object.keys(errs).length) return
    sendMessage(listing.id, d.body, sharedFrom(d))
    onSent()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-paper"
      >
        <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-line px-5 py-3">
            <h2 id={titleId} className="font-display text-2xl font-bold">
              Message {first}
            </h2>
            <p className="text-sm text-ink-soft">About: {listing.title}</p>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
            <Field label="Your message" error={errors.body}>
              {(props) => (
                <textarea
                  ref={bodyRef}
                  rows={4}
                  className={fieldClass}
                  value={d.body}
                  onChange={(e) => set({ body: e.target.value })}
                  onFocus={(e) => {
                    // Put the cursor after the starter text, ready to keep typing.
                    const end = e.currentTarget.value.length
                    e.currentTarget.setSelectionRange(end, end)
                  }}
                  {...props}
                />
              )}
            </Field>

            <fieldset className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
              <legend className="px-1 font-display text-lg font-bold">Share your details (optional)</legend>
              <p className="text-sm text-ink-soft">
                Only what you fill in is shared with {first}. Leave anything blank to keep it private.
              </p>
              <Field label="Your name">
                {(props) => (
                  <input className={fieldClass} autoComplete="name" value={d.name} onChange={(e) => set({ name: e.target.value })} {...props} />
                )}
              </Field>
              <Field label="Phone" error={errors.phone}>
                {(props) => (
                  <input type="tel" className={fieldClass} autoComplete="tel" value={d.phone} onChange={(e) => set({ phone: e.target.value })} {...props} />
                )}
              </Field>
              <Field label="Email" error={errors.email}>
                {(props) => (
                  <input type="email" className={fieldClass} autoComplete="email" value={d.email} onChange={(e) => set({ email: e.target.value })} {...props} />
                )}
              </Field>
              <Field label="Anything else you want to share" hint="For example: your program and year, move-in date, pets, how you’d like to be contacted.">
                {(props) => (
                  <textarea rows={2} className={fieldClass} value={d.other} onChange={(e) => set({ other: e.target.value })} {...props} />
                )}
              </Field>
            </fieldset>

            <p className="rounded-xl bg-highlight/50 px-3 py-2 text-sm">
              Demo: your message is saved on this device only. It isn’t sent to {first}.
            </p>
          </div>

          <div className="flex gap-3 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button type="button" className="min-h-12 rounded-full px-4 font-bold underline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="min-h-12 flex-1 rounded-full bg-ink px-6 font-bold text-white">
              Send message
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
