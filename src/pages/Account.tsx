import { useEffect, useRef, useState } from 'react'
import AuthForms from '../components/AuthForms'
import type { Profile, ProfileUpdate } from '../lib/backend/types'
import { useAccount, type SyncStatus } from '../state/AccountState'

const fieldClass = 'min-h-11 w-full rounded-xl border-2 border-line bg-card px-3 py-2 aria-[invalid=true]:border-over'
const SYNC_COPY: Partial<Record<SyncStatus, string>> = {
  saved: 'Saved to your account',
  saving: 'Saving…',
  error: 'Not synced yet. We’ll try again.',
}
const DELETE_QUESTION = 'Delete your account? This removes your saved places, messages and sign-in. It can’t be undone.'

export default function Account() {
  const { status, session, profile, syncStatus, signOut, deleteAccount, saveProfile, flushSync } = useAccount()

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

          <ProfileForm key={session.userId} profile={profile} onSave={saveProfile} />

          <LogOut onSignOut={signOut} onFlush={flushSync} />

          <DeleteAccount onDelete={deleteAccount} />
        </div>
      )}
    </div>
  )
}

/**
 * Log out. Anything not yet saved to the account is saved first; if that can't be done
 * (offline), the student chooses between staying signed in and losing those changes.
 */
function LogOut({ onSignOut, onFlush }: { onSignOut: () => Promise<void>; onFlush: () => Promise<'saved' | 'failed'> }) {
  const [busy, setBusy] = useState(false)
  const [unsynced, setUnsynced] = useState(false)
  const [failed, setFailed] = useState(false)

  const signOut = async () => {
    setBusy(true)
    setFailed(false)
    try {
      // On success this page switches to the signed-out view.
      await onSignOut()
    } catch {
      setFailed(true)
      setUnsynced(false)
    } finally {
      setBusy(false)
    }
  }

  const start = async () => {
    setBusy(true)
    setFailed(false)
    let result: 'saved' | 'failed'
    try {
      result = await onFlush()
    } catch {
      result = 'failed'
    }
    if (result === 'failed') {
      setUnsynced(true)
      setBusy(false)
      return
    }
    await signOut()
  }

  return (
    <div className="flex flex-col gap-3">
      {unsynced ? (
        <div role="group" aria-labelledby="logout-warning" className="flex flex-col gap-3 rounded-2xl border-2 border-over bg-card p-4">
          <p id="logout-warning" role="alert" className="font-bold">
            Some changes haven’t synced yet. If you log out now, they’ll be lost on this device.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} className="min-h-12 rounded-full bg-over px-6 font-bold text-white disabled:opacity-60" onClick={() => void signOut()}>
              {busy ? 'Logging out…' : 'Log out anyway'}
            </button>
            <button
              type="button"
              disabled={busy}
              className="min-h-12 rounded-full border-2 border-ink bg-card px-6 font-bold disabled:opacity-60"
              onClick={() => setUnsynced(false)}
            >
              Stay signed in
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            className="min-h-12 rounded-full border-2 border-ink bg-card px-6 font-bold disabled:opacity-60"
            onClick={() => void start()}
          >
            {busy ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      )}
      {failed && (
        <p role="alert" className="text-sm font-bold text-over">
          Couldn’t log out. Please try again.
        </p>
      )}
    </div>
  )
}

/**
 * Name and phone. The fields start from the profile when it arrives, unless the student has
 * already typed in them. The form stays mounted across saves so the "Saved" message holds.
 */
function ProfileForm({ profile, onSave }: { profile: Profile | null; onSave: (p: ProfileUpdate) => Promise<void> }) {
  const [name, setName] = useState(profile?.displayName ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [nameError, setNameError] = useState<string | null>(null)
  const [result, setResult] = useState<'saved' | 'failed' | null>(null)
  const [busy, setBusy] = useState(false)
  // Each field the student has typed in keeps their text; untouched fields follow the profile.
  const edited = useRef({ name: false, phone: false })

  useEffect(() => {
    if (!profile) return
    if (!edited.current.name) setName(profile.displayName)
    if (!edited.current.phone) setPhone(profile.phone ?? '')
  }, [profile])

  const change = (field: keyof typeof edited.current, value: string) => {
    edited.current[field] = true
    setResult(null)
    if (field === 'name') setName(value)
    else setPhone(value)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    setResult(null)
    if (!n) return setNameError('Enter your name.')
    if (n.length > 80) return setNameError('Keep your name to 80 characters or fewer.')
    setNameError(null)
    setBusy(true)
    try {
      // Without the loaded profile, a phone the student never touched is left as stored on the server.
      const phoneKnown = profile !== null || edited.current.phone
      await onSave(phoneKnown ? { displayName: n, phone: phone.trim() || null } : { displayName: n })
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
          onChange={(e) => change('name', e.target.value)}
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
          onChange={(e) => change('phone', e.target.value)}
        />
      </div>
      {result === 'saved' && (
        <p role="status" className="text-sm font-bold">
          Saved
        </p>
      )}
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

/** Delete account, with an inline confirmation. Focus moves into the confirmation on open and back to the button on Cancel. */
function DeleteAccount({ onDelete }: { onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const openRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)

  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
    else if (wasConfirming.current) openRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

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

  return (
    <div className="flex flex-col gap-2">
      <button
        ref={openRef}
        type="button"
        hidden={confirming}
        className="min-h-12 self-start rounded-full px-0 font-bold text-over underline"
        onClick={() => setConfirming(true)}
      >
        Delete account
      </button>
      {confirming && (
        <div role="group" aria-labelledby="delete-question" className="flex flex-col gap-3 rounded-2xl border-2 border-over bg-card p-4">
          <p id="delete-question" className="font-bold">
            {DELETE_QUESTION}
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
            <button
              ref={cancelRef}
              type="button"
              disabled={busy}
              className="min-h-12 rounded-full border-2 border-ink bg-card px-6 font-bold"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
