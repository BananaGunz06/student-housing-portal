import { screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { upcomingTerms } from '../lib/profile'
import { createFakeBackend } from '../test/fakeBackend'
import { renderApp } from '../test/renderApp'

vi.mock('../components/MiniMap', () => ({ default: () => <div>mini map</div> }))

const me = { email: 'me@example.com', password: 'password123', name: 'Test Student' }
const [t1] = upcomingTerms(new Date())
const maya = {
  email: 'maya@example.com',
  name: 'Maya Chen',
  lookingForRoommates: true,
  program: 'Biology',
  year: '2' as const,
  moveInTerm: t1.value,
  budget: 650,
  bio: 'Quiet and tidy.\nLove cooking.',
}

async function idOf(backend: ReturnType<typeof createFakeBackend>, name: string) {
  const { students } = await backend.listStudents({ offset: 0, limit: 50 })
  return students.find((s) => s.displayName === name)!.id
}

describe('Student profile page', () => {
  test('profile page shows the fields and no email or phone', async () => {
    const backend = createFakeBackend({ users: [me], students: [maya, { email: 'h@example.com', name: 'Hidden', lookingForRoommates: false }], sessionEmail: me.email })
    const id = await idOf(backend, 'Maya Chen')
    renderApp(`/students/${id}`, { backend })
    expect(await screen.findByRole('heading', { level: 1, name: 'Maya Chen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Students' })).toHaveAttribute('href', '/students')
    expect(screen.getByText('Biology · 2nd year')).toBeInTheDocument()
    expect(screen.getByText(`Moving in ${t1.label}`)).toBeInTheDocument()
    expect(screen.getByText('Budget: $650 a month')).toBeInTheDocument()
    expect(screen.getByText('Looking for roommates')).toBeInTheDocument()
    const bio = screen.getByText(/Quiet and tidy\./)
    expect(bio.className).toMatch(/whitespace-pre-line|whitespace-pre-wrap/)
    expect(bio.textContent).toBe('Quiet and tidy.\nLove cooking.')
    expect(screen.queryByText(/example\.com/)).toBeNull()
    expect(screen.queryByText(/555/)).toBeNull()
    expect(screen.queryByRole('button', { name: /message/i })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Edit profile' })).toBeNull()
  })

  test('a student with no details gets a placeholder line', async () => {
    const backend = createFakeBackend({ users: [me], students: [{ email: 'a@example.com', name: 'Blank Slate', lookingForRoommates: true }], sessionEmail: me.email })
    renderApp(`/students/${await idOf(backend, 'Blank Slate')}`, { backend })
    expect(await screen.findByText("This student hasn't added details yet.")).toBeInTheDocument()
    expect(screen.queryByText(/Budget:/)).toBeNull()
  })

  test('hidden profile shows "This profile isn\'t available."', async () => {
    const backend = createFakeBackend({ users: [me], students: [{ email: 'h@example.com', name: 'Hidden', lookingForRoommates: false }], sessionEmail: me.email })
    renderApp('/students/not-a-real-id', { backend })
    expect(await screen.findByText("This profile isn't available.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Students' })).toHaveAttribute('href', '/students')
  })

  test('own profile shows Edit profile even with roommates off', async () => {
    const backend = createFakeBackend({ users: [me], sessionEmail: me.email })
    await backend.saveProfile({ displayName: me.name, bio: 'My own bio', lookingForRoommates: false })
    const spy = vi.spyOn(backend, 'getStudent')
    const session = await backend.getSession()
    renderApp(`/students/${session!.userId}`, { backend })
    expect(await screen.findByRole('heading', { level: 1, name: 'Test Student' })).toBeInTheDocument()
    expect(screen.getByText('My own bio')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/account')
    expect(spy).not.toHaveBeenCalled()
  })

  test('load failure offers Try again and recovers', async () => {
    const base = createFakeBackend({ users: [me], students: [maya], sessionEmail: me.email })
    const id = await idOf(base, 'Maya Chen')
    let fail = true
    const backend = { ...base, getStudent: async (sid: string) => (fail ? Promise.reject(new Error('network')) : base.getStudent(sid)) }
    const { user } = renderApp(`/students/${id}`, { backend })
    expect(await screen.findByText("Couldn't load this profile.")).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Maya Chen' })).toBeInTheDocument()
  })

  test('signed out redirects to /account', async () => {
    const { location } = renderApp('/students/abc')
    await waitFor(() => expect(location().pathname).toBe('/account'))
  })
})
