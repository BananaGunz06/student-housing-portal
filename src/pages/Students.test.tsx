import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { Backend } from '../lib/backend/types'
import { getAll } from '../lib/listingsRepo'
import { upcomingTerms } from '../lib/profile'
import { createFakeBackend, type FakeOptions } from '../test/fakeBackend'
import { renderApp, sessionReady, setBudget } from '../test/renderApp'

vi.mock('../components/MiniMap', () => ({ default: () => <div>mini map</div> }))

const me = { email: 'me@example.com', password: 'password123', name: 'Test Student' }
const [t1, t2] = upcomingTerms(new Date())

const seekers = [
  { email: 'maya@example.com', name: 'Maya Chen', lookingForRoommates: true, program: 'Biology', year: '2' as const, moveInTerm: t1.value, budget: 650, bio: 'Quiet and tidy.\nLove cooking.' },
  { email: 'omar@example.com', name: 'Omar Haddad', lookingForRoommates: true, moveInTerm: t2.value, budget: 900, bio: '' },
  { email: 'hidden@example.com', name: 'Hidden Person', lookingForRoommates: false },
]

function setup(url = '/students', students: FakeOptions['students'] = seekers, backend?: Backend) {
  return renderApp(url, { backend: backend ?? createFakeBackend({ users: [me], students, sessionEmail: me.email }) })
}

describe('Students page', () => {
  test('lists only roommate seekers and not the viewer', async () => {
    setup()
    expect(await screen.findByRole('heading', { level: 1, name: 'Students' })).toBeInTheDocument()
    expect(screen.getByText('Students looking for roommates.')).toBeInTheDocument()
    const maya = await screen.findByRole('link', { name: /^Maya Chen/ })
    expect(maya).toHaveAttribute('href', expect.stringMatching(/^\/students\/.+/))
    expect(within(maya).getByText('Biology · 2nd year')).toBeInTheDocument()
    expect(within(maya).getByText(`Moving in ${t1.label}`)).toBeInTheDocument()
    expect(within(maya).getByText('$650 a month')).toBeInTheDocument()
    expect(within(maya).getByText('Quiet and tidy.')).toBeInTheDocument()
    expect(within(maya).queryByText(/Love cooking/)).toBeNull()
    expect(screen.getByRole('link', { name: /^Omar Haddad/ })).toBeInTheDocument()
    expect(screen.queryByText(/Hidden Person/)).toBeNull()
    expect(screen.queryByRole('link', { name: /^Test Student/ })).toBeNull()
    expect(screen.queryByText(/example\.com/)).toBeNull()
  })

  test('filters by term and budget', async () => {
    const { user, location } = setup()
    await screen.findByRole('link', { name: /^Maya Chen/ })
    await user.selectOptions(screen.getByLabelText('Move-in term'), t2.value)
    await waitFor(() => expect(screen.queryByRole('link', { name: /^Maya Chen/ })).toBeNull())
    expect(screen.getByRole('link', { name: /^Omar Haddad/ })).toBeInTheDocument()
    expect(location().search).toBe(`?term=${t2.value}`)
    await user.selectOptions(screen.getByLabelText('Budget'), 'under600')
    expect(await screen.findByText('No students match these filters.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await screen.findByRole('link', { name: /^Maya Chen/ })).toBeInTheDocument()
    expect(location().search).toBe('')
  })

  test('filters come from the URL, unknown values are ignored', async () => {
    setup(`/students?term=${t1.value}&band=bogus`)
    expect(await screen.findByRole('link', { name: /^Maya Chen/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Omar Haddad/ })).toBeNull()
    expect(screen.getByLabelText('Move-in term')).toHaveValue(t1.value)
    expect(screen.getByLabelText('Budget')).toHaveValue('any')
  })

  test('Show more loads the next page', async () => {
    const many = Array.from({ length: 31 }, (_, i) => ({
      email: `s${i}@example.com`,
      name: `Student ${String(i).padStart(2, '0')}`,
      lookingForRoommates: true,
    }))
    const { user } = setup('/students', many)
    await screen.findAllByRole('link', { name: /^Student / })
    expect(screen.getAllByRole('link', { name: /^Student / })).toHaveLength(30)
    await user.click(screen.getByRole('button', { name: 'Show more' }))
    await waitFor(() => expect(screen.getAllByRole('link', { name: /^Student / })).toHaveLength(31))
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
  })

  test('Show more does not repeat a student when the list shifts between pages', async () => {
    const many = Array.from({ length: 31 }, (_, i) => ({ email: `s${i}@example.com`, name: `Student ${String(i).padStart(2, '0')}`, lookingForRoommates: true }))
    const base = createFakeBackend({ users: [me], students: many, sessionEmail: me.email })
    // Someone new joined after page 1 loaded: page 2 starts one place earlier.
    const backend: Backend = { ...base, listStudents: (q) => base.listStudents(q.offset > 0 ? { ...q, offset: q.offset - 1 } : q) }
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { user } = setup('/students', many, backend)
    await screen.findAllByRole('link', { name: /^Student / })
    await user.click(screen.getByRole('button', { name: 'Show more' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull())
    const names = screen.getAllByRole('link', { name: /^Student / }).map((a) => a.textContent)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toHaveLength(31)
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  test('a late Show more page is not appended after the filters changed', async () => {
    const many = Array.from({ length: 31 }, (_, i) => ({ email: `s${i}@example.com`, name: `Student ${String(i).padStart(2, '0')}`, lookingForRoommates: true, budget: 650 }))
    const base = createFakeBackend({ users: [me], students: many, sessionEmail: me.email })
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    const backend: Backend = { ...base, listStudents: async (q) => (q.offset > 0 ? (await gate, base.listStudents(q)) : base.listStudents(q)) }
    const { user } = setup('/students', many, backend)
    await screen.findAllByRole('link', { name: /^Student / })
    await user.click(screen.getByRole('button', { name: 'Show more' }))
    await user.selectOptions(screen.getByLabelText('Budget'), 'over1000')
    expect(await screen.findByText('No students match these filters.')).toBeInTheDocument()
    await act(async () => release())
    expect(screen.getByText('No students match these filters.')).toBeInTheDocument()
    expect(screen.queryAllByRole('link', { name: /^Student / })).toHaveLength(0)
  })

  test('empty state copy', async () => {
    setup('/students', [])
    expect(
      await screen.findByText("No students are looking for roommates yet. Switch on 'Looking for roommates' in your profile to be the first."),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit your profile' })).toHaveAttribute('href', '/account')
  })

  test('empty state hides the profile link when the viewer already looks for roommates', async () => {
    const backend = createFakeBackend({ users: [me], sessionEmail: me.email })
    await backend.saveProfile({ displayName: me.name, lookingForRoommates: true })
    setup('/students', [], backend)
    await screen.findByText(/No students are looking for roommates yet/)
    expect(screen.queryByRole('link', { name: 'Edit your profile' })).toBeNull()
  })

  test('signed-out prompt', async () => {
    const { user, location } = renderApp('/students')
    expect(await screen.findByText('Sign in to see students looking for roommates.')).toBeInTheDocument()
    await sessionReady()
    await user.click(screen.getByRole('link', { name: 'Sign in' }))
    expect(location().pathname).toBe('/account')
  })

  test('load failure offers Try again and recovers', async () => {
    const base = createFakeBackend({ users: [me], students: seekers, sessionEmail: me.email })
    const { user } = setup('/students', seekers, base)
    await screen.findByRole('link', { name: /^Maya Chen/ })
    base.setOffline(true)
    await user.selectOptions(screen.getByLabelText('Budget'), '600-800')
    expect(await screen.findByText("Couldn't load students.")).toBeInTheDocument()
    base.setOffline(false)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: /^Maya Chen/ })).toBeInTheDocument()
  })

  test('a 300-character unbroken bio does not widen the card', async () => {
    setup('/students', [{ email: 'long@example.com', name: 'Long Bio', lookingForRoommates: true, bio: 'x'.repeat(300) }])
    const card = await screen.findByRole('link', { name: /^Long Bio/ })
    const bio = within(card).getByText('x'.repeat(300))
    expect(bio.className).toMatch(/break-words/)
    expect(bio.className).toMatch(/truncate|line-clamp/)
    expect(card.querySelector('.min-w-0')).not.toBeNull()
  })

  test('nav has Places, Students, Saved, Messages, Account and no Map', async () => {
    setBudget(1000)
    const { user, location } = setup('/results')
    await sessionReady()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const names = within(nav).getAllByRole('link').map((a) => a.textContent)
    expect(names).toEqual(['Places', 'Students', 'Saved', 'Messages', 'Account'])
    expect(within(nav).queryByRole('link', { name: 'Map' })).toBeNull()
    expect(within(nav).getByRole('link', { name: 'Places' })).toHaveAttribute('aria-current', 'page')
    await user.click(within(nav).getByRole('link', { name: 'Students' }))
    expect(location().pathname).toBe('/students')
    expect(within(nav).getByRole('link', { name: 'Students' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Places' })).not.toHaveAttribute('aria-current')
  })

  test('Places is active on the map view and a listing; Students on a profile', async () => {
    setBudget(1000)
    const backend = createFakeBackend({ users: [me], students: seekers, sessionEmail: me.email })
    const { navigate } = setup('/results?view=map', seekers, backend)
    await sessionReady()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Places' })).toHaveAttribute('aria-current', 'page')
    await act(async () => navigate(`/listing/${getAll()[0].id}`))
    expect(within(nav).getByRole('link', { name: 'Places' })).toHaveAttribute('aria-current', 'page')
    const { students } = await backend.listStudents({ offset: 0, limit: 5 })
    await act(async () => navigate(`/students/${students[0].id}`))
    expect(within(nav).getByRole('link', { name: 'Students' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Places' })).not.toHaveAttribute('aria-current')
  })
})
