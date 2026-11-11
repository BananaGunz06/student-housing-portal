import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FILTERS } from '../lib/filters'
import type { Message } from '../lib/messages'
import { createFakeBackend } from '../test/fakeBackend'
import { AccountProvider, useAccount, type AccountApi } from './AccountState'
import { AppStateProvider, useAppState, type AppState } from './AppState'
import { CloudSync } from './CloudSync'

const ID1 = 'gue-001'
const ID2 = 'gue-002'
const msg = (id: string): Message => ({ id, listingId: ID1, sentAt: '2026-01-01T10:00:00.000Z', body: 'hi', shared: {} })

type Backend = ReturnType<typeof createFakeBackend>

function setup(backend: Backend) {
  const ref = {} as { app: AppState; account: AccountApi }
  function Probe() {
    ref.app = useAppState()
    ref.account = useAccount()
    return null
  }
  render(
    <AccountProvider backend={backend}>
      <AppStateProvider>
        <CloudSync />
        <Probe />
      </AppStateProvider>
    </AccountProvider>,
  )
  return ref
}

const flush = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))
async function waitUntil(check: () => void) {
  let last: unknown
  for (let i = 0; i < 40; i++) {
    try {
      return check()
    } catch (e) {
      last = e
    }
    await flush(10)
  }
  throw last
}

/** Make saves wait until the test releases them, one by one, in order. */
function deferSaves(fake: Backend) {
  const real = fake.saveState.bind(fake)
  const waiting: (() => void)[] = []
  const spy = vi.spyOn(fake, 'saveState').mockImplementation(
    (s) => new Promise<void>((resolve) => waiting.push(() => void real(s).then(resolve))),
  )
  return { spy, release: () => act(async () => void waiting.shift()?.()) }
}

const U = { email: 'a@example.com', password: 'password123', name: 'A' }

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('cloud sync', () => {
  it('moves a budget set while signed out into a new account', async () => {
    const fake = createFakeBackend()
    const ref = setup(fake)
    await flush()
    act(() => ref.app.setBudget(900))
    await act(async () => void (await ref.account.signUp('A', U.email, U.password)))
    await flush()
    await waitUntil(() => expect(fake.stateOf(U.email).budget).toBe(900))
    expect(ref.account.syncStatus).toBe('saved')
  })

  it('shows places saved on the account on a fresh device', async () => {
    const fake = createFakeBackend({ users: [{ ...U, state: { budget: 800, savedIds: [ID1, ID2], messages: [msg('m1')] } }] })
    const ref = setup(fake)
    await flush()
    await act(async () => void (await ref.account.signIn(U.email, U.password)))
    await waitUntil(() => expect(ref.app.savedIds).toEqual([ID1, ID2]))
    expect(ref.app.budget).toBe(800)
    expect(ref.app.messages).toHaveLength(1)
  })

  it('sends a place saved while signed in to the account after 800 ms', async () => {
    const fake = createFakeBackend({ users: [U], sessionEmail: U.email })
    const ref = setup(fake)
    await waitUntil(() => expect(ref.account.syncStatus).toBe('saved'))
    act(() => ref.app.setSaved(ID1, true))
    await flush(700)
    expect(fake.stateOf(U.email).savedIds).toEqual([])
    await flush(200)
    expect(fake.stateOf(U.email).savedIds).toEqual([ID1])
    expect(ref.account.syncStatus).toBe('saved')
  })

  it('makes one save for two quick changes', async () => {
    const fake = createFakeBackend({ users: [U], sessionEmail: U.email })
    const ref = setup(fake)
    await waitUntil(() => expect(ref.account.syncStatus).toBe('saved'))
    const spy = vi.spyOn(fake, 'saveState')
    act(() => ref.app.setSaved(ID1, true))
    await flush(300)
    act(() => ref.app.setSaved(ID2, true))
    await flush(1000)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(fake.stateOf(U.email).savedIds).toEqual([ID1, ID2])
  })

  it('does not save the account back when nothing changed on sign in', async () => {
    const fake = createFakeBackend({ users: [{ ...U, state: { budget: 800, filters: DEFAULT_FILTERS, savedIds: [ID1] } }], sessionEmail: U.email })
    const spy = vi.spyOn(fake, 'saveState')
    const ref = setup(fake)
    await waitUntil(() => expect(ref.account.syncStatus).toBe('saved'))
    await flush(2000)
    expect(spy).not.toHaveBeenCalled()
  })

  it('reports an error offline, then retries when back online', async () => {
    const fake = createFakeBackend({ users: [U], sessionEmail: U.email })
    const ref = setup(fake)
    await waitUntil(() => expect(ref.account.syncStatus).toBe('saved'))
    fake.setOffline(true)
    act(() => ref.app.setSaved(ID1, true))
    await flush(900)
    expect(ref.account.syncStatus).toBe('error')
    expect(ref.app.savedIds).toEqual([ID1])
    fake.setOffline(false)
    await act(async () => void window.dispatchEvent(new Event('online')))
    await waitUntil(() => expect(ref.account.syncStatus).toBe('saved'))
    expect(fake.stateOf(U.email).savedIds).toEqual([ID1])
  })

  it('retries the first load when it failed', async () => {
    const fake = createFakeBackend({ users: [{ ...U, state: { savedIds: [ID2] } }], sessionEmail: U.email })
    const load = vi.spyOn(fake, 'loadState').mockRejectedValueOnce(new Error('network'))
    const ref = setup(fake)
    await waitUntil(() => expect(ref.account.syncStatus).toBe('error'))
    act(() => ref.app.setSaved(ID1, true))
    await flush(900)
    expect(load).toHaveBeenCalledTimes(2)
    await waitUntil(() => expect(ref.account.syncStatus).toBe('saved'))
    expect(fake.stateOf(U.email).savedIds.sort()).toEqual([ID1, ID2])
  })

  it('clears saved places and messages on sign out but keeps the budget', async () => {
    const fake = createFakeBackend({ users: [{ ...U, state: { budget: 800, savedIds: [ID1], messages: [msg('m1')] } }], sessionEmail: U.email })
    const ref = setup(fake)
    await waitUntil(() => expect(ref.app.savedIds).toEqual([ID1]))
    await act(async () => void (await ref.account.signOut()))
    await waitUntil(() => expect(ref.app.savedIds).toEqual([]))
    expect(ref.app.messages).toEqual([])
    expect(ref.app.budget).toBe(800)
    expect(ref.account.syncStatus).toBe('idle')
  })

  it("does not show user A's places to user B", async () => {
    const fake = createFakeBackend({
      users: [{ ...U, state: { budget: 800, savedIds: [ID1] } }, { email: 'b@example.com', password: 'password123', name: 'B' }],
      sessionEmail: U.email,
    })
    const ref = setup(fake)
    await waitUntil(() => expect(ref.app.savedIds).toEqual([ID1]))
    await act(async () => void (await ref.account.signOut()))
    await waitUntil(() => expect(ref.app.savedIds).toEqual([]))
    await act(async () => void (await ref.account.signIn('b@example.com', 'password123')))
    await waitUntil(() => expect(ref.account.syncStatus).toBe('saved'))
    await flush(2000)
    expect(ref.app.savedIds).toEqual([])
    expect(fake.stateOf('b@example.com').savedIds).toEqual([])
    expect(fake.stateOf(U.email).savedIds).toEqual([ID1])
  })

  it('loads an account row with junk and drops the junk', async () => {
    const fake = createFakeBackend({
      users: [
        {
          ...U,
          state: {
            budget: 800,
            filters: { bedrooms: 'lots', types: ['castle', 'room'], furnishedOnly: 'yes' } as never,
            savedIds: [ID1, 'nope-999', 42 as never],
            messages: [msg('ok'), { id: 'x' } as never, 'junk' as never, { ...msg('gone'), listingId: 'nope-999' }],
          },
        },
      ],
      sessionEmail: U.email,
    })
    const ref = setup(fake)
    await waitUntil(() => expect(ref.account.syncStatus).toBe('saved'))
    expect(ref.app.savedIds).toEqual([ID1])
    expect(ref.app.messages.map((m) => m.id)).toEqual(['ok'])
    expect(ref.app.filters.types).toEqual(['room'])
    expect(ref.app.filters.bedrooms).toBe(DEFAULT_FILTERS.bedrooms)
  })

  it('saves a sign-in merge once even when the save is slow', async () => {
    const fake = createFakeBackend()
    const { spy, release } = deferSaves(fake)
    const ref = setup(fake)
    await flush()
    act(() => ref.app.setBudget(900))
    await act(async () => void (await ref.account.signUp('A', U.email, U.password)))
    await flush(3000)
    expect(spy).toHaveBeenCalledTimes(1)
    await release()
    await flush(3000)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(fake.stateOf(U.email).budget).toBe(900)
    expect(ref.account.syncStatus).toBe('saved')
  })

  it('runs one save at a time and ends with the latest state', async () => {
    const fake = createFakeBackend({ users: [U], sessionEmail: U.email })
    const ref = setup(fake)
    await waitUntil(() => expect(ref.account.syncStatus).toBe('saved'))
    const { spy, release } = deferSaves(fake)
    act(() => ref.app.setSaved(ID1, true))
    await flush(900)
    expect(spy).toHaveBeenCalledTimes(1)
    act(() => ref.app.setSaved(ID2, true))
    await flush(900)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(ref.account.syncStatus).toBe('saving')
    await release()
    await flush()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(ref.account.syncStatus).toBe('saving')
    await release()
    await flush(3000)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(fake.stateOf(U.email).savedIds).toEqual([ID1, ID2])
    expect(ref.account.syncStatus).toBe('saved')
  })

  it("clears a former user's data when the session has expired at startup", async () => {
    localStorage.setItem('shp.owner', 'user-1')
    localStorage.setItem('shp.saved', JSON.stringify([ID1]))
    localStorage.setItem('shp.messages', JSON.stringify([msg('m1')]))
    localStorage.setItem('shp.budget', '800')
    const ref = setup(createFakeBackend({ users: [U] }))
    await waitUntil(() => expect(ref.app.savedIds).toEqual([]))
    expect(ref.app.messages).toEqual([])
    expect(ref.app.budget).toBe(800)
    expect(localStorage.getItem('shp.owner')).toBeNull()
  })

  it("does not merge another user's places into a new sign-in", async () => {
    localStorage.setItem('shp.owner', 'someone-else')
    localStorage.setItem('shp.saved', JSON.stringify([ID1]))
    localStorage.setItem('shp.messages', JSON.stringify([msg('m1')]))
    const fake = createFakeBackend({ users: [{ ...U, state: { savedIds: [ID2] } }] })
    const ref = setup(fake)
    await flush()
    await act(async () => void (await ref.account.signIn(U.email, U.password)))
    await waitUntil(() => expect(ref.account.syncStatus).toBe('saved'))
    await flush(2000)
    expect(ref.app.savedIds).toEqual([ID2])
    expect(ref.app.messages).toEqual([])
    expect(fake.stateOf(U.email).savedIds).toEqual([ID2])
    expect(fake.stateOf(U.email).messages).toEqual([])
    expect(localStorage.getItem('shp.owner')).toBe('user-1')
  })

  it("keeps the saved places both the device's old owner and the new user had", async () => {
    localStorage.setItem('shp.owner', 'someone-else')
    localStorage.setItem('shp.saved', JSON.stringify([ID1]))
    const fake = createFakeBackend({ users: [{ ...U, state: { savedIds: [ID1], messages: [msg('m1')] } }] })
    localStorage.setItem('shp.messages', JSON.stringify([msg('m1')]))
    const ref = setup(fake)
    await flush()
    await act(async () => void (await ref.account.signIn(U.email, U.password)))
    await waitUntil(() => expect(ref.account.syncStatus).toBe('saved'))
    await flush(3000)
    expect(ref.app.savedIds).toEqual([ID1])
    expect(ref.app.messages.map((m) => m.id)).toEqual(['m1'])
    expect(fake.stateOf(U.email).savedIds).toEqual([ID1])
    expect(fake.stateOf(U.email).messages.map((m) => m.id)).toEqual(['m1'])
  })

  it('ends saved, with no save, when a change is undone within the debounce', async () => {
    const fake = createFakeBackend({ users: [U], sessionEmail: U.email })
    const ref = setup(fake)
    await waitUntil(() => expect(ref.account.syncStatus).toBe('saved'))
    const spy = vi.spyOn(fake, 'saveState')
    act(() => ref.app.setSaved(ID1, true))
    await flush(300)
    act(() => ref.app.setSaved(ID1, false))
    await flush(2000)
    expect(spy).not.toHaveBeenCalled()
    expect(ref.account.syncStatus).toBe('saved')
  })

  it('keeps local data when the session could not be read (offline start)', async () => {
    localStorage.setItem('shp.owner', 'user-1')
    localStorage.setItem('shp.saved', JSON.stringify([ID1]))
    const fake = createFakeBackend({ users: [U], sessionEmail: U.email, offline: true })
    const ref = setup(fake)
    await flush(2000)
    expect(ref.account.status).toBe('signed-out')
    expect(ref.app.savedIds).toEqual([ID1])
    expect(localStorage.getItem('shp.owner')).toBe('user-1')
  })

  const synced = (savedIds: string[]) => ({ budget: 800, filters: DEFAULT_FILTERS, savedIds, messages: [] })
  function ownDevice(savedIds: string[], snapshot: string[]) {
    localStorage.setItem('shp.owner', 'user-1')
    localStorage.setItem('shp.synced', JSON.stringify(synced(snapshot)))
    localStorage.setItem('shp.budget', '800')
    localStorage.setItem('shp.filters', JSON.stringify(DEFAULT_FILTERS))
    localStorage.setItem('shp.saved', JSON.stringify(savedIds))
  }

  it('keeps a place removed on another device removed', async () => {
    ownDevice([ID1, ID2], [ID1, ID2])
    const fake = createFakeBackend({ users: [{ ...U, state: synced([ID1]) }], sessionEmail: U.email })
    const spy = vi.spyOn(fake, 'saveState')
    const ref = setup(fake)
    await waitUntil(() => expect(ref.account.syncStatus).toBe('saved'))
    await flush(3000)
    expect(ref.app.savedIds).toEqual([ID1])
    expect(spy).not.toHaveBeenCalled()
    expect(fake.stateOf(U.email).savedIds).toEqual([ID1])
  })

  it('keeps a removal made while the account is still loading', async () => {
    ownDevice([ID1, ID2], [ID1, ID2])
    const fake = createFakeBackend({ users: [{ ...U, state: synced([ID1, ID2]) }], sessionEmail: U.email })
    const real = fake.loadState.bind(fake)
    let release = () => {}
    vi.spyOn(fake, 'loadState').mockImplementation(() => new Promise((res) => (release = () => void real().then(res))))
    const ref = setup(fake)
    await flush(100)
    act(() => ref.app.setSaved(ID2, false))
    await flush(100)
    await act(async () => release())
    await flush(3000)
    expect(ref.app.savedIds).toEqual([ID1])
    expect(fake.stateOf(U.email).savedIds).toEqual([ID1])
    expect(ref.account.syncStatus).toBe('saved')
  })

  it('still unions a device with no history into the first account it signs in to', async () => {
    localStorage.setItem('shp.saved', JSON.stringify([ID1]))
    const fake = createFakeBackend({ users: [{ ...U, state: { savedIds: [ID2] } }] })
    const ref = setup(fake)
    await flush()
    await act(async () => void (await ref.account.signIn(U.email, U.password)))
    await waitUntil(() => expect(ref.account.syncStatus).toBe('saved'))
    await flush(2000)
    expect(ref.app.savedIds).toEqual([ID2, ID1])
    expect(fake.stateOf(U.email).savedIds).toEqual([ID2, ID1])
  })
})
