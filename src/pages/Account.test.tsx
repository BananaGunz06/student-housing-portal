import { act, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, test, vi } from 'vitest'
import type { AuthResult, Backend, Profile } from '../lib/backend/types'
import { getAll } from '../lib/listingsRepo'
import { greetingName } from '../lib/messages'
import { createFakeBackend } from '../test/fakeBackend'
import { renderApp, setBudget, sessionReady } from '../test/renderApp'
import { AppStateProvider, useAppState, type AppState as AppStateValue } from '../state/AppState'
import { CloudSync } from '../state/CloudSync'
import userEvent from '@testing-library/user-event'
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

const blankProfile: Profile = {
  displayName: '',
  phone: null,
  bio: '',
  program: '',
  year: null,
  moveInTerm: null,
  budget: null,
  lookingForRoommates: false,
  avatarUrl: null,
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
    // A new account is offered profile setup; skipping returns to the listing with the place saved.
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }))
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
    expect(await backend.loadProfile()).toMatchObject({ displayName: student.name, phone: '555-0100' })
  })

  test('Account shows Your profile and saving there keeps the student on Account', async () => {
    const { user, backend, location } = renderApp('/account', { signedInAs: student.email })
    await sessionReady()
    expect(await screen.findByRole('heading', { name: 'Your profile' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View my profile' })).toHaveAttribute('href', expect.stringMatching(/^\/students\/.+/))
    await user.type(await screen.findByLabelText('Bio'), 'Hello there')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText('Saved', { selector: 'p' })).toBeInTheDocument()
    expect(location().pathname).toBe('/account')
    expect(await backend.loadProfile()).toMatchObject({ bio: 'Hello there' })
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
    await act(async () => resolve({ ...blankProfile, displayName: student.name, phone: '555-0100' }))
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

  test('saving without having loaded the profile keeps the phone stored on the server', async () => {
    const base = createFakeBackend({ users: [student], sessionEmail: student.email })
    await base.saveProfile({ displayName: student.name, phone: '555-0100' })
    const backend: Backend = { ...base, loadProfile: async () => Promise.reject(new Error('network')) }
    const { user } = renderApp('/account', { backend })
    await sessionReady()
    await user.type(screen.getByLabelText('Name'), 'Fresh')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved', { selector: 'p' })).toBeInTheDocument()
    expect(await base.loadProfile()).toMatchObject({ displayName: 'Fresh', phone: '555-0100' })
  })

  test('saving without having loaded the profile still sets a phone the student typed', async () => {
    const base = createFakeBackend({ users: [student], sessionEmail: student.email })
    await base.saveProfile({ displayName: student.name, phone: '555-0100' })
    const backend: Backend = { ...base, loadProfile: async () => Promise.reject(new Error('network')) }
    const { user } = renderApp('/account', { backend })
    await sessionReady()
    await user.type(screen.getByLabelText('Name'), 'Fresh')
    await user.type(screen.getByLabelText('Phone (optional)'), '555-0199')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved', { selector: 'p' })).toBeInTheDocument()
    expect(await base.loadProfile()).toMatchObject({ displayName: 'Fresh', phone: '555-0199' })
  })

  test('a profile load that resolves after a save does not overwrite the saved profile', async () => {
    const base = createFakeBackend({ users: [student], sessionEmail: student.email })
    let resolve!: (p: Profile) => void
    let loads = 0
    // The first load hangs; the re-read after the save gets the real profile.
    const backend: Backend = { ...base, loadProfile: () => (loads++ === 0 ? new Promise<Profile>((r) => (resolve = r)) : base.loadProfile()) }
    const ref = {} as { account: ReturnType<typeof useAccount> }
    function Probe() {
      ref.account = useAccount()
      return null
    }
    render(
      <MemoryRouter>
        <AccountProvider backend={backend}>
          <Probe />
        </AccountProvider>
      </MemoryRouter>,
    )
    await sessionReady()
    await act(async () => void (await ref.account.saveProfile({ displayName: 'New', phone: '555-0100' })))
    await act(async () => resolve({ ...blankProfile, displayName: 'Old' }))
    expect(ref.account.profile).toMatchObject({ displayName: 'New', phone: '555-0100' })
  })

  test('saving before the profile has loaded re-reads it, so details the server holds are kept', async () => {
    const base = createFakeBackend({ users: [student], sessionEmail: student.email })
    await base.saveProfile({ displayName: student.name, bio: 'Hello there', lookingForRoommates: true })
    let loads = 0
    const backend: Backend = { ...base, loadProfile: () => (loads++ === 0 ? Promise.reject(new Error('network')) : base.loadProfile()) }
    const ref = {} as { account: ReturnType<typeof useAccount> }
    function Probe() {
      ref.account = useAccount()
      return null
    }
    render(
      <MemoryRouter>
        <AccountProvider backend={backend}>
          <Probe />
        </AccountProvider>
      </MemoryRouter>,
    )
    await sessionReady()
    expect(ref.account.profile).toBeNull()
    await act(async () => void (await ref.account.saveProfile({ displayName: 'New', phone: '555-0100' })))
    await waitFor(() => expect(ref.account.profile).toMatchObject({ displayName: 'New', phone: '555-0100', bio: 'Hello there', lookingForRoommates: true }))
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

  describe('Log out and unsynced changes', () => {
    const WARNING = 'Some changes haven’t synced yet. If you log out now, they’ll be lost on this device.'
    function renderWithProbe(backend: ReturnType<typeof createFakeBackend>) {
      const ref = {} as { app: AppStateValue }
      function Probe() {
        ref.app = useAppState()
        return null
      }
      const user = userEvent.setup()
      render(
        <MemoryRouter initialEntries={['/account']}>
          <AccountProvider backend={backend}>
            <AppStateProvider>
              <CloudSync />
              <Probe />
              <AppRoutes />
            </AppStateProvider>
          </AccountProvider>
        </MemoryRouter>,
      )
      return { user, ref }
    }

    test('a place saved just before Log out reaches the account', async () => {
      const backend = createFakeBackend({ users: [student], sessionEmail: student.email })
      const { user, ref } = renderWithProbe(backend)
      await screen.findByText('Saved to your account')
      act(() => ref.app.setSaved(listing.id, true))
      await user.click(screen.getByRole('button', { name: 'Log out' }))
      expect(await screen.findByText(SIGNED_OUT_LINE)).toBeInTheDocument()
      expect(backend.stateOf(student.email).savedIds).toEqual([listing.id])
      await backend.signIn(student.email, student.password)
      await waitFor(() => expect(ref.app.savedIds).toEqual([listing.id]))
    })

    test('offline, Log out warns first; Stay signed in keeps everything', async () => {
      const backend = createFakeBackend({ users: [student], sessionEmail: student.email })
      const { user, ref } = renderWithProbe(backend)
      await screen.findByText('Saved to your account')
      backend.setOffline(true)
      act(() => ref.app.setSaved(listing.id, true))
      await user.click(screen.getByRole('button', { name: 'Log out' }))
      expect(await screen.findByText(WARNING)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Stay signed in' }))
      expect(screen.queryByText(WARNING)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled()
      expect(ref.app.savedIds).toEqual([listing.id])
      expect(screen.queryByText(SIGNED_OUT_LINE)).not.toBeInTheDocument()
    })

    test('offline, Log out anyway signs out and clears this device', async () => {
      const backend = createFakeBackend({ users: [student], sessionEmail: student.email })
      const { user, ref } = renderWithProbe(backend)
      await screen.findByText('Saved to your account')
      backend.setOffline(true)
      act(() => ref.app.setSaved(listing.id, true))
      await user.click(screen.getByRole('button', { name: 'Log out' }))
      await user.click(await screen.findByRole('button', { name: 'Log out anyway' }))
      expect(await screen.findByText(SIGNED_OUT_LINE)).toBeInTheDocument()
      await waitFor(() => expect(ref.app.savedIds).toEqual([]))
    })

    test('shows a busy state while logging out', async () => {
      const backend = createFakeBackend({ users: [student], sessionEmail: student.email })
      let release = () => {}
      vi.spyOn(backend, 'signOut').mockImplementation(() => new Promise<void>((res) => (release = res)))
      const { user } = renderWithProbe(backend)
      await screen.findByText('Saved to your account')
      await user.click(screen.getByRole('button', { name: 'Log out' }))
      expect(await screen.findByRole('button', { name: 'Logging out…' })).toBeDisabled()
      await act(async () => release())
    })

    test('a failed sign out says so and lets the student try again', async () => {
      const backend = createFakeBackend({ users: [student], sessionEmail: student.email })
      vi.spyOn(backend, 'signOut').mockRejectedValueOnce(new Error('boom'))
      const { user } = renderWithProbe(backend)
      await screen.findByText('Saved to your account')
      await user.click(screen.getByRole('button', { name: 'Log out' }))
      expect(await screen.findByText('Couldn’t log out. Please try again.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Log out' }))
      expect(await screen.findByText(SIGNED_OUT_LINE)).toBeInTheDocument()
    })
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
    expect(await backend.loadProfile()).toMatchObject({ displayName: student.name, phone: null })
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
