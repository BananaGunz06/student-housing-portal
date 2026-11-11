import { useCallback, useEffect, useRef } from 'react'
import type { CloudState } from '../lib/backend/types'
import { safeStorage } from '../lib/storage'
import { cleanCloudState, mergeStates } from '../lib/sync'
import { useAccount } from './AccountState'
import { useAppState } from './AppState'

const DEBOUNCE_MS = 800
/** Which account the saved places and messages on this device belong to. */
const OWNER_KEY = 'shp.owner'
const json = (s: CloudState) => JSON.stringify(s)

/**
 * Keeps budget, filters, saved places and messages in step with the signed-in
 * account: merge on sign in, debounced saves after changes, retry when back
 * online, and forget personal data on sign out.
 */
export function useCloudSync(): void {
  const { backend, session, status, restoreFailed, setSyncStatus } = useAccount()
  const { deviceState, replaceAll, clearPersonal } = useAppState()
  const userId = session?.userId ?? null
  const deviceJson = json(deviceState)

  // Mutable bookkeeping that never drives rendering.
  const bag = useRef({
    device: deviceState,
    /** Bumped whenever the user changes, so results of older work are ignored. */
    generation: 0,
    timer: null as ReturnType<typeof setTimeout> | null,
    /** The user whose account has been read and merged. */
    loadedFor: null as string | null,
    loading: false,
    /** JSON of the save in flight, if any; only one runs at a time. */
    inflight: null as string | null,
    failed: false,
    /** What the account is known to hold. */
    lastSaved: null as string | null,
    previousUser: null as string | null,
  })

  useEffect(() => {
    bag.current.device = deviceState
  })

  const clearTimer = useCallback(() => {
    if (bag.current.timer) clearTimeout(bag.current.timer)
    bag.current.timer = null
  }, [])

  /** Forget everything about the user who just left. */
  const reset = useCallback(() => {
    const m = bag.current
    m.generation++
    if (m.timer) clearTimeout(m.timer)
    m.timer = null
    m.loadedFor = null
    m.loading = false
    m.inflight = null
    m.failed = false
    m.lastSaved = null
  }, [])

  const save = useCallback(
    async (gen: number): Promise<void> => {
      const m = bag.current
      // The running save checks again for newer changes when it finishes.
      if (m.inflight !== null) return
      for (;;) {
        const state = m.device
        const text = json(state)
        if (text === m.lastSaved) {
          setSyncStatus('saved')
          return
        }
        m.inflight = text
        setSyncStatus('saving')
        try {
          await backend.saveState(state)
        } catch {
          if (gen !== m.generation) return
          m.inflight = null
          m.failed = true
          setSyncStatus('error')
          return
        }
        if (gen !== m.generation) return
        m.inflight = null
        m.lastSaved = text
        m.failed = false
        if (m.loadedFor) safeStorage.set(OWNER_KEY, m.loadedFor)
      }
    },
    [backend, setSyncStatus],
  )

  const load = useCallback(
    async (uid: string, gen: number) => {
      const m = bag.current
      if (m.loading) return
      m.loading = true
      setSyncStatus('saving')
      try {
        const account = cleanCloudState(await backend.loadState())
        if (gen !== m.generation) return
        // Another account's places and messages never mix into this one.
        const owner = safeStorage.get(OWNER_KEY)
        const foreign = owner !== null && owner !== uid
        const device = foreign ? { ...m.device, savedIds: [], messages: [] } : m.device
        const merged = mergeStates(device, account)
        // Record before replacing, so the change this causes is not saved again.
        m.lastSaved = json(account)
        m.loadedFor = uid
        m.failed = false
        safeStorage.set(OWNER_KEY, uid)
        replaceAll(merged, foreign)
        m.device = merged
        m.loading = false
        await save(gen)
      } catch {
        if (gen !== m.generation) return
        m.failed = true
        setSyncStatus('error')
      } finally {
        if (gen === m.generation) m.loading = false
      }
    },
    [backend, replaceAll, save, setSyncStatus],
  )

  /** Do whatever is outstanding: the first load, or a save of the current data. */
  const catchUp = useCallback(
    (uid: string) => {
      const gen = bag.current.generation
      if (bag.current.loadedFor !== uid) void load(uid, gen)
      else void save(gen)
    },
    [load, save],
  )

  // Sign in, sign out, or a different user.
  useEffect(() => {
    if (userId) {
      catchUp(userId)
    } else if (bag.current.previousUser) {
      clearPersonal()
      safeStorage.remove(OWNER_KEY)
      setSyncStatus('idle')
    }
    bag.current.previousUser = userId
    return reset
  }, [userId, catchUp, clearPersonal, reset, setSyncStatus])

  // Started with no session, but this device still holds a former user's data.
  useEffect(() => {
    if (status === 'signed-out' && !restoreFailed && safeStorage.get(OWNER_KEY) !== null) {
      clearPersonal()
      safeStorage.remove(OWNER_KEY)
    }
  }, [status, restoreFailed, clearPersonal])

  // Changes after the account has loaded (or while a failed load waits for a retry).
  useEffect(() => {
    if (!userId || bag.current.loading) return
    if (bag.current.loadedFor === userId) {
      if (deviceJson === bag.current.inflight) return
      if (deviceJson === bag.current.lastSaved) {
        // Changed back before anything needed saving.
        clearTimer()
        if (bag.current.inflight === null) setSyncStatus('saved')
        return
      }
    }
    if (bag.current.loadedFor !== userId && !bag.current.failed) return
    clearTimer()
    if (bag.current.loadedFor === userId) setSyncStatus('saving')
    bag.current.timer = setTimeout(() => {
      bag.current.timer = null
      catchUp(userId)
    }, DEBOUNCE_MS)
    return clearTimer
  }, [userId, deviceJson, catchUp, clearTimer, setSyncStatus])

  // Back online after a failure.
  useEffect(() => {
    if (!userId) return
    const onOnline = () => {
      if (bag.current.failed) catchUp(userId)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [userId, catchUp])
}
