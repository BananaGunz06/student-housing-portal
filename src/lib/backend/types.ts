import type { Filters } from '../filters'
import type { Message } from '../messages'

export interface Session {
  userId: string
  email: string
}

export type StudyYear = '1' | '2' | '3' | '4' | '5+' | 'grad'
export type BudgetBand = 'any' | 'under600' | '600-800' | '800-1000' | 'over1000'

/** The part of a profile other students can see. */
export interface StudentDetails {
  bio: string
  program: string
  year: StudyYear | null
  /** Like "2027-fall". */
  moveInTerm: string | null
  budget: number | null
  lookingForRoommates: boolean
}

export interface Profile extends StudentDetails {
  displayName: string
  phone: string | null
  /** A signed link to the photo (it expires), or null when there is none. */
  avatarUrl: string | null
}

/** A profile change. Fields left out are kept as stored; `phone` null clears it. */
export type ProfileUpdate = { displayName: string; phone?: string | null } & Partial<StudentDetails>

/** What other students see: never an email or a phone. */
export interface StudentCard extends StudentDetails {
  id: string
  displayName: string
  avatarUrl: string | null
}

export interface StudentQuery {
  moveInTerm?: string
  band?: BudgetBand
  offset: number
  limit: number
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
  listStudents(q: StudentQuery): Promise<{ students: StudentCard[]; hasMore: boolean }>
  /** Null when the student is hidden, unknown or deleted. */
  getStudent(id: string): Promise<StudentCard | null>
  /** Stores the photo, saves its path, and returns a fresh signed link. */
  uploadAvatar(jpeg: Blob): Promise<string>
  /** No error when there is no photo. */
  removeAvatar(): Promise<void>
}
