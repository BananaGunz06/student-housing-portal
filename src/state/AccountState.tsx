import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import SignInSheet from '../components/SignInSheet'
import type { AuthResult, Backend, Profile, Session } from '../lib/backend/types'

export type AccountReason = 'save' | 'message'
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface AccountApi {
  status: 'loading' | 'signed-out' | 'signed-in'
  session: Session | null
  profile: Profile | null
  signIn(email: string, password: string): Promise<AuthResult>
  signUp(name: string, email: string, password: string): Promise<AuthResult>
  signOut(): Promise<void>
  deleteAccount(): Promise<void>
  saveProfile(p: Profile): Promise<void>
  /** Run `then` now if signed in; otherwise ask the student to sign in first, then run it. */
  requireAccount(reason: AccountReason, then: () => void): void
  syncStatus: SyncStatus
  /** Used by the cloud sync to report progress. */
  setSyncStatus(s: SyncStatus): void
  /** True when reading the saved session failed (for example offline), so "signed out" is only a guess. */
  restoreFailed: boolean
  /** The backend this provider talks to (for the cloud sync). */
  backend: Backend
}

interface Pending {
  reason: AccountReason
  then: () => void
}

const AccountContext = createContext<AccountApi | null>(null)

export function AccountProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [restoreFailed, setRestoreFailed] = useState(false)
  const [loadedProfile, setLoadedProfile] = useState<{ userId: string; profile: Profile } | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const signedIn = session !== null

  useEffect(() => {
    let live = true
    const off = backend.onAuthChange((s) => {
      if (!live) return
      setSession(s)
      setLoaded(true)
    })
    backend
      .getSession()
      .then(
        (s) => ({ s, failed: false }),
        () => ({ s: null, failed: true }),
      )
      .then(({ s, failed }) => {
        if (!live) return
        setRestoreFailed(failed)
        // An auth change that landed first is newer than this read.
        setSession((cur) => cur ?? s)
        setLoaded(true)
      })
    return () => {
      live = false
      off()
    }
  }, [backend])

  const userId = session?.userId ?? null
  useEffect(() => {
    if (!userId) return
    let live = true
    backend
      .loadProfile()
      .then((p) => live && setLoadedProfile({ userId, profile: p }))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [backend, userId])

  // Only the profile of the current user counts; a stale one is ignored.
  const profile = loadedProfile && loadedProfile.userId === userId ? loadedProfile.profile : null
  // The ref is the truth about which action is waiting; `pending` only drives rendering.
  const pendingRef = useRef<Pending | null>(null)
  const requireAccount = useCallback(
    (reason: AccountReason, then: () => void) => {
      if (signedIn) return then()
      if (pendingRef.current) return
      pendingRef.current = { reason, then }
      setPending(pendingRef.current)
    },
    [signedIn],
  )
  /** Finish one specific request; does nothing if it was dismissed meanwhile. */
  const finish = useCallback((p: Pending) => {
    if (pendingRef.current !== p) return
    pendingRef.current = null
    setPending(null)
    p.then()
  }, [])
  const dismiss = useCallback(() => {
    pendingRef.current = null
    setPending(null)
  }, [])

  const api = useMemo<AccountApi>(
    () => ({
      status: !loaded ? 'loading' : signedIn ? 'signed-in' : 'signed-out',
      session,
      profile,
      signIn: (email, password) => backend.signIn(email, password),
      signUp: (name, email, password) => backend.signUp(name, email, password),
      signOut: () => backend.signOut(),
      deleteAccount: () => backend.deleteAccount(),
      saveProfile: async (p) => {
        await backend.saveProfile(p)
        if (userId) setLoadedProfile({ userId, profile: p })
      },
      requireAccount,
      syncStatus,
      setSyncStatus,
      restoreFailed,
      backend,
    }),
    [backend, loaded, signedIn, session, profile, userId, requireAccount, syncStatus, restoreFailed],
  )

  return (
    <AccountContext.Provider value={api}>
      {children}
      {pending && <SignInSheet reason={pending.reason} onDone={() => finish(pending)} onClose={dismiss} />}
    </AccountContext.Provider>
  )
}

// eslint-disable-next-line react/only-export-components
export function useAccount(): AccountApi {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used inside AccountProvider')
  return ctx
}
