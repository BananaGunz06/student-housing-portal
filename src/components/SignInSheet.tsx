import { useId, useRef } from 'react'
import { useModal } from '../lib/useModal'
import type { AccountReason } from '../state/AccountState'
import AuthForms from './AuthForms'

const REASONS: Record<AccountReason, string> = {
  save: 'Sign in to save places and see them on any device.',
  message: 'Sign in to message posters and keep your conversations on any device.',
}

/** Bottom sheet that asks the student to sign in before Save or Message. */
export default function SignInSheet({
  reason,
  onDone,
  onClose,
}: {
  reason: AccountReason
  onDone: () => void
  onClose: () => void
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const dialogRef = useModal(onClose, titleRef)
  const titleId = useId()
  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-paper"
      >
        <div className="border-b border-line px-5 py-3">
          <h2 id={titleId} ref={titleRef} tabIndex={-1} className="font-display text-2xl font-bold outline-none">
            Sign in
          </h2>
          <p className="text-sm text-ink-soft">{REASONS[reason]}</p>
        </div>
        <div className="overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <AuthForms onDone={onDone} />
          <button type="button" className="mt-3 min-h-11 rounded-full px-4 font-bold underline" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
