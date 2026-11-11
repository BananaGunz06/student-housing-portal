import { createClient, type Session as SbSession } from '@supabase/supabase-js'
import { cleanCloudState } from '../sync'
import type { AuthError, AuthResult, Backend, CloudState, Profile, Session } from './types'

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

  const result = (error: unknown, hasSession: boolean): AuthResult =>
    error ? { ok: false, error: mapAuthError(error) } : { ok: true, needsConfirmation: !hasSession }

  return {
    async getSession() {
      const { data, error } = await sb.auth.getSession()
      if (error) throw dataError(error)
      return toSession(data.session)
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(toSession(session)))
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
      const { error } = await sb.rpc('delete_my_account')
      if (error) throw dataError(error)
      // The server session is gone with the account; only clear it locally.
      await sb.auth.signOut({ scope: 'local' })
    },
    async loadProfile() {
      const id = await userId()
      const { data, error } = await sb.from('profiles').select('display_name, phone').eq('id', id).maybeSingle()
      if (error) throw dataError(error)
      return data ? { displayName: data.display_name ?? '', phone: data.phone ?? null } : { displayName: '', phone: null }
    },
    async saveProfile(p: Profile) {
      const id = await userId()
      const { error } = await sb
        .from('profiles')
        .update({ display_name: p.displayName, phone: p.phone, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw dataError(error)
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
  }
}
