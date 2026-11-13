import { createClient, type Session as SbSession } from '@supabase/supabase-js'
import { cleanCloudState } from '../sync'
import { shouldForwardAuthEvent } from './authEvents'
import { bandBounds } from './bands'
import type { AuthError, AuthResult, Backend, CloudState, Profile, ProfileUpdate, Session, StudentCard, StudyYear } from './types'

const AVATARS = 'avatars'
const SIGNED_URL_SECONDS = 3600
const PROFILE_COLUMNS = 'id, display_name, bio, program, year, move_in_term, budget, looking_for_roommates, avatar_path'

interface ErrLike {
  message?: unknown
  code?: unknown
  name?: unknown
}

/** Turn whatever Supabase reports into one of our sign-in/sign-up error kinds. */
export function mapAuthError(err: unknown): AuthError {
  const e: ErrLike = err && typeof err === 'object' ? err : {}
  const msg = typeof e.message === 'string' ? e.message : ''
  const code = typeof e.code === 'string' ? e.code : ''
  const name = typeof e.name === 'string' ? e.name : ''
  if (name === 'AuthRetryableFetchError' || /failed to fetch|fetch failed|networkerror|load failed/i.test(msg)) return 'network'
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'invalid-credentials'
  if (code === 'user_already_exists' || /already registered/i.test(msg)) return 'email-taken'
  if (code === 'weak_password' || /password should be/i.test(msg)) return 'weak-password'
  return 'unknown'
}

export interface StateRow {
  budget: number | null
  filters: unknown
  saved_ids: unknown
  messages: unknown
}

export function rowToCloudState(row: StateRow | null | undefined): CloudState {
  if (!row) return cleanCloudState(null)
  return cleanCloudState({ budget: row.budget, filters: row.filters, savedIds: row.saved_ids, messages: row.messages })
}

export function cloudStateToRow(userId: string, s: CloudState) {
  return {
    user_id: userId,
    budget: s.budget,
    filters: s.filters,
    saved_ids: s.savedIds,
    messages: s.messages,
    updated_at: new Date().toISOString(),
  }
}

/** The `profiles` columns a profile change sets (the database stamps `updated_at`). Fields left out are left alone; the phone lives in `profile_private`. */
export function profileUpdateRow(p: ProfileUpdate) {
  return {
    display_name: p.displayName,
    ...(p.bio === undefined ? {} : { bio: p.bio }),
    ...(p.program === undefined ? {} : { program: p.program }),
    ...(p.year === undefined ? {} : { year: p.year }),
    ...(p.moveInTerm === undefined ? {} : { move_in_term: p.moveInTerm }),
    ...(p.budget === undefined ? {} : { budget: p.budget }),
    ...(p.lookingForRoommates === undefined ? {} : { looking_for_roommates: p.lookingForRoommates }),
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Postgres rejects ids that aren't UUIDs, so check before asking. */
export function isUuid(id: string): boolean {
  return UUID.test(id)
}

export interface ProfileRow {
  id: string
  display_name: string | null
  bio: string | null
  program: string | null
  year: string | null
  move_in_term: string | null
  budget: number | null
  looking_for_roommates: boolean | null
  avatar_path: string | null
}

export function rowToStudentCard(row: ProfileRow, avatarUrl: string | null): StudentCard {
  return {
    id: row.id,
    displayName: row.display_name ?? '',
    bio: row.bio ?? '',
    program: row.program ?? '',
    year: (row.year as StudyYear | null) ?? null,
    moveInTerm: row.move_in_term ?? null,
    budget: row.budget ?? null,
    lookingForRoommates: row.looking_for_roommates ?? false,
    avatarUrl,
  }
}

const EMPTY_ROW: ProfileRow = {
  id: '',
  display_name: '',
  bio: '',
  program: '',
  year: null,
  move_in_term: null,
  budget: null,
  looking_for_roommates: false,
  avatar_path: null,
}

const toSession = (s: SbSession | null): Session | null => (s ? { userId: s.user.id, email: s.user.email ?? '' } : null)

/** Failures of data calls: 'network' for connectivity problems, otherwise the server's message. */
export function dataError(err: unknown): Error {
  if (mapAuthError(err) === 'network') return new Error('network')
  const msg = err && typeof err === 'object' && 'message' in err ? String((err as ErrLike).message) : ''
  return new Error(msg || 'unknown')
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const sb = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  })

  const userId = async (): Promise<string> => {
    const { data, error } = await sb.auth.getSession()
    if (error) throw dataError(error)
    if (!data.session) throw new Error('not signed in')
    return data.session.user.id
  }

  /** A signed link for a stored photo; null when there is no photo or the link can't be made. */
  const signedUrl = async (path: string | null): Promise<string | null> => (await signedUrls([path]))[0]
  const signedUrls = async (paths: (string | null)[]): Promise<(string | null)[]> => {
    const real = [...new Set(paths.filter((p): p is string => !!p))]
    if (real.length === 0) return paths.map(() => null)
    try {
      const { data, error } = await sb.storage.from(AVATARS).createSignedUrls(real, SIGNED_URL_SECONDS)
      if (error || !data) return paths.map(() => null)
      const byPath = new Map(data.map((d) => [d.path, d.error ? null : d.signedUrl]))
      return paths.map((p) => (p ? (byPath.get(p) ?? null) : null))
    } catch {
      return paths.map(() => null)
    }
  }

  /** Delete the photo file and forget its path. Fine when there is none. */
  const removePhoto = async (): Promise<void> => {
    const id = await userId()
    const rm = await sb.storage.from(AVATARS).remove([`${id}/avatar.jpg`])
    if (rm.error) throw dataError(rm.error)
    const { error } = await sb.from('profiles').update({ avatar_path: null }).eq('id', id)
    if (error) throw dataError(error)
  }

  const result = (error: unknown, hasSession: boolean): AuthResult =>
    error ? { ok: false, error: mapAuthError(error) } : { ok: true, needsConfirmation: !hasSession }

  return {
    async getSession() {
      const { data, error } = await sb.auth.getSession()
      if (error) throw dataError(error)
      return toSession(data.session)
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        if (shouldForwardAuthEvent(event)) cb(toSession(session))
      })
      return () => data.subscription.unsubscribe()
    },
    async signUp(name, email, password) {
      try {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: name } } })
        return result(error, !!data?.session)
      } catch (e) {
        return { ok: false, error: mapAuthError(e) }
      }
    },
    async signIn(email, password) {
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password })
        return result(error, !!data?.session)
      } catch (e) {
        return { ok: false, error: mapAuthError(e) }
      }
    },
    async signOut() {
      const { error } = await sb.auth.signOut({ scope: 'local' })
      if (error) throw dataError(error)
    },
    async deleteAccount() {
      // The photo lives in storage, outside the account's rows: remove it first, and carry on if that fails.
      try {
        await removePhoto()
      } catch {
        /* the account still gets deleted */
      }
      const { error } = await sb.rpc('delete_my_account')
      if (error) throw dataError(error)
      // The server session is gone with the account; only clear it locally.
      await sb.auth.signOut({ scope: 'local' })
    },
    async loadProfile(): Promise<Profile> {
      const id = await userId()
      const [own, priv] = await Promise.all([
        sb.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle(),
        sb.from('profile_private').select('phone').eq('id', id).maybeSingle(),
      ])
      if (own.error) throw dataError(own.error)
      if (priv.error) throw dataError(priv.error)
      const phone = priv.data?.phone ?? null
      if (!own.data) return { ...rowToStudentCard({ ...EMPTY_ROW, id }, null), phone }
      const avatarUrl = await signedUrl(own.data.avatar_path)
      const { id: _id, ...card } = rowToStudentCard(own.data, avatarUrl)
      return { ...card, phone }
    },
    async saveProfile(p: ProfileUpdate) {
      const id = await userId()
      const { error } = await sb.from('profiles').update(profileUpdateRow(p)).eq('id', id)
      if (error) throw dataError(error)
      if (p.phone !== undefined) {
        const { error: phoneError } = await sb.from('profile_private').upsert({ id, phone: p.phone }, { onConflict: 'id' })
        if (phoneError) throw dataError(phoneError)
      }
    },
    async loadState() {
      const id = await userId()
      const { data, error } = await sb
        .from('user_state')
        .select('budget, filters, saved_ids, messages')
        .eq('user_id', id)
        .maybeSingle()
      if (error) throw dataError(error)
      return rowToCloudState(data)
    },
    async saveState(s) {
      const id = await userId()
      const { error } = await sb.from('user_state').upsert(cloudStateToRow(id, s), { onConflict: 'user_id' })
      if (error) throw dataError(error)
    },
     async listStudents(q) {
      const me = await userId()
      let query = sb
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('looking_for_roommates', true)
        .neq('display_name', '')
        .neq('id', me)
      if (q.moveInTerm) query = query.eq('move_in_term', q.moveInTerm)
      const { over, upTo } = bandBounds(q.band ?? 'any')
      if (over !== undefined) query = query.gt('budget', over)
      if (upTo !== undefined) query = query.lte('budget', upTo)
      // One extra row tells us whether another page exists.
      const { data, error } = await query.order('updated_at', { ascending: false }).range(q.offset, q.offset + q.limit)
      if (error) throw dataError(error)
      const rows = data ?? []
      const urls = await signedUrls(rows.map((r) => r.avatar_path))
      return {
        students: rows.slice(0, q.limit).map((r, i) => rowToStudentCard(r, urls[i])),
        hasMore: rows.length > q.limit,
      }
    },
    async getStudent(id) {
      await userId()
      if (!isUuid(id)) return null
      const { data, error } = await sb
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', id)
        .eq('looking_for_roommates', true)
        .neq('display_name', '')
        .maybeSingle()
      if (error) throw dataError(error)
      return data ? rowToStudentCard(data, await signedUrl(data.avatar_path)) : null
    },
    async uploadAvatar(jpeg) {
      const id = await userId()
      const path = `${id}/avatar.jpg`
      const up = await sb.storage.from(AVATARS).upload(path, jpeg, { upsert: true, contentType: 'image/jpeg' })
      if (up.error) throw dataError(up.error)
      const { error } = await sb.from('profiles').update({ avatar_path: path }).eq('id', id)
      if (error) throw dataError(error)
      const signed = await sb.storage.from(AVATARS).createSignedUrl(path, SIGNED_URL_SECONDS)
      if (signed.error) throw dataError(signed.error)
      return signed.data.signedUrl
    },
    async removeAvatar() {
      await removePhoto()
    },
  }
}
