import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { Backend } from '../lib/backend/types'
import { getAll } from '../lib/listingsRepo'
import { greetingName } from '../lib/messages'
import { createFakeBackend } from '../test/fakeBackend'
import { renderApp, sessionReady, setBudget } from '../test/renderApp'

vi.mock('../components/MiniMap', () => ({ default: () => <div>mini map</div> }))

const listing = getAll()[0]
const student = { email: 'maya@example.com', password: 'password123', name: 'Maya Chen' }

type User = ReturnType<typeof renderApp>['user']

async function createIn(scope: { getByRole: typeof screen.getByRole; getByLabelText: typeof screen.getByLabelText }, user: User) {
  await user.click(scope.getByRole('tab', { name: 'Create account' }))
  await user.type(scope.getByLabelText('Your name'), 'New Student')
  await user.type(scope.getByLabelText('Email'), 'new@example.com')
  await user.type(scope.getByLabelText('Password'), 'password123')
  await user.click(scope.getByRole('button', { name: 'Create account' }))
}

describe('Profile setup', () => {
  test('sign-up on Account goes to setup; Skip for now lands on /results', async () => {
    setBudget(1000)
    const { user, location } = renderApp('/account')
    await sessionReady()
    await createIn(screen, user)
    expect(await screen.findByRole('heading', { level: 1, name: 'Set up your profile' })).toBeInTheDocument()
    expect(location().pathname).toBe('/profile/setup')
    expect(screen.getByText('All of this is optional. You can change it any time in Account.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Account' })).toBeNull() // no bottom bar
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    await waitFor(() => expect(location().pathname).toBe('/results'))
  })

  test('Save and continue stores the profile and lands on /results', async () => {
    setBudget(1000)
    const { user, location, backend } = renderApp('/account')
    await sessionReady()
    await createIn(screen, user)
    await screen.findByRole('heading', { name: 'Set up your profile' })
    await user.type(await screen.findByLabelText('Bio'), 'Quiet and tidy.')
    await user.click(screen.getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(location().pathname).toBe('/results'))
    expect(await backend.loadProfile()).toMatchObject({ bio: 'Quiet and tidy.' })
  })

  test('sign-up waits for a session that arrives late instead of bouncing to /account', async () => {
    const base = createFakeBackend()
    const backend: Backend = { ...base, onAuthChange: (cb) => base.onAuthChange((s) => void setTimeout(() => cb(s), 60)) }
    const { user, location } = renderApp('/account', { backend })
    await screen.findByRole('tab', { name: 'Create account' })
    await createIn(screen, user)
    expect(await screen.findByRole('heading', { level: 1, name: 'Set up your profile' })).toBeInTheDocument()
    expect(location().pathname).toBe('/profile/setup')
  })

  test('sign-up from a listing’s Save: the place is saved, setup opens, Skip returns to that listing', async () => {
    setBudget(1000)
    const { user, location } = renderApp(`/listing/${listing.id}?from=test`)
    await user.click(screen.getByRole('button', { name: `Save ${listing.title}` }))
    await createIn(within(screen.getByRole('dialog', { name: 'Sign in' })), user)
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }))
    await waitFor(() => expect(location().pathname).toBe(`/listing/${listing.id}`))
    expect(location().search).toBe('?from=test')
    expect(await screen.findByRole('button', { name: `Save ${listing.title}` })).toHaveAttribute('aria-pressed', 'true')
  })

  test('sign-up from Message returns to the listing without opening the message form', async () => {
    setBudget(1000)
    const { user, location } = renderApp(`/listing/${listing.id}`)
    await user.click(screen.getByRole('button', { name: `Message ${greetingName(listing.poster)}` }))
    await createIn(within(screen.getByRole('dialog', { name: 'Sign in' })), user)
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }))
    await waitFor(() => expect(location().pathname).toBe(`/listing/${listing.id}`))
    await screen.findByRole('button', { name: `Save ${listing.title}` })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('signing in does not open setup', async () => {
    setBudget(1000)
    const { user, location } = renderApp('/account', { backend: createFakeBackend({ users: [student] }) })
    await sessionReady()
    await user.type(screen.getByLabelText('Email'), student.email)
    await user.type(screen.getByLabelText('Password'), student.password)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText(student.email)).toBeInTheDocument()
    expect(location().pathname).toBe('/account')
  })

  test('/profile/setup signed out redirects to /account', async () => {
    const { location } = renderApp('/profile/setup')
    await waitFor(() => expect(location().pathname).toBe('/account'))
  })

  test.each(['//evil.example.com', 'https://evil.example.com', 42])('an off-site returnTo (%s) is ignored', async (returnTo) => {
    setBudget(1000)
    const { user, location, navigate } = renderApp('/saved', { signedInAs: student.email })
    await sessionReady()
    await act(async () => void navigate('/profile/setup', { state: { returnTo } }))
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }))
    await waitFor(() => expect(location().pathname).toBe('/results'))
  })
})
