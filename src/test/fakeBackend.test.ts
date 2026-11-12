import { describe, expect, it, vi } from 'vitest'
import { createFakeBackend } from './fakeBackend'

describe('fake backend', () => {
  it('signs up, signs in and creates a profile', async () => {
    const b = createFakeBackend()
    const cb = vi.fn()
    b.onAuthChange(cb)
    expect(await b.signUp('Sam', 'sam@example.com', 'password1')).toEqual({ ok: true, needsConfirmation: false })
    expect((await b.getSession())?.email).toBe('sam@example.com')
    expect(await b.loadProfile()).toEqual({
      displayName: 'Sam',
      phone: null,
      bio: '',
      program: '',
      year: null,
      moveInTerm: null,
      budget: null,
      lookingForRoommates: false,
      avatarUrl: null,
    })
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ email: 'sam@example.com' }))
  })
  it('rejects taken email, weak password and wrong password', async () => {
    const b = createFakeBackend({ users: [{ email: 'a@b.co', password: 'password1', name: 'A' }] })
    expect(await b.signUp('X', 'a@b.co', 'password1')).toEqual({ ok: false, error: 'email-taken' })
    expect(await b.signUp('X', 'c@b.co', 'short')).toEqual({ ok: false, error: 'weak-password' })
    expect(await b.signIn('a@b.co', 'wrongpass1')).toEqual({ ok: false, error: 'invalid-credentials' })
  })
  it('fails when offline', async () => {
    const b = createFakeBackend({ offline: true })
    await expect(b.getSession()).rejects.toThrow('network')
    expect(await b.signIn('a@b.co', 'x')).toEqual({ ok: false, error: 'network' })
    b.setOffline(false)
    expect(await b.getSession()).toBeNull()
  })
  it('starts signed in with sessionEmail', async () => {
    const b = createFakeBackend({ users: [{ email: 'a@b.co', password: 'password1', name: 'A' }], sessionEmail: 'a@b.co' })
    expect((await b.getSession())?.email).toBe('a@b.co')
  })
  it('stores state copies and exposes stateOf', async () => {
    const b = createFakeBackend()
    await b.signUp('Sam', 'sam@example.com', 'password1')
    const s = { budget: 800, filters: null, savedIds: ['gue-001'], messages: [] }
    await b.saveState(s)
    s.savedIds.push('x')
    expect(b.stateOf('sam@example.com').savedIds).toEqual(['gue-001'])
    expect((await b.loadState()).budget).toBe(800)
  })
  it('deletes the account and signs out', async () => {
    const b = createFakeBackend()
    await b.signUp('Sam', 'sam@example.com', 'password1')
    await b.deleteAccount()
    expect(await b.getSession()).toBeNull()
    expect(await b.signIn('sam@example.com', 'password1')).toEqual({ ok: false, error: 'invalid-credentials' })
    await expect(b.loadProfile()).rejects.toThrow('not signed in')
  })

  it('saveProfile keeps fields that are left out', async () => {
    const b = createFakeBackend()
    await b.signUp('Sam', 'sam@example.com', 'password1')
    await b.saveProfile({ displayName: 'Sam', phone: '555-0100', bio: 'Hi', program: 'CS', year: '2', budget: 700, lookingForRoommates: true })
    await b.saveProfile({ displayName: 'Sam R' })
    expect(await b.loadProfile()).toMatchObject({
      displayName: 'Sam R',
      phone: '555-0100',
      bio: 'Hi',
      program: 'CS',
      year: '2',
      budget: 700,
      lookingForRoommates: true,
    })
    await b.saveProfile({ displayName: 'Sam R', phone: null, budget: null })
    expect(await b.loadProfile()).toMatchObject({ phone: null, budget: null, bio: 'Hi' })
  })

  const seeker = (name: string, extra: Record<string, unknown> = {}) => ({
    email: `${name.toLowerCase().replace(/\W/g, '')}@example.com`,
    name,
    lookingForRoommates: true,
    ...extra,
  })
  const q = { offset: 0, limit: 30 }

  it('listStudents returns only roommate seekers with a name, never the viewer, newest first', async () => {
    const b = createFakeBackend({
      students: [
        seeker('Ann'),
        seeker('Hidden', { lookingForRoommates: false }),
        seeker('', { email: 'noname@example.com' }),
        seeker('Bea'),
      ],
    })
    await b.signUp('Me', 'me@example.com', 'password1')
    await b.saveProfile({ displayName: 'Me', lookingForRoommates: true })
    expect((await b.listStudents(q)).students.map((s) => s.displayName)).toEqual(['Bea', 'Ann'])
    // Saving a profile makes it the newest.
    await b.signOut()
    await b.signUp('Cy', 'cy@example.com', 'password1')
    await b.saveProfile({ displayName: 'Cy', lookingForRoommates: true })
    await b.signOut()
    await b.signIn('me@example.com', 'password1')
    expect((await b.listStudents(q)).students.map((s) => s.displayName)).toEqual(['Cy', 'Bea', 'Ann'])
  })

  it('listStudents filters by term and by each budget band', async () => {
    const budgets = [600, 601, 800, 801, 1000, 1001, null]
    const b = createFakeBackend({
      students: [
        ...budgets.map((budget, i) => seeker(`S${i}`, { budget, moveInTerm: '2027-fall' })),
        seeker('Winter', { budget: 700, moveInTerm: '2027-winter' }),
      ],
    })
    await b.signUp('Me', 'me@example.com', 'password1')
    const names = async (band?: 'any' | 'under600' | '600-800' | '800-1000' | 'over1000', moveInTerm?: string) =>
      (await b.listStudents({ ...q, band, moveInTerm })).students.map((s) => s.budget).sort((x, y) => (x ?? 0) - (y ?? 0))
    expect(await names('any')).toHaveLength(8)
    expect(await names('under600')).toEqual([600])
    expect(await names('600-800')).toEqual([601, 700, 800])
    expect(await names('800-1000')).toEqual([801, 1000])
    expect(await names('over1000')).toEqual([1001])
    expect(await names(undefined, '2027-winter')).toEqual([700])
    expect(await names('600-800', '2027-fall')).toEqual([601, 800])
  })

  it('listStudents pages 30 with hasMore', async () => {
    const b = createFakeBackend({ students: Array.from({ length: 31 }, (_, i) => seeker(`Student ${i}`)) })
    await b.signUp('Me', 'me@example.com', 'password1')
    const first = await b.listStudents({ offset: 0, limit: 30 })
    expect(first.students).toHaveLength(30)
    expect(first.hasMore).toBe(true)
    const second = await b.listStudents({ offset: 30, limit: 30 })
    expect(second.students).toHaveLength(1)
    expect(second.hasMore).toBe(false)
  })

  it('getStudent returns null for a student not looking for roommates', async () => {
    const b = createFakeBackend({ students: [seeker('Ann'), seeker('Hidden', { lookingForRoommates: false })] })
    await b.signUp('Me', 'me@example.com', 'password1')
    const [ann] = (await b.listStudents(q)).students
    expect((await b.getStudent(ann.id))?.displayName).toBe('Ann')
    expect(await b.getStudent('user-2')).toBeNull()
    expect(await b.getStudent('nobody')).toBeNull()
  })

  it('uploadAvatar then loadProfile gives an avatarUrl; removeAvatar clears it', async () => {
    const b = createFakeBackend()
    await b.signUp('Sam', 'sam@example.com', 'password1')
    await b.removeAvatar()
    const blob = new Blob(['x'], { type: 'image/jpeg' })
    const url = await b.uploadAvatar(blob)
    expect(url).toMatch(/^https:\/\//)
    expect((await b.loadProfile()).avatarUrl).toBe(url)
    expect(b.avatarOf('sam@example.com')).toBe(blob)
    await b.removeAvatar()
    expect((await b.loadProfile()).avatarUrl).toBeNull()
    expect(b.avatarOf('sam@example.com')).toBeNull()
  })

  it('deleteAccount removes the photo', async () => {
    const b = createFakeBackend()
    await b.signUp('Sam', 'sam@example.com', 'password1')
    await b.uploadAvatar(new Blob(['x'], { type: 'image/jpeg' }))
    await b.deleteAccount()
    expect(b.avatarOf('sam@example.com')).toBeNull()
  })
})
