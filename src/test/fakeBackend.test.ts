import { describe, expect, it, vi } from 'vitest'
import { createFakeBackend } from './fakeBackend'

describe('fake backend', () => {
  it('signs up, signs in and creates a profile', async () => {
    const b = createFakeBackend()
    const cb = vi.fn()
    b.onAuthChange(cb)
    expect(await b.signUp('Sam', 'sam@example.com', 'password1')).toEqual({ ok: true, needsConfirmation: false })
    expect((await b.getSession())?.email).toBe('sam@example.com')
    expect(await b.loadProfile()).toEqual({ displayName: 'Sam', phone: null })
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
})
