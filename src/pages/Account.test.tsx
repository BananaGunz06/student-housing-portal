import { act, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, test, vi } from 'vitest'
import type { AuthResult, Backend, Profile } from '../lib/backend/types'
import { getAll } from '../lib/listingsRepo'
import { greetingName } from '../lib/messages'
import { createFakeBackend } from '../test/fakeBackend'
import { renderApp, setBudget, sessionReady } from '../test/renderApp'
import { AppStateProvider, useAppState } from '../state/AppState'
import { AccountProvider, useAccount, type SyncStatus } from '../state/AccountState'
import { AppRoutes } from '../App'
import { MemoryRouter } from 'react-router-dom'

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

const SIGNED_OUT_LINE = 'Sign in to keep your saved places and messages on any device.'
const DELETE_QUESTION = 'Delete your account? This removes your saved places, messages and sign-in. It can’t be undone.'
const student = { email: 'student@example.com', password: 'password123', name: 'Test Student' }

describe('Account page', () => {
  test('signed out: shows the sign-in forms', async () => {
    renderApp('/account')
    expect(screen.getByRole('heading', { level: 1, name: 'Account' })).toBeInTheDocument()
    await sessionReady()
    expect(screen.getByText(SIGNED_OUT_LINE)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Create account' })).toBeInTheDocument()
  })

  test('signed in: shows the email, and saving the profile shows Saved and updates the backend', async () => {
    const { user, backend } = renderApp('/account', { signedInAs: student.email })
    await sessionReady()
    expect(screen.getByText(student.email)).toBeInTheDocument()
    const name = screen.getByLabelText('Name')
    await waitFor(() => expect(name).toHaveValue(student.name))
    await user.clear(screen.getByLabelText('Phone (optional)'))
    await user.type(screen.getByLabelText('Phone (optional)'), '555-0100')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved', { selector: 'p' })).toBeInTheDocument()
    expect(await backend.loadProfile()).toEqual({ displayName: student.name, phone: '555-0100' })
  })

  test('a failed save says so and keeps the typed details', async () => {
    const base = createFakeBackend({ users: [student], sessionEmail: student.email })
    const backend: Backend = { ...base, saveProfile: async () => Promise.reject(new Error('network')) }
    const { user } = renderApp('/account', { backend })
    await sessionReady()
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(student.name))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Couldn’t save. Check your connection and try again.')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue(student.name)
  })

  test('typing before the profile loads is kept when it arrives', async () => {
    const base = createFakeBackend({ users: [student], sessionEmail: student.email })
    let resolve!: (p: Profile) => void
    const backend: Backend = { ...base, loadProfile: () => new Promise<Profile>((r) => (resolve = r)) }
    const { user } = renderApp('/account', { backend })
    await sessionReady()
    await user.type(screen.getByLabelText('Name'), 'Typed')
    await act(async () => resolve({ displayName: student.name, phone: '555-0100' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Typed')
    expect(screen.getByLabelText('Phone (optional)')).toHaveValue('555-0100')
  })

  test('when the profile could not load, Save shows Saved and it stays visible', async () => {
    const base = createFakeBackend({ users: [student], sessionEmail: student.email })
    const backend: Backend = { ...base, loadProfile: async () => Promise.reject(new Error('network')) }
    const { user } = renderApp('/account', { backend })
    await sessionReady()
    await user.type(screen.getByLabelText('Name'), 'Fresh')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved', { selector: 'p' })).toBeInTheDocument()
    await sessionReady()
    expect(screen.getByText('Saved', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Fresh')
  })

  test('editing after a save clears the Saved message', async () => {
    const { user } = renderApp('/account', { signedInAs: student.email })
    await sessionReady()
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(student.name))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved', { selector: 'p' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Phone (optional)'), '5')
    expect(screen.queryByText('Saved', { selector: 'p' })).toBeNull()
  })

  test('a blank name is refused before any save', async () => {
    const base = createFakeBackend({ users: [student], sessionEmail: student.email })
    const saveProfile = vi.fn(base.saveProfile)
    const { user } = renderApp('/account', { backend: { ...base, saveProfile } })
    await sessionReady()
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(student.name))
    await user.clear(screen.getByLabelText('Name'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Enter your name.')).toBeInTheDocument()
    expect(saveProfile).not.toHaveBeenCalled()
  })

  test.each<[SyncStatus, string]>([
    ['saved', 'Saved to your account'],
    ['saving', 'Saving…'],
    ['error', 'Not synced yet. We’ll try again.'],
  ])('sync status %s shows its line', async (status, text) => {
    renderAccountWithSync(status)
    expect(await screen.findByText(text)).toBeInTheDocument()
  })

  test('Log out returns to the signed-out view', async () => {
    const { user } = renderApp('/account', { signedInAs: student.email })
    await sessionReady()
    await user.click(screen.getByRole('button', { name: 'Log out' }))
    expect(await screen.findByText(SIGNED_OUT_LINE)).toBeInTheDocument()
  })

  test('Delete account asks first, then removes the user and signs out', async () => {
    const { user, backend } = renderApp('/account', { signedInAs: student.email })
    await sessionReady()
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    expect(screen.getByText(DELETE_QUESTION)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete my account' }))
    expect(await screen.findByText(SIGNED_OUT_LINE)).toBeInTheDocument()
    expect(await backend.signIn(student.email, student.password)).toEqual({ ok: false, error: 'invalid-credentials' })
  })

  test('opening the delete confirmation moves focus to Cancel, and the group is named by the question', async () => {
    const { user } = renderApp('/account', { signedInAs: student.email })
    await sessionReady()
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    expect(screen.getByRole('group', { name: DELETE_QUESTION })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  test('Cancel returns focus to Delete account', async () => {
    const { user } = renderApp('/account', { signedInAs: student.email })
    await sessionReady()
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Delete account' })).toHaveFocus()
  })

  test('Cancel hides the delete confirmation and keeps the account', async () => {
    const { user, backend } = renderApp('/account', { signedInAs: student.email })
    await sessionReady()
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(DELETE_QUESTION)).toBeNull()
    expect(screen.getByText(student.email)).toBeInTheDocument()
    expect(await backend.loadProfile()).toEqual({ displayName: student.name, phone: null })
  })

  test('a failed delete shows the error and keeps the account', async () => {
    const base = createFakeBackend({ users: [student], sessionEmail: student.email })
    const backend: Backend = { ...base, deleteAccount: async () => Promise.reject(new Error('network')) }
    const { user } = renderApp('/account', { backend })
    await sessionReady()
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    await user.click(screen.getByRole('button', { name: 'Delete my account' }))
    expect(await screen.findByText('Couldn’t delete your account. Check your connection and try again.')).toBeInTheDocument()
    expect(screen.getByText(student.email)).toBeInTheDocument()
  })

  test('the bottom nav has an Account item that is active on /account', async () => {
    renderApp('/account')
    const link = screen.getByRole('link', { name: 'Account' })
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(link).toHaveAttribute('href', '/account')
  })

  test('the message form prefills name and phone from the profile when nothing was shared before', async () => {
    setBudget(1000)
    const base = createFakeBackend({ users: [student], sessionEmail: student.email })
    await base.saveProfile({ displayName: student.name, phone: '555-0100' })
    const { user } = renderApp(`/listing/${listing.id}`, { backend: base })
    await sessionReady()
    await waitFor(() => expect(messageButton()).toBeEnabled())
    await user.click(messageButton())
    const dialog = screen.getByRole('dialog', { name: `Message ${greetingName(listing.poster)}` })
    await waitFor(() => expect(within(dialog).getByLabelText('Your name')).toHaveValue(student.name))
    expect(within(dialog).getByLabelText('Phone')).toHaveValue('555-0100')
  })
})

/** Renders the Account page with a sync status set by a probe, without the real sync running. */
function renderAccountWithSync(status: SyncStatus) {
  const backend = createFakeBackend({ users: [student], sessionEmail: student.email })
  function Probe() {
    const { setSyncStatus } = useAccount()
    useEffect(() => setSyncStatus(status), [setSyncStatus])
    return null
  }
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <AccountProvider backend={backend}>
        <Probe />
        <AppStateProvider>
          <AppRoutes />
        </AppStateProvider>
      </AccountProvider>
    </MemoryRouter>,
  )
}
