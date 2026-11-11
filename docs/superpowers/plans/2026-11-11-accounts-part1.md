# Accounts and sync (part 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visitors browse without an account; signed-in users get their budget, filters, saved places and (demo) messages on any device, backed by Supabase.

**Architecture:** One `Backend` interface (`src/lib/backend/`) is the only code that talks to Supabase; tests use an in-memory fake of it. `AccountState` (React context) owns the session, profile, sign-in sheet and sync; `AppState` keeps its API and keeps the device copy in localStorage, while a sync hook loads, merges and saves the account copy.

**Tech Stack:** React 19, TypeScript, Vite, `@supabase/supabase-js` 2.x, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-11-accounts-design.md` (Part 1). SQL already applied: `supabase/migrations/0001_accounts.sql`.

## Global Constraints

- Supabase URL `https://tcuvvemijjsqbphqphqn.supabase.co`; publishable key `sb_publishable_AhyoAsHwI4UGs43DrI3q2w_sTHE_5ZZ`, committed in `.env` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`. Never a secret / service_role key.
- Only `src/lib/backend/` imports `@supabase/supabase-js`.
- Browse, search, filter and open listings without an account. Save and Message require sign-in; the action that triggered sign-in completes afterwards.
- Password at least 8 characters; name required (≤ 80 characters).
- Sign out clears saved places and messages from the device; budget and filters stay.
- Sign in merges: account budget/filters win unless the account has no budget, then the device's are copied up; saved ids and messages are unioned (messages by `id`).
- Tests never touch the network.
- Copy (exact): sheet title "Sign in"; reasons "Sign in to save places and see them on any device." and "Sign in to message posters and keep your conversations on any device."; sync status "Saved to your account" / "Saving…" / "Not synced yet. We’ll try again."

## Review Focus

- Network down while saving → device copy kept, status "Not synced yet…", retried on the next change and on reconnect (`online` event).
- Junk in the account row (bad filters JSON, non-message items, unknown listing ids) → ignored using the existing guards, never a crash.
- Signed out in another tab or session expired → `onAuthChange(null)` signs this tab out and clears saved/messages.
- Double-tapping Create account / Sign in → button disabled while pending; one request.
- Signing in as a different user on a device that holds another user's synced data → impossible because sign-out clears it; test that sign-out then sign-in as user B shows none of user A's saved places.

---

### Task 1: Backend interface, fake, and merge logic

**Files:**
- Create: `src/lib/backend/types.ts`, `src/test/fakeBackend.ts`, `src/lib/sync.ts`
- Test: `src/lib/sync.test.ts`

**Interfaces — Produces:**
```ts
// types.ts
export interface Session { userId: string; email: string }
export interface Profile { displayName: string; phone: string | null }
export interface CloudState { budget: number | null; filters: Filters | null; savedIds: string[]; messages: Message[] }
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
  saveProfile(p: Profile): Promise<void>
  loadState(): Promise<CloudState>
  saveState(s: CloudState): Promise<void>
}
// sync.ts
export const EMPTY_CLOUD: CloudState
export function cleanCloudState(raw: unknown): CloudState   // junk-tolerant; drops unknown listing ids and non-messages
export function mergeStates(device: CloudState, account: CloudState): CloudState
export function validateSignUp(name: string, email: string, password: string): Partial<Record<'name'|'email'|'password', string>>
// fakeBackend.ts
export function createFakeBackend(opts?: { users?: { email: string; password: string; name: string; state?: Partial<CloudState> }[]; offline?: boolean }): Backend & { setOffline(v: boolean): void; stateOf(email: string): CloudState }
```

- [ ] **Step 1: Write failing tests** `mergeStates`: empty account takes device budget+filters; account with budget keeps its own; saved ids unioned without duplicates; messages unioned by id. `cleanCloudState`: junk (null, string, `{filters: 5}`, unknown listing ids, bad messages) → safe defaults. `validateSignUp`: empty name → "Enter your name.", bad email → "Enter an email like name@example.com.", 7-char password → "Use at least 8 characters."
- [ ] **Step 2: Run `npx vitest run src/lib/sync.test.ts`** — expect FAIL (module missing).
- [ ] **Step 3: Implement** types, `sync.ts` (reuse `isMessage`, `getById`, `DEFAULT_FILTERS`), and the fake (in-memory users; `offline` makes every call reject with a network error; `signUp` with a taken email → `email-taken`).
- [ ] **Step 4: Run tests** — PASS; `npx tsc -b` clean.
- [ ] **Step 5: Commit** "Add backend interface, fake backend and account merge logic".

### Task 2: Supabase backend

**Files:**
- Create: `src/lib/backend/supabase.ts`, `src/lib/backend/index.ts`, `.env`
- Modify: `package.json` (add `@supabase/supabase-js`)

**Interfaces — Consumes:** `Backend`, `cleanCloudState`. **Produces:** `createSupabaseBackend(url: string, key: string): Backend`; `index.ts` exports `defaultBackend` built from `import.meta.env`.

- [ ] **Step 1:** `npm i @supabase/supabase-js`; add `.env` with the two `VITE_` values.
- [ ] **Step 2: Implement** with `auth.signUp({ email, password, options: { data: { display_name } } })` (`needsConfirmation` = no session returned), `signInWithPassword`, `signOut`, `rpc('delete_my_account')` then `signOut`, `profiles` select/update, `user_state` select/upsert mapping snake_case ↔ `CloudState`. Map errors: "Invalid login credentials" → `invalid-credentials`; "already registered" → `email-taken`; weak password → `weak-password`; fetch failure → `network`.
- [ ] **Step 3: Verify against the real project** with a scratch Node script (outside the repo): sign up a throwaway user, save and load state, delete the account. Expected: round-trip equal; after delete, sign-in fails with `invalid-credentials`.
- [ ] **Step 4:** `npm run build` passes. **Commit** "Add Supabase backend".

### Task 3: AccountState, sign-in sheet, and gated Save / Message

**Files:**
- Create: `src/state/AccountState.tsx`, `src/components/SignInSheet.tsx`
- Modify: `src/App.tsx` (providers; `App` uses `defaultBackend`), `src/test/renderApp.tsx` (`renderApp(url, { backend?, signedInAs? })`, default fake signed out), `src/components/SaveButton.tsx`, `src/pages/ListingDetail.tsx`, `src/pages/Saved.tsx` (unchanged behaviour when signed in)
- Test: `src/pages/Account.test.tsx` (sheet + gating flows)

**Interfaces — Produces:** `useAccount(): { status: 'loading'|'signed-out'|'signed-in'; session: Session|null; profile: Profile|null; signIn; signUp; signOut(): Promise<void>; deleteAccount(): Promise<void>; saveProfile(p: Profile): Promise<void>; requireAccount(reason: 'save'|'message', then: () => void): void; syncStatus: 'idle'|'saving'|'saved'|'error' }`. `AccountProvider({ backend, children })` wraps `AppStateProvider`.

- [ ] **Step 1: Failing flow tests:** signed out, tap Save → dialog "Sign in" with the save reason; Create account (name, email, password) → dialog closes and the place shows Saved; Message signed out → sheet with the message reason, then the message form opens after sign-in; wrong password → "That email and password don’t match."; taken email → "There’s already an account with that email. Sign in instead."; pending submit disables the button; Escape closes and returns focus.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the provider (session from `getSession` + `onAuthChange`), the sheet (tabs Sign in / Create account, uses `useModal`, `validateSignUp`), and wire `requireAccount` into SaveButton and both Message buttons.
- [ ] **Step 4: Update existing tests** that save or message to render signed in (`signedInAs`). All tests PASS.
- [ ] **Step 5: Commit** "Add accounts: sign in, create account, and sign-in for Save and Message".

### Task 4: Sync budget, filters, saved places and messages

**Files:**
- Create: `src/state/useCloudSync.ts`
- Modify: `src/state/AppState.tsx` (expose `replaceAll(s: CloudState)` and `clearPersonal()`; keep current API)
- Test: `src/state/sync.test.tsx`

**Interfaces — Consumes:** `useAccount`, `Backend.loadState/saveState`, `mergeStates`. **Produces:** sync behaviour only.

- [ ] **Step 1: Failing tests:** budget set signed out moves into a new account (`fake.stateOf(email).budget`); user with saved places on the account signs in on a fresh device → places appear in Saved; saving a place while signed in reaches the account after the debounce (use fake timers, 800 ms); offline save → status "Not synced yet. We’ll try again." then going online retries and shows "Saved to your account"; sign out clears Saved and Messages but keeps the budget; sign out then sign in as user B shows none of A's places; account row with junk loads without crashing.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** on `signed-in`: `loadState` → `cleanCloudState` → `mergeStates(device, account)` → `replaceAll` → `saveState` if the merge changed the account. Afterwards, debounce 800 ms on any change → `saveState`; on error set `error` and retry on next change or `window` `online`. On `signed-out` after being signed in: `clearPersonal()`.
- [ ] **Step 4: Run all tests** — PASS. **Commit** "Sync budget, filters, saved places and messages with the account".

### Task 5: Account page, nav, docs, real-browser check, PR

**Files:**
- Create: `src/pages/Account.tsx`
- Modify: `src/App.tsx` (route `/account`), `src/components/BottomNav.tsx` (5th item "Account"), `README.md`
- Test: extend `src/pages/Account.test.tsx`

- [ ] **Step 1: Failing tests:** `/account` signed out shows Sign in / Create account; signed in shows name, editable phone (Save → "Saved"), sync status, Log out; Delete account asks "Delete your account? This removes your saved places, messages and sign-in. It can’t be undone." and on confirm signs out and the fake no longer has the user; with no earlier shared details, the message form prefills name and phone from the profile.
- [ ] **Step 2: Implement**, run all tests, `npm run lint`, `npm run build`.
- [ ] **Step 3: Real-browser check** (Playwright, production build, 375 and 1280 px) against the real project with a throwaway account: browser A sets budget, saves 2 places, sends a message; a fresh browser B signs in and sees all of it; delete the account; no console errors or horizontal scroll.
- [ ] **Step 4:** README (Accounts section, setup steps, data note). Commit, push, and update/open the PR.
