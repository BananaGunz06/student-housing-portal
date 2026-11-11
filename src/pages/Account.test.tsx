import { act, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { AuthResult, Backend } from '../lib/backend/types'
import { getAll } from '../lib/listingsRepo'
import { greetingName } from '../lib/messages'
import { createFakeBackend } from '../test/fakeBackend'
import { renderApp, setBudget } from '../test/renderApp'
import { AppStateProvider, useAppState } from '../state/AppState'

vi.mock('../components/MiniMap', () => ({ default: () => <div>mini map</div> }))

const listing = getAll()[0]
const SAVE_REASON = 'Sign in to save places and see them on any device.'
const MESSAGE_REASON = 'Sign in to message posters and keep your conversations on any device.'
const taken = { email: 'taken@example.com', password: 'password123', name: 'Taken' }

const saveButton = () => screen.getByRole('button', { name: `Save ${listing.title}` })
const messageButton = () => screen.getByRole('button', { name: `Message ${greetingName(listing.poster)}` })

async function createAccount(user: ReturnType<typeof renderApp>['user'], email = 'new@example.com') {
  const dialog = screen.getByRole('dialog', { name: 'Sign in' })
  await user.click(within(dialog).getByRole('tab', { name: 'Create account' }))
  await user.type(within(dialog).getByLabelText('Your name'), 'New Student')
  await user.type(within(dialog).getByLabelText('Email'), email)
  await user.type(within(dialog).getByLabelText('Password'), 'password123')
  await user.click(within(dialog).getByRole('button', { name: 'Create account' }))
}

describe('Save gating', () => {
  test('signed out: Save asks to sign in, then saves after creating an account', async () => {
    setBudget(1000)
    const { user } = renderApp(`/listing/${listing.id}`)
    await user.click(saveButton())
    const dialog = screen.getByRole('dialog', { name: 'Sign in' })
    expect(within(dialog).getByText(SAVE_REASON)).toBeInTheDocument()
    expect(saveButton()).toHaveAttribute('aria-pressed', 'false')

    await createAccount(user)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(saveButton()).toHaveAttribute('aria-pressed', 'true')
  })

  test('signed in: Save and un-save need no dialog', async () => {
    setBudget(1000)
    const { user } = renderApp(`/listing/${listing.id}`, { signedInAs: 'student@example.com' })
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(saveButton())
    await waitFor(() => expect(saveButton()).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(saveButton())
    expect(saveButton()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('Escape closes the sheet, returns focus, and drops the pending save', async () => {
    setBudget(1000)
    const { user, backend } = renderApp(`/listing/${listing.id}`, {
      backend: createFakeBackend({ users: [taken] }),
    })
    await user.click(saveButton())
    expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(saveButton()).toHaveFocus()

    // Signing in later by another route must not replay the dropped save.
    await backend.signIn(taken.email, taken.password)
    await waitFor(() => expect(saveButton()).toHaveAttribute('aria-pressed', 'false'))
  })
})

describe('Message gating', () => {
  test('signed out: Message asks to sign in, then opens the message form', async () => {
    setBudget(1000)
    const { user } = renderApp(`/listing/${listing.id}`, { backend: createFakeBackend({ users: [taken] }) })
    await user.click(messageButton())
    const dialog = screen.getByRole('dialog', { name: 'Sign in' })
    expect(within(dialog).getByText(MESSAGE_REASON)).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Email'), taken.email)
    await user.type(within(dialog).getByLabelText('Password'), taken.password)
    await user.click(within(dialog).getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('dialog', { name: `Message ${greetingName(listing.poster)}` })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Sign in' })).toBeNull()
  })

  test('the bottom-bar Message button is gated too', async () => {
    setBudget(1000)
    const { user } = renderApp(`/listing/${listing.id}`)
    await user.click(screen.getByRole('button', { name: 'Message' }))
    expect(screen.getByText(MESSAGE_REASON)).toBeInTheDocument()
  })
})

describe('Sign-in errors and states', () => {
  test('wrong password shows the mismatch error and keeps the sheet open', async () => {
    setBudget(1000)
    const { user } = renderApp(`/listing/${listing.id}`, { backend: createFakeBackend({ users: [taken] }) })
    await user.click(saveButton())
    const dialog = screen.getByRole('dialog', { name: 'Sign in' })
    await user.type(within(dialog).getByLabelText('Email'), taken.email)
    await user.type(within(dialog).getByLabelText('Password'), 'wrong-password')
    await user.click(within(dialog).getByRole('button', { name: 'Sign in' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('That email and password don’t match.')
  })

  test('empty sign-in asks for email and password', async () => {
    setBudget(1000)
    const { user } = renderApp(`/listing/${listing.id}`)
    await user.click(saveButton())
    const dialog = screen.getByRole('dialog', { name: 'Sign in' })
    await user.click(within(dialog).getByRole('button', { name: 'Sign in' }))
    expect(within(dialog).getByText('Enter your email.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter your password.')).toBeInTheDocument()
  })

  test('creating an account with a taken email says so', async () => {
    setBudget(1000)
    const { user } = renderApp(`/listing/${listing.id}`, { backend: createFakeBackend({ users: [taken] }) })
    await user.click(saveButton())
    await createAccount(user, taken.email)
    expect(await screen.findByRole('alert')).toHaveTextContent('There’s already an account with that email. Sign in instead.')
  })

  test('create-account fields are validated before any request', async () => {
    setBudget(1000)
    const { user } = renderApp(`/listing/${listing.id}`)
    await user.click(saveButton())
    const dialog = screen.getByRole('dialog', { name: 'Sign in' })
    await user.click(within(dialog).getByRole('tab', { name: 'Create account' }))
    await user.click(within(dialog).getByRole('button', { name: 'Create account' }))
    expect(within(dialog).getByText('Enter your name.')).toBeInTheDocument()
    expect(within(dialog).getByText('Use at least 8 characters.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
  })

  test('offline shows the network error', async () => {
    setBudget(1000)
    const { user } = renderApp(`/listing/${listing.id}`, { backend: createFakeBackend({ users: [taken], offline: true }) })
    await user.click(saveButton())
    const dialog = screen.getByRole('dialog', { name: 'Sign in' })
    await user.type(within(dialog).getByLabelText('Email'), taken.email)
    await user.type(within(dialog).getByLabelText('Password'), taken.password)
    await user.click(within(dialog).getByRole('button', { name: 'Sign in' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Can’t reach the server. Check your connection and try again.',
    )
  })

  test('a pending submit disables the button and sends one request', async () => {
    setBudget(1000)
    let resolve!: (r: AuthResult) => void
    const base = createFakeBackend({ users: [taken] })
    const signIn = vi.fn(() => new Promise<AuthResult>((r) => (resolve = r)))
    const backend: Backend = { ...base, signIn }
    const { user } = renderApp(`/listing/${listing.id}`, { backend })
    await user.click(saveButton())
    const dialog = screen.getByRole('dialog', { name: 'Sign in' })
    await user.type(within(dialog).getByLabelText('Email'), taken.email)
    await user.type(within(dialog).getByLabelText('Password'), taken.password)
    await user.click(within(dialog).getByRole('button', { name: 'Sign in' }))
    const busy = within(dialog).getByRole('button', { name: 'Signing in…' })
    expect(busy).toBeDisabled()
    await user.click(busy)
    expect(signIn).toHaveBeenCalledTimes(1)
    resolve({ ok: false, error: 'unknown' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
    expect(within(dialog).getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  test('when email confirmation is needed, say so and do not run the pending save', async () => {
    setBudget(1000)
    const base = createFakeBackend()
    const backend: Backend = { ...base, signUp: async () => ({ ok: true, needsConfirmation: true }) }
    const { user } = renderApp(`/listing/${listing.id}`, { backend })
    await user.click(saveButton())
    await createAccount(user)
    expect(await screen.findByText('Check your email to confirm your account, then sign in.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeInTheDocument()
    expect(saveButton()).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('Dismissing while a request is in flight', () => {
  function deferredBackend() {
    let resolve!: (r: AuthResult) => void
    const base = createFakeBackend({ users: [taken] })
    const signIn = vi.fn(() => new Promise<AuthResult>((r) => (resolve = r)))
    return { backend: { ...base, signIn } as Backend, resolve: (r: AuthResult) => resolve(r) }
  }
  async function submitThenEscape(user: ReturnType<typeof renderApp>['user']) {
    const dialog = screen.getByRole('dialog', { name: 'Sign in' })
    await user.type(within(dialog).getByLabelText('Email'), taken.email)
    await user.type(within(dialog).getByLabelText('Password'), taken.password)
    await user.click(within(dialog).getByRole('button', { name: 'Sign in' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  }

  test('a dismissed Save is not replayed when the request later succeeds', async () => {
    setBudget(1000)
    const { backend, resolve } = deferredBackend()
    const { user } = renderApp(`/listing/${listing.id}`, { backend })
    await user.click(saveButton())
    await submitThenEscape(user)
    await act(async () => resolve({ ok: true, needsConfirmation: false }))
    expect(saveButton()).toHaveAttribute('aria-pressed', 'false')
  })

  test('a dismissed Message does not open the message form later', async () => {
    setBudget(1000)
    const { backend, resolve } = deferredBackend()
    const { user } = renderApp(`/listing/${listing.id}`, { backend })
    await user.click(messageButton())
    await submitThenEscape(user)
    await act(async () => resolve({ ok: true, needsConfirmation: false }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Save replay', () => {
  test('replaying a save on an already-saved place keeps it saved', async () => {
    setBudget(1000)
    localStorage.setItem('shp.saved', JSON.stringify([listing.id]))
    const { user } = renderApp(`/listing/${listing.id}`)
    expect(saveButton()).toHaveAttribute('aria-pressed', 'true')
    function Probe() {
      const { setSaved } = useAppState()
      return <button onClick={() => setSaved(listing.id, true)}>replay</button>
    }
    render(<AppStateProvider><Probe /></AppStateProvider>)
    await user.click(screen.getByRole('button', { name: 'replay' }))
    expect(JSON.parse(localStorage.getItem('shp.saved')!)).toEqual([listing.id])
  })
})
