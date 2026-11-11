import { useId, useRef, useState, type ReactNode } from 'react'
import { validateSignUp } from '../lib/sync'
import type { AuthError } from '../lib/backend/types'
import { useAccount } from '../state/AccountState'

type Mode = 'sign-in' | 'create'

const fieldClass = 'min-h-11 w-full rounded-xl border-2 border-line bg-card px-3 py-2 aria-[invalid=true]:border-over'

const ERROR_COPY: Record<AuthError, string> = {
  'invalid-credentials': 'That email and password don’t match.',
  'email-taken': 'There’s already an account with that email. Sign in instead.',
  'weak-password': 'Use at least 8 characters.',
  network: 'Can’t reach the server. Check your connection and try again.',
  unknown: 'Something went wrong. Please try again.',
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      {children({ id, 'aria-describedby': error ? `${id}-error` : undefined, ...(error && { 'aria-invalid': true as const }) })}
      {error && (
        <span id={`${id}-error`} className="text-sm font-bold text-over">
          {error}
        </span>
      )}
    </div>
  )
}

const TABS: { mode: Mode; label: string }[] = [
  { mode: 'sign-in', label: 'Sign in' },
  { mode: 'create', label: 'Create account' },
]

/** Sign in / Create account forms, shared by the sign-in sheet and the Account page. */
export default function AuthForms({ initialMode = 'sign-in', onDone }: { initialMode?: Mode; onDone: () => void }) {
  const { signIn, signUp } = useAccount()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'password', string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const tabId = useId()

  const switchMode = (m: Mode) => {
    setMode(m)
    setErrors({})
    setFormError(null)
    setNotice(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inFlight.current) return
    setFormError(null)
    setNotice(null)
    const errs =
      mode === 'create'
        ? validateSignUp(name, email, password)
        : {
            ...(!email.trim() && { email: 'Enter your email.' }),
            ...(!password && { password: 'Enter your password.' }),
          }
    setErrors(errs)
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    inFlight.current = true
    setPending(true)
    try {
      const res = mode === 'create' ? await signUp(name.trim(), email.trim(), password) : await signIn(email.trim(), password)
      if (!res.ok) {
        setFormError(ERROR_COPY[res.error])
      } else if (res.needsConfirmation) {
        setNotice('Check your email to confirm your account, then sign in.')
      } else {
        onDone()
      }
    } catch {
      setFormError(ERROR_COPY.unknown)
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const next = mode === 'sign-in' ? 'create' : 'sign-in'
    switchMode(next)
    requestAnimationFrame(() => document.getElementById(`${tabId}-${next}`)?.focus())
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Account" className="flex gap-2" onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button
            key={t.mode}
            type="button"
            role="tab"
            id={`${tabId}-${t.mode}`}
            aria-selected={mode === t.mode}
            aria-controls={`${tabId}-panel`}
            tabIndex={mode === t.mode ? 0 : -1}
            onClick={() => switchMode(t.mode)}
            className={`min-h-11 flex-1 rounded-full border-2 border-ink px-4 font-bold ${
              mode === t.mode ? 'bg-ink text-on-ink' : 'bg-card text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${mode}`}>
        <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-4">
          {mode === 'create' && (
            <Field label="Your name" error={errors.name}>
              {(props) => (
                <input className={fieldClass} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} {...props} />
              )}
            </Field>
          )}
          <Field label="Email" error={errors.email}>
            {(props) => (
              <input type="email" className={fieldClass} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} {...props} />
            )}
          </Field>
          <Field label="Password" error={errors.password}>
            {(props) => (
              <input
                type="password"
                className={fieldClass}
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                {...props}
              />
            )}
          </Field>

          {formError && (
            <p role="alert" className="text-sm font-bold text-over">
              {formError}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-xl bg-highlight/50 px-3 py-2 text-sm">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="min-h-12 rounded-full bg-ink px-6 font-bold text-on-ink disabled:opacity-60"
          >
            {pending ? (mode === 'create' ? 'Creating account…' : 'Signing in…') : mode === 'create' ? 'Create account' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
