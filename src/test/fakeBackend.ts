import { shouldForwardAuthEvent } from '../lib/backend/authEvents'
import { inBand } from '../lib/backend/bands'
import type { AuthResult, Backend, CloudState, Profile, Session, StudentCard, StudentDetails } from '../lib/backend/types'

interface FakeUser {
  id: string
  email: string
  password: string
  profile: Profile
  state: CloudState
  avatar: Blob | null
  avatarVersion: number
  /** Counts up on every profile save, so "newest first" is deterministic. */
  updatedAt: number
}

export interface FakeOptions {
  users?: { email: string; password: string; name: string; state?: Partial<CloudState> }[]
  /** Extra users who show up in the students list (password "password1"). */
  students?: (Partial<StudentDetails> & { email: string; name: string })[]
  offline?: boolean
  /** Start signed in as this user (must exist in `users`). */
  sessionEmail?: string
  /**
   * Like supabase-js, announce an INITIAL_SESSION event (null when the stored session can't be
   * read, for example offline) right after someone subscribes, before getSession() settles.
   */
  emitInitialNull?: boolean
}

const emptyState = (): CloudState => ({ budget: null, filters: null, savedIds: [], messages: [] })
const emptyDetails = (): StudentDetails => ({ bio: '', program: '', year: null, moveInTerm: null, budget: null, lookingForRoommates: false })
const newProfile = (displayName: string): Profile => ({ displayName, phone: null, ...emptyDetails(), avatarUrl: null })
const key = (email: string) => email.trim().toLowerCase()

/** In-memory Backend for tests. */
export function createFakeBackend(opts: FakeOptions = {}): Backend & {
  setOffline(v: boolean): void
  stateOf(email: string): CloudState
  avatarOf(email: string): Blob | null
} {
  const users = new Map<string, FakeUser>()
  let n = 0
  let clock = 0
  const avatarUrlOf = (u: FakeUser) => `https://avatars.example.com/${u.id}/avatar.jpg?v=${u.avatarVersion}`
  const addUser = (email: string, password: string, profile: Profile, state: CloudState): FakeUser => {
    const u: FakeUser = { id: `user-${++n}`, email: email.trim(), password, profile, state, avatar: null, avatarVersion: 0, updatedAt: ++clock }
    users.set(key(email), u)
    return u
  }
  for (const u of opts.users ?? []) addUser(u.email, u.password, newProfile(u.name), structuredClone({ ...emptyState(), ...u.state }))
  for (const { email, name, ...details } of opts.students ?? []) {
    addUser(email, 'password1', { ...newProfile(name), ...details }, emptyState())
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
  const cardOf = (u: FakeUser): StudentCard => {
    const { phone: _phone, avatarUrl: _avatarUrl, ...rest } = u.profile
    return { ...rest, id: u.id, avatarUrl: u.avatar ? avatarUrlOf(u) : null }
  }
  const visible = (u: FakeUser) => u.profile.lookingForRoommates && u.profile.displayName !== ''
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
    avatarOf(email) {
      return users.get(key(email))?.avatar ?? null
    },
    async getSession() {
      // A real session read takes a network round trip; the initial event lands well before it.
      if (opts.emitInitialNull) await new Promise((r) => setTimeout(r, 5))
      await guard()
      return sessionOf(current)
    },
    onAuthChange(cb) {
      listeners.add(cb)
      if (opts.emitInitialNull && shouldForwardAuthEvent('INITIAL_SESSION')) {
        queueMicrotask(() => {
          if (listeners.has(cb)) cb(null)
        })
      }
      return () => {
        listeners.delete(cb)
      }
    },
    async signUp(name, email, password): Promise<AuthResult> {
      if (offline) return { ok: false, error: 'network' }
      if (users.has(key(email))) return { ok: false, error: 'email-taken' }
      if (password.length < 8) return { ok: false, error: 'weak-password' }
      const u = addUser(email, password, newProfile(name), emptyState())
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
      // Like supabase-js with scope 'local': needs no network.
      setCurrent(null)
    },
    async deleteAccount() {
      const u = await signedIn()
      u.avatar = null
      users.delete(key(u.email))
      setCurrent(null)
    },
    async loadProfile() {
      const u = await signedIn()
      return { ...structuredClone(u.profile), avatarUrl: u.avatar ? avatarUrlOf(u) : null }
    },
    async saveProfile(p) {
      const u = await signedIn()
      // Fields that are left out (undefined) keep their stored value.
      const supplied = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined))
      u.profile = { ...u.profile, ...supplied }
      u.updatedAt = ++clock
    },
    async loadState() {
      return structuredClone((await signedIn()).state)
    },
    async saveState(s) {
      ;(await signedIn()).state = structuredClone(s)
    },
     async listStudents(q) {
      const me = await signedIn()
      const all = [...users.values()]
        .filter((u) => visible(u) && u.id !== me.id)
        .filter((u) => !q.moveInTerm || u.profile.moveInTerm === q.moveInTerm)
        .filter((u) => inBand(u.profile.budget, q.band ?? 'any'))
        .sort((a, b) => b.updatedAt - a.updatedAt)
      return { students: all.slice(q.offset, q.offset + q.limit).map(cardOf), hasMore: all.length > q.offset + q.limit }
    },
    async getStudent(id) {
      await signedIn()
      const u = [...users.values()].find((x) => x.id === id)
      return u && visible(u) ? cardOf(u) : null
    },
    async uploadAvatar(jpeg) {
      const u = await signedIn()
      u.avatar = jpeg
      u.avatarVersion = ++clock
      return avatarUrlOf(u)
    },
    async removeAvatar() {
      ;(await signedIn()).avatar = null
    },
  }
}
