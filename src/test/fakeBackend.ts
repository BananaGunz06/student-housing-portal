import type { AuthResult, Backend, CloudState, Profile, Session } from '../lib/backend/types'

interface FakeUser {
  id: string
  email: string
  password: string
  profile: Profile
  state: CloudState
}

export interface FakeOptions {
  users?: { email: string; password: string; name: string; state?: Partial<CloudState> }[]
  offline?: boolean
  /** Start signed in as this user (must exist in `users`). */
  sessionEmail?: string
}

const emptyState = (): CloudState => ({ budget: null, filters: null, savedIds: [], messages: [] })
const key = (email: string) => email.trim().toLowerCase()

/** In-memory Backend for tests. */
export function createFakeBackend(opts: FakeOptions = {}): Backend & { setOffline(v: boolean): void; stateOf(email: string): CloudState } {
  const users = new Map<string, FakeUser>()
  let n = 0
  for (const u of opts.users ?? []) {
    users.set(key(u.email), {
      id: `user-${++n}`,
      email: u.email,
      password: u.password,
      profile: { displayName: u.name, phone: null },
      state: structuredClone({ ...emptyState(), ...u.state }),
    })
  }
  let offline = opts.offline ?? false
  let current: FakeUser | null = opts.sessionEmail ? (users.get(key(opts.sessionEmail)) ?? null) : null
  const listeners = new Set<(s: Session | null) => void>()

  const sessionOf = (u: FakeUser | null): Session | null => (u ? { userId: u.id, email: u.email } : null)
  const emit = () => listeners.forEach((cb) => cb(sessionOf(current)))
  const guard = async () => {
    if (offline) throw new Error('network')
  }
  const signedIn = async (): Promise<FakeUser> => {
    await guard()
    if (!current) throw new Error('not signed in')
    return current
  }
  const setCurrent = (u: FakeUser | null) => {
    current = u
    emit()
  }

  return {
    setOffline(v) {
      offline = v
    },
    stateOf(email) {
      const u = users.get(key(email))
      if (!u) throw new Error('no such user')
      return structuredClone(u.state)
    },
    async getSession() {
      await guard()
      return sessionOf(current)
    },
    onAuthChange(cb) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    async signUp(name, email, password): Promise<AuthResult> {
      if (offline) return { ok: false, error: 'network' }
      if (users.has(key(email))) return { ok: false, error: 'email-taken' }
      if (password.length < 8) return { ok: false, error: 'weak-password' }
      const u: FakeUser = {
        id: `user-${++n}`,
        email: email.trim(),
        password,
        profile: { displayName: name, phone: null },
        state: emptyState(),
      }
      users.set(key(email), u)
      setCurrent(u)
      return { ok: true, needsConfirmation: false }
    },
    async signIn(email, password): Promise<AuthResult> {
      if (offline) return { ok: false, error: 'network' }
      const u = users.get(key(email))
      if (!u || u.password !== password) return { ok: false, error: 'invalid-credentials' }
      setCurrent(u)
      return { ok: true, needsConfirmation: false }
    },
    async signOut() {
      await guard()
      setCurrent(null)
    },
    async deleteAccount() {
      const u = await signedIn()
      users.delete(key(u.email))
      setCurrent(null)
    },
    async loadProfile() {
      return structuredClone((await signedIn()).profile)
    },
    async saveProfile(p) {
      ;(await signedIn()).profile = structuredClone(p)
    },
    async loadState() {
      return structuredClone((await signedIn()).state)
    },
    async saveState(s) {
      ;(await signedIn()).state = structuredClone(s)
    },
  }
}
