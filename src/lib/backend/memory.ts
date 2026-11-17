import { shouldForwardAuthEvent } from './authEvents'
import { inBand } from './bands'
import type { AuthResult, Backend, CloudState, Profile, Session, StudentCard, StudentDetails } from './types'

interface FakeUser {
  id: string
  email: string
  password: string
  profile: Profile
  state: CloudState
  avatarVersion: number
  /** A link to the photo this user has now: a seeded one, or the last upload. */
  avatarUrl: string | null
  /** Counts up on every profile save, so "newest first" is deterministic. */
  updatedAt: number
}

export interface FakeOptions {
  users?: { email: string; password: string; name: string; state?: Partial<CloudState> }[]
  /** Extra users who show up in the students list (password "password1"). */
  students?: (Partial<StudentDetails> & { email: string; name: string; /** Force the "last saved" clock value, to make ties. */ updatedAt?: number; /** Shown until the student uploads a photo. */ avatarUrl?: string })[]
  offline?: boolean
  /** Start signed in as this user (must exist in `users`). */
  sessionEmail?: string
  /**
   * Like supabase-js, announce an INITIAL_SESSION event (null when the stored session can't be
   * read, for example offline) right after someone subscribes, before getSession() settles.
   */
  emitInitialNull?: boolean
}

export interface MemoryOptions extends FakeOptions {
  /** Wait this long before every backend call resolves (demo: 300). Default 0. */
  delayMs?: number
  /** Turn a stored photo into a link. Default: the https://avatars.example.com/... link tests rely on. */
  photoUrl?: (photo: Blob, userId: string, version: number) => string
}

const emptyState = (): CloudState => ({ budget: null, filters: null, savedIds: [], messages: [] })
const emptyDetails = (): StudentDetails => ({ bio: '', program: '', year: null, moveInTerm: null, budget: null, lookingForRoommates: false })
const newProfile = (displayName: string): Profile => ({ displayName, phone: null, ...emptyDetails(), avatarUrl: null })
const key = (email: string) => email.trim().toLowerCase()

export type MemoryBackend = Backend & {
  setOffline(v: boolean): void
  stateOf(email: string): CloudState
  avatarOf(email: string): Blob | null
  /** The generated id of a user (so tests don't hard-code `user-N`). */
  idOf(email: string): string
}

/** In-memory Backend, for tests and demo mode. */
export function createMemoryBackend(opts: MemoryOptions = {}): MemoryBackend {
  const users = new Map<string, FakeUser>()
  let n = 0
  let clock = 0
  // Stored photos by user id, kept apart from the user records so a deleted account's photo can be checked.
  const photos = new Map<string, Blob>()
  const idByEmail = new Map<string, string>()
  const photoUrl =
    opts.photoUrl ?? ((_photo: Blob, id: string, version: number) => `https://avatars.example.com/${id}/avatar.jpg?v=${version}`)
  const addUser = (email: string, password: string, profile: Profile, state: CloudState): FakeUser => {
    const u: FakeUser = { id: `user-${++n}`, email: email.trim(), password, profile, state, avatarVersion: 0, avatarUrl: null, updatedAt: ++clock }
    users.set(key(email), u)
    idByEmail.set(key(email), u.id)
    return u
  }
  for (const u of opts.users ?? []) addUser(u.email, u.password, newProfile(u.name), structuredClone({ ...emptyState(), ...u.state }))
  for (const { email, name, updatedAt, avatarUrl, ...details } of opts.students ?? []) {
    const u = addUser(email, 'password1', { ...newProfile(name), ...details }, emptyState())
    if (updatedAt !== undefined) u.updatedAt = updatedAt
    u.avatarUrl = avatarUrl ?? null
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
    return { ...rest, id: u.id, avatarUrl: u.avatarUrl }
  }
  const visible = (u: FakeUser) => u.profile.lookingForRoommates && u.profile.displayName !== ''
  const setCurrent = (u: FakeUser | null) => {
    current = u
    emit()
  }

  const backend: MemoryBackend = {
    setOffline(v) {
      offline = v
    },
    stateOf(email) {
      const u = users.get(key(email))
      if (!u) throw new Error('no such user')
      return structuredClone(u.state)
    },
    avatarOf(email) {
      const id = idByEmail.get(key(email))
      return (id && photos.get(id)) || null
    },
    idOf(email) {
      const id = idByEmail.get(key(email))
      if (!id) throw new Error('no such user')
      return id
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
      photos.delete(u.id)
      users.delete(key(u.email))
      setCurrent(null)
    },
    async loadProfile() {
      const u = await signedIn()
      return { ...structuredClone(u.profile), avatarUrl: u.avatarUrl }
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
        .sort((a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
      const cut = q.after ? q.after.indexOf('|') : -1
      const atText = cut < 0 ? '' : q.after!.slice(0, cut)
      const at = atText === '' ? NaN : Number(atText)
      const afterId = cut < 0 ? '' : q.after!.slice(cut + 1)
      const rest = Number.isNaN(at) || afterId === '' ? all : all.filter((u) => u.updatedAt < at || (u.updatedAt === at && u.id < afterId))
      const page = rest.slice(0, q.limit)
      const last = page[page.length - 1]
      return { students: page.map(cardOf), nextCursor: rest.length > q.limit && last ? `${last.updatedAt}|${last.id}` : null }
    },
    async getStudent(id) {
      await signedIn()
      const u = [...users.values()].find((x) => x.id === id)
      return u && visible(u) ? cardOf(u) : null
    },
    async uploadAvatar(jpeg) {
      const u = await signedIn()
      photos.set(u.id, jpeg)
      u.avatarVersion = ++clock
      const link = photoUrl(jpeg, u.id, u.avatarVersion)
      u.avatarUrl = link
      u.updatedAt = clock // the database stamps updated_at on every profile row change
      return link
    },
    async removeAvatar() {
      const u = await signedIn()
      photos.delete(u.id)
      u.avatarUrl = null
      u.updatedAt = ++clock
    },
  }
  const { delayMs = 0 } = opts
  if (delayMs <= 0) return backend
  // Wait before every call, so loading states stay visible.
  const slow = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
    async (...a: A): Promise<R> => {
      await new Promise((r) => setTimeout(r, delayMs))
      return fn(...a)
    }
  return {
    ...backend,
    getSession: slow(backend.getSession),
    signUp: slow(backend.signUp),
    signIn: slow(backend.signIn),
    signOut: slow(backend.signOut),
    deleteAccount: slow(backend.deleteAccount),
    loadProfile: slow(backend.loadProfile),
    saveProfile: slow(backend.saveProfile),
    loadState: slow(backend.loadState),
    saveState: slow(backend.saveState),
    listStudents: slow(backend.listStudents),
    getStudent: slow(backend.getStudent),
    uploadAvatar: slow(backend.uploadAvatar),
    removeAvatar: slow(backend.removeAvatar),
  }
}
