import type { Filters } from '../filters'
import type { Message } from '../messages'

export interface Session {
  userId: string
  email: string
}

export interface Profile {
  displayName: string
  phone: string | null
}

/** A profile change. `phone` left out (undefined) means "keep what is stored"; null clears it. */
export interface ProfileUpdate {
  displayName: string
  phone?: string | null
}

/** What an account keeps in the cloud. */
export interface CloudState {
  budget: number | null
  filters: Filters | null
  savedIds: string[]
  messages: Message[]
}

export type AuthError = 'invalid-credentials' | 'email-taken' | 'weak-password' | 'network' | 'unknown'
export type AuthResult = { ok: true; needsConfirmation: boolean } | { ok: false; error: AuthError }

export interface Backend {
  getSession(): Promise<Session | null>
  onAuthChange(cb: (s: Session | null) => void): () => void
  signUp(name: string, email: string, password: string): Promise<AuthResult>
  signIn(email: string, password: string): Promise<AuthResult>
  signOut(): Promise<void>
  deleteAccount(): Promise<void>
  loadProfile(): Promise<Profile>
  saveProfile(p: ProfileUpdate): Promise<void>
  loadState(): Promise<CloudState>
  saveState(s: CloudState): Promise<void>
}
