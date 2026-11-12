import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { StudentDetails } from '../lib/backend/types'
import * as avatar from '../lib/avatar'
import { MemoryRouter } from 'react-router-dom'
import { AccountProvider } from '../state/AccountState'
import { AppStateProvider } from '../state/AppState'
import { createFakeBackend } from '../test/fakeBackend'
import { setBudget } from '../test/renderApp'
import ProfileForm from './ProfileForm'

vi.mock('../lib/avatar', async (orig) => ({ ...(await orig<typeof import('../lib/avatar')>()), toSquareJpeg: vi.fn() }))

const ERR_SAVE = "Couldn't save. Check your connection and try again."
const student = { email: 'maya@example.com', password: 'password123', name: 'Maya Chen' }

beforeEach(() => {
  vi.mocked(avatar.toSquareJpeg).mockReset()
  vi.mocked(avatar.toSquareJpeg).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
})

async function setup(details: Partial<StudentDetails> = {}, name = student.name) {
  const backend = createFakeBackend({ users: [{ ...student, name }], sessionEmail: student.email })
  await backend.saveProfile({ displayName: name, ...details })
  const onSaved = vi.fn()
  const user = userEvent.setup({ applyAccept: false })
  render(
    <MemoryRouter>
      <AccountProvider backend={backend}>
        <AppStateProvider>
          <ProfileForm submitLabel="Save profile" onSaved={onSaved} secondary={<button type="button">Skip for now</button>} />
        </AppStateProvider>
      </AccountProvider>
    </MemoryRouter>,
  )
  await screen.findByLabelText('Bio')
  return { backend, onSaved, user }
}

const png = (bytes = 10, type = 'image/png') => new File([new Uint8Array(bytes)], 'me.png', { type })

describe('ProfileForm fields', () => {
  test('are prefilled from the profile', async () => {
    await setup({ bio: 'Hi there', program: 'Biology', year: '2', moveInTerm: '2027-fall', budget: 750, lookingForRoommates: true })
    expect(screen.getByLabelText('Bio')).toHaveValue('Hi there')
    expect(screen.getByLabelText('Program')).toHaveValue('Biology')
    expect(screen.getByLabelText('Year')).toHaveValue('2')
    expect(screen.getByLabelText('Move-in term')).toHaveValue('2027-fall')
    expect(screen.getByLabelText('Monthly budget')).toHaveValue(750)
    expect(screen.getByRole('switch', { name: 'Looking for roommates' })).toBeChecked()
    expect(screen.getByText('Shows your profile in the Students tab.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeInTheDocument()
  })

  test('budget starts from the search budget when the profile has none, and is only saved on submit', async () => {
    setBudget(900)
    const { backend, onSaved, user } = await setup()
    expect(screen.getByLabelText('Monthly budget')).toHaveValue(900)
    expect((await backend.loadProfile()).budget).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect((await backend.loadProfile()).budget).toBe(900)
  })

  test('an empty budget saves as no budget', async () => {
    const { backend, onSaved, user } = await setup({ budget: 700 })
    await user.clear(screen.getByLabelText('Monthly budget'))
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect((await backend.loadProfile()).budget).toBeNull()
  })

  test('a past stored term stays selectable', async () => {
    await setup({ moveInTerm: '2024-fall' })
    const select = screen.getByLabelText('Move-in term')
    expect(select).toHaveValue('2024-fall')
    expect(screen.getByRole('option', { name: 'Fall 2024' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Not sure yet' })).toBeInTheDocument()
  })

  test('the bio counts its characters', async () => {
    const { user } = await setup({ bio: 'abc' })
    expect(screen.getByText('3 / 300')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Bio'), 'de')
    expect(screen.getByText('5 / 300')).toBeInTheDocument()
  })

  test('invalid values show errors and nothing is saved', async () => {
    const { backend, onSaved, user } = await setup()
    await user.type(screen.getByLabelText('Monthly budget'), '5')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(screen.getByText('Enter a whole number from $300 to $5000.')).toBeInTheDocument()
    expect(screen.getByLabelText('Monthly budget')).toHaveAttribute('aria-invalid', 'true')
    expect(onSaved).not.toHaveBeenCalled()
    expect((await backend.loadProfile()).budget).toBeNull()
  })
})

describe('ProfileForm saving', () => {
  test('saves the details, trims the bio, keeps name and phone, and calls onSaved', async () => {
    const { backend, onSaved, user } = await setup()
    await backend.saveProfile({ displayName: student.name, phone: '555-0100' })
    await user.type(screen.getByLabelText('Bio'), '  Quiet and tidy.  ')
    await user.type(screen.getByLabelText('Program'), 'Biology')
    await user.selectOptions(screen.getByLabelText('Year'), '3')
    await user.selectOptions(screen.getByLabelText('Move-in term'), '2027-winter')
    await user.clear(screen.getByLabelText('Monthly budget'))
    await user.type(screen.getByLabelText('Monthly budget'), '800')
    await user.click(screen.getByRole('switch', { name: 'Looking for roommates' }))
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(await backend.loadProfile()).toMatchObject({
      displayName: student.name,
      phone: '555-0100',
      bio: 'Quiet and tidy.',
      program: 'Biology',
      year: '3',
      moveInTerm: '2027-winter',
      budget: 800,
      lookingForRoommates: true,
    })
  })

  test('offline: shows the error and keeps what was typed', async () => {
    const { backend, onSaved, user } = await setup()
    await user.type(screen.getByLabelText('Bio'), 'Hello')
    backend.setOffline(true)
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText(ERR_SAVE)).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Bio')).toHaveValue('Hello')
  })

  test('roommates on with a blank name shows a note that does not block saving', async () => {
    const { onSaved, user } = await setup({}, '')
    expect(screen.queryByText('Add your name to appear in Students.')).toBeNull()
    await user.click(screen.getByRole('switch', { name: 'Looking for roommates' }))
    expect(screen.getByText('Add your name to appear in Students.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })
})

describe('ProfileForm photo', () => {
  test.each([
    ['image/gif', 10, 'Choose a JPEG, PNG or WebP image.'],
    ['application/pdf', 10, 'Choose a JPEG, PNG or WebP image.'],
    ['image/png', 5 * 1024 * 1024 + 1, 'That photo is over 5 MB. Choose a smaller one.'],
  ])('%s of %i bytes is refused with its message', async (type, bytes, message) => {
    const { backend, user } = await setup()
    await user.upload(screen.getByLabelText('Photo'), png(bytes, type))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(avatar.toSquareJpeg).not.toHaveBeenCalled()
    expect(backend.avatarOf(student.email)).toBeNull()
  })

  test('a photo that cannot be decoded shows the unreadable message', async () => {
    vi.mocked(avatar.toSquareJpeg).mockRejectedValue(new Error('unreadable'))
    const { backend, user } = await setup()
    await user.upload(screen.getByLabelText('Photo'), png())
    expect(await screen.findByText("We couldn't read that image. Try another one.")).toBeInTheDocument()
    expect(backend.avatarOf(student.email)).toBeNull()
  })

  test('a valid photo uploads at once and then offers Remove photo', async () => {
    const { backend, user } = await setup()
    expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull()
    await user.upload(screen.getByLabelText('Photo'), png())
    expect(await screen.findByRole('button', { name: 'Remove photo' })).toBeInTheDocument()
    expect(backend.avatarOf(student.email)).not.toBeNull()
    expect(screen.queryByText('Uploading…')).toBeNull()
  })

  test('shows Uploading… while the photo is stored', async () => {
    let finish!: () => void
    vi.mocked(avatar.toSquareJpeg).mockReturnValue(new Promise((r) => (finish = () => r(new Blob(['x'])))))
    const { user } = await setup()
    await user.upload(screen.getByLabelText('Photo'), png())
    expect(await screen.findByText('Uploading…')).toBeInTheDocument()
    finish()
    await waitFor(() => expect(screen.queryByText('Uploading…')).toBeNull())
  })

  test('an upload failure shows the save error', async () => {
    const { backend, user } = await setup()
    backend.setOffline(true)
    await user.upload(screen.getByLabelText('Photo'), png())
    expect(await screen.findByText(ERR_SAVE)).toBeInTheDocument()
  })

  test('Remove photo removes it', async () => {
    const { backend, user } = await setup()
    await user.upload(screen.getByLabelText('Photo'), png())
    await user.click(await screen.findByRole('button', { name: 'Remove photo' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull())
    expect(backend.avatarOf(student.email)).toBeNull()
  })
})
