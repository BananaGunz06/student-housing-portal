import { useCallback, useEffect, useRef } from 'react'
import type { CloudState } from '../lib/backend/types'
import { cleanCloudState, mergeStates } from '../lib/sync'
import { useAccount } from './AccountState'
import { useAppState } from './AppState'

const DEBOUNCE_MS = 800
const json = (s: CloudState) => JSON.stringify(s)

/**
 * Keeps budget, filters, saved places and messages in step with the signed-in
 * account: merge on sign in, debounced saves after changes, retry when back
 * online, and forget personal data on sign out.
 */
export function useCloudSync(): void {
  const { backend, session, setSyncStatus } = useAccount()
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
    m.failed = false
    m.lastSaved = null
  }, [])

  const save = useCallback(
    async (gen: number) => {
      const state = bag.current.device
      setSyncStatus('saving')
      try {
        await backend.saveState(state)
        if (gen !== bag.current.generation) return
        bag.current.lastSaved = json(state)
        bag.current.failed = false
        setSyncStatus('saved')
      } catch {
        if (gen !== bag.current.generation) return
        bag.current.failed = true
        setSyncStatus('error')
      }
    },
    [backend,  setSyncStatus],
  )

  const load = useCallback(
    async (uid: string, gen: number) => {
      if (bag.current.loading) return
      bag.current.loading = true
      setSyncStatus('saving')
      try {
        const account = cleanCloudState(await backend.loadState())
        if (gen !== bag.current.generation) return
        const merged = mergeStates(bag.current.device, account)
        // Record before replacing, so the change this causes is not saved again.
        bag.current.lastSaved = json(account)
        bag.current.loadedFor = uid
        bag.current.failed = false
        replaceAll(merged)
        if (json(merged) !== json(account)) {
          bag.current.device = merged
          bag.current.loading = false
          await save(gen)
        } else {
          setSyncStatus('saved')
        }
      } catch {
        if (gen !== bag.current.generation) return
        bag.current.failed = true
        setSyncStatus('error')
      } finally {
        if (gen === bag.current.generation) bag.current.loading = false
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
      setSyncStatus('idle')
    }
    bag.current.previousUser = userId
    return reset
  }, [userId, catchUp, clearPersonal, reset, setSyncStatus])

  // Changes after the account has loaded (or while a failed load waits for a retry).
  useEffect(() => {
    if (!userId || bag.current.loading) return
    if (bag.current.loadedFor === userId && deviceJson === bag.current.lastSaved) return
    if (bag.current.loadedFor !== userId && !bag.current.failed) return
    clearTimer()
    bag.current.timer = setTimeout(() => {
      bag.current.timer = null
      catchUp(userId)
    }, DEBOUNCE_MS)
    return clearTimer
  }, [userId,  deviceJson, catchUp, clearTimer])

  // Back online after a failure.
  useEffect(() => {
    if (!userId) return
    const onOnline = () => {
      if (bag.current.failed) catchUp(userId)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [userId,  catchUp])
}
