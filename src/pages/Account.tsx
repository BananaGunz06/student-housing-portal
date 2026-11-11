import { useState } from 'react'
import AuthForms from '../components/AuthForms'
import { useAccount, type SyncStatus } from '../state/AccountState'

const fieldClass = 'min-h-11 w-full rounded-xl border-2 border-line bg-card px-3 py-2 aria-[invalid=true]:border-over'
const SYNC_COPY: Partial<Record<SyncStatus, string>> = {
  saved: 'Saved to your account',
  saving: 'Saving…',
  error: 'Not synced yet. We’ll try again.',
}

export default function Account() {
  const { status, session, profile, syncStatus, signOut, deleteAccount, saveProfile } = useAccount()

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <h1 className="font-display text-3xl font-bold">Account</h1>

      {status === 'signed-out' && (
        <section className="mt-4 flex flex-col gap-4">
          <p className="text-ink-soft">Sign in to keep your saved places and messages on any device.</p>
          <div className="rounded-2xl border border-line bg-card p-4">
            <AuthForms onDone={() => {}} />
          </div>
        </section>
      )}

      {status === 'signed-in' && session && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-ink-soft">
            Signed in as <span className="font-bold text-ink">{session.email}</span>
          </p>
          <p role="status" className="min-h-6 text-sm font-bold">
            {SYNC_COPY[syncStatus]}
          </p>

          <ProfileForm
            key={`${session.userId}-${profile ? 'loaded' : 'pending'}`}
            initialName={profile?.displayName ?? ''}
            initialPhone={profile?.phone ?? ''}
            onSave={saveProfile}
          />

          <div className="flex flex-wrap gap-3">
            <button type="button" className="min-h-12 rounded-full border-2 border-ink bg-card px-6 font-bold" onClick={() => void signOut()}>
              Log out
            </button>
          </div>

          <DeleteAccount onDelete={deleteAccount} />
        </div>
      )}
    </div>
  )
}

function ProfileForm({
  initialName,
  initialPhone,
  onSave,
}: {
  initialName: string
  initialPhone: string
  onSave: (p: { displayName: string; phone: string | null }) => Promise<void>
}) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [nameError, setNameError] = useState<string | null>(null)
  const [result, setResult] = useState<'saved' | 'failed' | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    setResult(null)
    if (!n) return setNameError('Enter your name.')
    if (n.length > 80) return setNameError('Keep your name to 80 characters or fewer.')
    setNameError(null)
    setBusy(true)
    try {
      await onSave({ displayName: n, phone: phone.trim() || null })
      setResult('saved')
    } catch {
      setResult('failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-xl font-bold">Your details</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="account-name" className="font-bold">
          Name
        </label>
        <input
          id="account-name"
          className={fieldClass}
          autoComplete="name"
          value={name}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? 'account-name-error' : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        {nameError && (
          <span id="account-name-error" className="text-sm font-bold text-over">
            {nameError}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="account-phone" className="font-bold">
          Phone (optional)
        </label>
        <input
          id="account-phone"
          type="tel"
          className={fieldClass}
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      {result === 'saved' && <p role="status" className="text-sm font-bold">Saved</p>}
      {result === 'failed' && (
        <p role="alert" className="text-sm font-bold text-over">
          Couldn’t save. Check your connection and try again.
        </p>
      )}
      <button type="submit" disabled={busy} className="min-h-12 self-start rounded-full bg-ink px-6 font-bold text-on-ink disabled:opacity-60">
        Save
      </button>
    </form>
  )
}

function DeleteAccount({ onDelete }: { onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const confirm = async () => {
    setBusy(true)
    setFailed(false)
    try {
      // On success the account is gone and this page switches to the signed-out view.
      await onDelete()
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="min-h-12 self-start rounded-full px-4 font-bold text-over underline"
          onClick={() => setConfirming(true)}
        >
          Delete account
        </button>
        {failed && (
          <p role="alert" className="text-sm font-bold text-over">
            Couldn’t delete your account. Check your connection and try again.
          </p>
        )}
      </div>
    )
  }

  return (
    <section aria-describedby="delete-question" className="flex flex-col gap-3 rounded-2xl border-2 border-over bg-card p-4">
      <p id="delete-question" className="font-bold">
        Delete your account? This removes your saved places, messages and sign-in. It can’t be undone.
      </p>
      {failed && (
        <p role="alert" className="text-sm font-bold text-over">
          Couldn’t delete your account. Check your connection and try again.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} className="min-h-12 rounded-full bg-over px-6 font-bold text-white disabled:opacity-60" onClick={confirm}>
          Delete my account
        </button>
        <button type="button" disabled={busy} className="min-h-12 rounded-full border-2 border-ink bg-card px-6 font-bold" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    </section>
  )
}
