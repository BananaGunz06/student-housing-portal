import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import SignInSheet from '../components/SignInSheet'
import type { AuthResult, Backend, Profile, ProfileUpdate, Session } from '../lib/backend/types'

export type AccountReason = 'save' | 'message'
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface AccountApi {
  status: 'loading' | 'signed-out' | 'signed-in'
  session: Session | null
  profile: Profile | null
  /** Whether `profile` has been read: still loading, failed (see `reloadProfile`), or ready. */
  profileStatus: 'loading' | 'error' | 'ready'
  /** Read the profile again after a failed load. */
  reloadProfile(): void
  signIn(email: string, password: string): Promise<AuthResult>
  signUp(name: string, email: string, password: string): Promise<AuthResult>
  signOut(): Promise<void>
  deleteAccount(): Promise<void>
  saveProfile(p: ProfileUpdate): Promise<void>
  /** Store a new photo (already a square JPEG); `profile.avatarUrl` follows. */
  uploadAvatar(jpeg: Blob): Promise<void>
  /** Remove the photo; `profile.avatarUrl` becomes null. */
  removeAvatar(): Promise<void>
  /** Run `then` now if signed in; otherwise ask the student to sign in first, then run it. */
  requireAccount(reason: AccountReason, then: () => void): void
  /** Open the profile setup page once the new account's session is present. `returnTo` is where Save/Skip go afterwards. */
  requestProfileSetup(returnTo?: string): void
  syncStatus: SyncStatus
  /** Used by the cloud sync to report progress. */
  setSyncStatus(s: SyncStatus): void
  /** Used by the cloud sync so the app can save anything outstanding (before logging out). */
  registerFlush(fn: (() => Promise<'saved' | 'failed'>) | null): void
  /** Save anything outstanding now and wait; 'failed' means the account doesn't hold everything yet. */
  flushSync(): Promise<'saved' | 'failed'>
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
  /** The user whose profile read failed, if any. */
  const [failedProfileFor, setFailedProfileFor] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const setupRef = useRef<{ returnTo?: string; at: number } | null>(null)
  const signedInRef = useRef(false)
  const navigate = useNavigate()
  const location = useLocation()
  const here = location.pathname + location.search
  const hereRef = useRef(here)
  useEffect(() => {
    hereRef.current = here
  }, [here])
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const signedIn = session !== null
  const flushRef = useRef<(() => Promise<'saved' | 'failed'>) | null>(null)
  const registerFlush = useCallback((fn: (() => Promise<'saved' | 'failed'>) | null) => {
    flushRef.current = fn
  }, [])
  const flushSync = useCallback(async () => (flushRef.current ? flushRef.current() : 'saved'), [])

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
  /** Bumped when a save starts, so a profile read that began earlier can't overwrite it. */
  const profileGen = useRef(0)
  const readProfile = useCallback(
    (uid: string, isLive: () => boolean) => {
      const gen = profileGen.current
      backend
        .loadProfile()
        .then((p) => {
          if (isLive() && gen === profileGen.current) {
            setLoadedProfile({ userId: uid, profile: p })
            setFailedProfileFor(null)
          }
        })
        .catch(() => {
          if (isLive() && gen === profileGen.current) setFailedProfileFor(uid)
        })
    },
    [backend],
  )
  useEffect(() => {
    if (!userId) return
    let live = true
    readProfile(userId, () => live)
    return () => {
      live = false
    }
  }, [userId, readProfile])

  // Only the profile of the current user counts; a stale one is ignored.
  const profile = loadedProfile && loadedProfile.userId === userId ? loadedProfile.profile : null
  const profileStatus = profile ? 'ready' : failedProfileFor !== null && failedProfileFor === userId ? 'error' : 'loading'
  const reloadProfile = useCallback(() => {
    if (!userId) return
    setFailedProfileFor(null)
    readProfile(userId, () => true)
  }, [userId, readProfile])
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
  const openSetup = useCallback(
    (returnTo?: string) =>
      // Opened from the sign-in sheet on a page: replace that entry, so Back doesn't pass through setup twice.
      navigate('/profile/setup', { state: returnTo ? { returnTo } : undefined, replace: returnTo !== undefined && returnTo === hereRef.current }),
    [navigate],
  )
  // The session reaches this provider a moment after sign-up resolves, so a request made before then
  // waits for it (the setup page sends signed-out students to Account). One that never gets a session expires.
  const requestProfileSetup = useCallback(
    (returnTo?: string) => {
      if (signedInRef.current) openSetup(returnTo)
      else setupRef.current = { returnTo, at: Date.now() }
    },
    [openSetup],
  )
  useEffect(() => {
    signedInRef.current = signedIn
    const req = setupRef.current
    if (!signedIn || !req) return
    setupRef.current = null
    if (Date.now() - req.at < 10_000) openSetup(req.returnTo)
  }, [signedIn, openSetup])
  /** Finish one specific request; does nothing if it was dismissed meanwhile. A new account then gets profile setup. */
  const finish = useCallback(
    (p: Pending, created: boolean) => {
      if (pendingRef.current !== p) return
      pendingRef.current = null
      setPending(null)
      if (created) {
        // A new account lands on setup; a waiting Message is dropped, a waiting Save still runs.
        requestProfileSetup(hereRef.current)
        if (p.reason === 'save') p.then()
        return
      }
      p.then()
    },
    [requestProfileSetup],
  )
  const dismiss = useCallback(() => {
    pendingRef.current = null
    setPending(null)
  }, [])

  const api = useMemo<AccountApi>(
    () => ({
      status: !loaded ? 'loading' : signedIn ? 'signed-in' : 'signed-out',
      session,
      profile,
      profileStatus,
      reloadProfile,
      signIn: (email, password) => backend.signIn(email, password),
      signUp: (name, email, password) => backend.signUp(name, email, password),
      signOut: () => backend.signOut(),
      deleteAccount: () => backend.deleteAccount(),
      saveProfile: async (p) => {
        profileGen.current++
        await backend.saveProfile(p)
        if (!userId) return
        if (p.phone === undefined || !profile) {
          // Either the stored phone was kept and we don't know it, or the profile never loaded
          // and we don't know what else the server holds: read it again.
          readProfile(userId, () => true)
        } else {
          profileGen.current++
          // Supplied fields replace the current ones; everything else (photo, ...) stays.
          const supplied = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined))
          setLoadedProfile((prev) => (prev && prev.userId === userId ? { userId, profile: { ...prev.profile, ...supplied } } : prev))
        }
      },
      uploadAvatar: async (jpeg) => {
        profileGen.current++
        const url = await backend.uploadAvatar(jpeg)
        profileGen.current++
        if (userId) setLoadedProfile((prev) => (prev && prev.userId === userId ? { userId, profile: { ...prev.profile, avatarUrl: url } } : prev))
      },
      removeAvatar: async () => {
        profileGen.current++
        await backend.removeAvatar()
        profileGen.current++
        if (userId) setLoadedProfile((prev) => (prev && prev.userId === userId ? { userId, profile: { ...prev.profile, avatarUrl: null } } : prev))
      },
      requireAccount,
      requestProfileSetup,
      syncStatus,
      setSyncStatus,
      registerFlush,
      flushSync,
      restoreFailed,
      backend,
    }),
    [registerFlush, flushSync, readProfile, backend, loaded, signedIn, session, profile, profileStatus, reloadProfile, userId, requireAccount, requestProfileSetup, syncStatus, restoreFailed],
  )

  return (
    <AccountContext.Provider value={api}>
      {children}
      {pending && <SignInSheet reason={pending.reason} onDone={(created) => finish(pending, created)} onClose={dismiss} />}
    </AccountContext.Provider>
  )
}

// eslint-disable-next-line react/only-export-components
export function useAccount(): AccountApi {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used inside AccountProvider')
  return ctx
}
