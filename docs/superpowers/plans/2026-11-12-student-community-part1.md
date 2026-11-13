# Student community part 1 (profiles and Students tab) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students can fill in an optional profile (photo, bio, program, year, move-in term, budget, roommates) at sign-up or later, open each other's profile pages, and browse a Students tab of roommate seekers.

**Architecture:** One SQL migration widens `profiles`, moves phone to an owner-only table and adds a private `avatars` bucket. The `Backend` interface gains profile, photo and student-list methods (Supabase adapter + fake). Pure rules live in `src/lib/profile.ts` and `src/lib/avatar.ts`; one shared `ProfileForm` serves the setup screen and Account.

**Tech Stack:** React 19, TypeScript, React Router 7, Tailwind 4, Supabase (Postgres RLS + Storage), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-12-student-community-design.md` (Part 1 only; no Message button, no chats, no block/report)

## Global Constraints

- Project rules in `CLAUDE.md` apply: tests first; `npm test`, `npm run lint`, `npm run build` pass before every commit; only `src/lib/backend/` talks to Supabase; only the publishable key in the repo; sample data fictional (`example.com`, 555-01xx).
- Limits: bio ≤ 300 characters; program ≤ 80; name ≤ 80 (existing); budget whole dollars 300–5000; photo input JPEG/PNG/WebP ≤ 5 MB, stored as 512 × 512 JPEG.
- Year values and labels: `1` "1st year", `2` "2nd year", `3` "3rd year", `4` "4th year", `5+` "5th year or later", `grad` "Graduate".
- Term value format `YYYY-winter|summer|fall`, label "Fall 2027". Winter = Jan–Apr, Summer = May–Aug, Fall = Sep–Dec.
- Budget bands: `any` "Any budget", `under600` "Up to $600" (≤ 600), `600-800` "$600–800" (601–800), `800-1000` "$800–1000" (801–1000), `over1000` "Over $1000" (> 1000). A student with no budget matches only `any`.
- Students list: only `lookingForRoommates` and a non-empty name; never the viewer; newest `updated_at` first; 30 per page.
- Copy (exact): "Set up your profile", "Save and continue", "Skip for now", "Your profile", "View my profile", "Looking for roommates", "This profile isn't available.", "No students are looking for roommates yet. Switch on 'Looking for roommates' in your profile to be the first.", "Couldn't save. Check your connection and try again.", "Add your name to appear in Students.", photo errors "Choose a JPEG, PNG or WebP image." / "That photo is over 5 MB. Choose a smaller one." / "We couldn't read that image. Try another one."
- Bottom bar: Places (`/results`), Students (`/students`), Saved, Messages, Account. No Map item.
- Email and phone never appear on a profile page or card. Phone is readable only by its owner.
- Mobile-first; every control ≥ 44 px tall; no horizontal scroll at 375 px.

## Review Focus

- A file named `.jpg` that isn't an image, or a 40-megapixel photo → "We couldn't read that image. Try another one." and nothing uploaded; never an unhandled rejection. (Task 2)
- "Looking for roommates" on with an empty name → saved, but the form shows "Add your name to appear in Students." and the student is not listed. (Tasks 1, 2)
- A saved move-in term that is now in the past → still shown on the profile and still selectable in the form. (Task 2)
- A photo link that has expired (tab left open over an hour) or fails to load → falls back to the initial circle, no broken image icon. (Task 2)
- `/profile/setup` opened while signed out, or `/students/:id` for the viewer's own id → redirect to `/account`; own profile renders normally with an "Edit profile" link. (Tasks 3, 4)

---

### Task 1: Database and backend (Sonnet)

**Files:**
- Create: `supabase/migrations/0002_profiles.sql`
- Modify: `src/lib/backend/types.ts`, `src/lib/backend/supabase.ts`, `src/lib/backend/supabase.test.ts`, `src/test/fakeBackend.ts`, `src/state/AccountState.tsx` (types only: `saveProfile` optimistic merge)
- Test: `src/test/fakeBackend.test.ts` (create), `src/lib/backend/supabase.test.ts`

**Interfaces (produces):**

```ts
export type StudyYear = '1' | '2' | '3' | '4' | '5+' | 'grad'
export type BudgetBand = 'any' | 'under600' | '600-800' | '800-1000' | 'over1000'
export interface StudentDetails {
  bio: string; program: string; year: StudyYear | null; moveInTerm: string | null
  budget: number | null; lookingForRoommates: boolean
}
export interface Profile extends StudentDetails { displayName: string; phone: string | null; avatarUrl: string | null }
/** Fields left out are kept as stored. */
export type ProfileUpdate = { displayName: string; phone?: string | null } & Partial<StudentDetails>
export interface StudentCard extends StudentDetails { id: string; displayName: string; avatarUrl: string | null }
export interface StudentQuery { moveInTerm?: string; band?: BudgetBand; offset: number; limit: number }
// added to Backend:
listStudents(q: StudentQuery): Promise<{ students: StudentCard[]; hasMore: boolean }>
getStudent(id: string): Promise<StudentCard | null>   // null when hidden, unknown or deleted
uploadAvatar(jpeg: Blob): Promise<string>             // stores <uid>/avatar.jpg, saves avatar_path, returns a fresh signed URL
removeAvatar(): Promise<void>                         // no error when there is no photo
```

`createFakeBackend` options gain `students?: (Partial<StudentDetails> & { email: string; name: string })[]` (added as extra users) and returns `avatarOf(email): Blob | null`.

**SQL (`0002_profiles.sql`, safe to run twice):**
- `profiles` add: `bio text not null default ''` (≤ 300), `program text not null default ''` (≤ 80), `year text` (in the six values), `move_in_term text` (`~ '^\d{4}-(winter|summer|fall)$'`), `budget integer` (300–5000), `looking_for_roommates boolean not null default false`, `avatar_path text`.
- `profile_private (id uuid pk → auth.users on delete cascade, phone text ≤ 30)`; RLS owner-only select/insert/update; copy existing phones (only if the `phone` column still exists); `alter table profiles drop column if exists phone`; `handle_new_user` also inserts the `profile_private` row.
- Replace the `profiles` read policy: `to authenticated using ((select auth.uid()) = id or looking_for_roommates)`.
- Partial index on `profiles (updated_at desc) where looking_for_roommates`.
- Bucket `avatars`: private, `file_size_limit` 1048576, `allowed_mime_types` `{image/jpeg}`. `storage.objects` policies: authenticated may select in `avatars`; insert/update/delete only when `(storage.foldername(name))[1] = (select auth.uid())::text`.

**Adapter notes:** signed URLs last 3600 s; `listStudents` requests `limit + 1` rows to compute `hasMore`, filters `looking_for_roommates`, `display_name <> ''`, `id <> me`, term and band, ordered `updated_at desc`; `saveProfile` writes phone to `profile_private` and sets `updated_at = now()`; `deleteAccount` calls `removeAvatar` (ignoring failure) before the RPC.

- [ ] **Step 1: Failing tests** in `fakeBackend.test.ts`: `saveProfile keeps fields that are left out`; `listStudents returns only roommate seekers with a name, never the viewer, newest first`; `listStudents filters by term and by each budget band` (budgets 600, 601, 800, 801, 1000, 1001, null against every band); `listStudents pages 30 with hasMore`; `getStudent returns null for a student not looking for roommates`; `uploadAvatar then loadProfile gives an avatarUrl; removeAvatar clears it`; `deleteAccount removes the photo`. In `supabase.test.ts`: `profileUpdateRow` maps only supplied fields and never includes `phone`.
- [ ] **Step 2:** Run `npx vitest run src/test/fakeBackend.test.ts src/lib/backend` → FAIL.
- [ ] **Step 3:** Write the migration, types, adapter and fake.
- [ ] **Step 4:** `npm test && npm run lint && npm run build` → all pass.
- [ ] **Step 5:** Commit "Add profile fields, private phone and photo storage to the backend".

### Task 2: Profile rules, photo handling and the shared form (Sonnet)

**Files:**
- Create: `src/lib/profile.ts`, `src/lib/profile.test.ts`, `src/lib/avatar.ts`, `src/lib/avatar.test.ts`, `src/components/Avatar.tsx`, `src/components/Avatar.test.tsx`, `src/components/ProfileForm.tsx`, `src/components/ProfileForm.test.tsx`
- Modify: `src/state/AccountState.tsx` (expose `uploadAvatar`, `removeAvatar`; refresh `profile` after either)

**Interfaces:**
- Consumes: Task 1 types and `Backend` methods.
- Produces:

```ts
// profile.ts
export const YEARS: { value: StudyYear; label: string }[]
export const BUDGET_BANDS: { value: BudgetBand; label: string }[]
export function upcomingTerms(today: Date, count?: number): { value: string; label: string }[] // default 6, starting with the term after today's
export function termLabel(value: string): string            // '2027-fall' → 'Fall 2027'
export function validateDetails(d: StudentDetails): Partial<Record<keyof StudentDetails, string>>
export function profileSummary(p: Pick<StudentDetails, 'program' | 'year'>): string // 'Biology · 2nd year', either part alone, or ''
// avatar.ts
export type PhotoError = 'type' | 'size' | 'unreadable'
export function checkPhoto(file: File): PhotoError | null
export function toSquareJpeg(file: File, size?: number): Promise<Blob>   // centre-crop, 512, quality 0.85; rejects 'unreadable'
// components
<Avatar name={string} url={string | null} size={'sm' | 'md' | 'lg'} muted?={boolean} />  // initial circle when no url or the image errors; colour from the name
<ProfileForm submitLabel={string} onSaved={() => void} secondary?={ReactNode} />         // reads and saves through useAccount
```

- [ ] **Step 1: Failing tests.** `profile.test.ts`: `upcomingTerms(new Date('2026-11-12'))` → values `2027-winter, 2027-summer, 2027-fall, 2028-winter, 2028-summer, 2028-fall`; from `2026-04-30` first is `2026-summer`; `termLabel('2027-fall') === 'Fall 2027'`; `validateDetails` rejects a 301-character bio, an 81-character program, budgets 299, 5001 and 650.5, and accepts all-empty; `profileSummary` three cases. `avatar.test.ts`: `checkPhoto` → `'type'` for `image/gif` and `application/pdf`, `'size'` for 5 MB + 1 byte, `null` for a 5 MB PNG. `Avatar.test.tsx`: shows the initial with no url; falls back to the initial when the image fires `error`; `alt` is empty and the name is not read twice. `ProfileForm.test.tsx` (fake backend): fields prefilled from the profile; budget starts from the search budget when the profile has none, and isn't saved unless the form is submitted; a past stored term stays selectable; bio shows "n / 300"; submit saves and calls `onSaved`; offline submit shows "Couldn't save. Check your connection and try again." and keeps the typed values; roommates on with an empty name shows "Add your name to appear in Students."; each photo error shows its exact message and nothing is uploaded; a failing `toSquareJpeg` shows the unreadable message; Remove photo calls `removeAvatar`.
- [ ] **Step 2:** Run those test files → FAIL.
- [ ] **Step 3:** Implement. `toSquareJpeg` uses `createImageBitmap` + a canvas (mock it in component tests). Bio is trimmed on save.
- [ ] **Step 4:** `npm test && npm run lint && npm run build`.
- [ ] **Step 5:** Commit "Add profile rules, photo handling and the profile form".

### Task 3: Setup after sign-up, and Account (Sonnet)

**Files:**
- Create: `src/pages/ProfileSetup.tsx`, `src/pages/ProfileSetup.test.tsx`
- Modify: `src/components/AuthForms.tsx` (`onDone: (created: boolean) => void`), `src/components/SignInSheet.tsx`, `src/state/AccountState.tsx`, `src/pages/Account.tsx`, `src/pages/Account.test.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `ProfileForm`, `Avatar`.
- Produces: route `/profile/setup` (outside `Layout`, no bottom bar), reading `location.state.returnTo?: string`.

**Behaviour:**
- Sign-up on the Account page → navigate to `/profile/setup`. Sign-in never goes to setup.
- Sign-up in the sign-in sheet (from Save or Message on a listing) → for `save` the pending action runs; for `message` it is dropped; then navigate to `/profile/setup` with `returnTo` = the current path and query.
- Setup page: heading "Set up your profile", a line "All of this is optional. You can change it any time in Account.", `ProfileForm` with `submitLabel="Save and continue"` and a "Skip for now" button of the same size. Both go to `returnTo ?? '/results'` with `replace`. Signed out → `<Navigate to="/account" replace />`.
- Account (signed in): a "Your profile" section with `ProfileForm` (`submitLabel="Save profile"`, a "Saved" confirmation) and a "View my profile" link to `/students/<own id>`. Name and phone editing stay as they are.

- [ ] **Step 1: Failing tests.** `sign-up on Account goes to setup; Skip for now lands on /results`; `Save and continue stores the profile and lands on /results`; `sign-up from a listing's Save: the place is saved, setup opens, Skip returns to that listing`; `sign-up from Message returns to the listing without opening the message form`; `signing in does not open setup`; `/profile/setup signed out redirects to /account`; `Account shows Your profile and saving there keeps the student on Account`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** full suite, lint, build. **Step 5:** Commit "Offer profile setup after sign-up and in Account".

### Task 4: Students tab, profile page, navigation (Sonnet)

**Files:**
- Create: `src/pages/Students.tsx`, `src/pages/Students.test.tsx`, `src/pages/StudentProfile.tsx`, `src/pages/StudentProfile.test.tsx`, `src/components/StudentCard.tsx`
- Modify: `src/components/BottomNav.tsx` (+ its tests), `src/App.tsx` (routes `/students`, `/students/:id` inside `Layout`), any test that clicks the old "Map" or "List" nav items

**Interfaces:** Consumes `backend.listStudents`, `backend.getStudent` (via `useAccount().backend`), `Avatar`, `BUDGET_BANDS`, `upcomingTerms`, `termLabel`, `profileSummary`.

**Behaviour:**
- `/students` signed in: heading "Students", a line "Students looking for roommates.", two selects (Move-in term with "Any term"; Budget), cards linking to `/students/:id` showing photo, name, `profileSummary`, term label, "$N a month" and the first line of the bio (truncated). "Show more" appends the next 30. Loading text "Loading students…". Failure: "Couldn't load students." with a "Try again" button. Empty: the exact empty-state copy, with a link to `/account` when the viewer's own switch is off.
- `/students` signed out: "Sign in to see students looking for roommates." and a "Sign in" button to `/account`.
- `/students/:id`: large photo, name as `h1`, summary, term, budget, a "Looking for roommates" badge (text, not colour alone), bio preserving line breaks. `null` → "This profile isn't available." with a link back to Students. Own id → same page plus "Edit profile" to `/account` (uses `useAccount().profile`, so it works with the switch off). Signed out → redirect to `/account`. No Message button.
- Bottom bar per Global Constraints; "Places" is active on `/results` in either view and on `/listing/*`.

- [ ] **Step 1: Failing tests.** `lists only roommate seekers and not the viewer`; `filters by term and budget`; `Show more loads the next page`; `empty state copy`; `signed-out prompt`; `load failure offers Try again and recovers`; `profile page shows the fields and no email or phone`; `hidden profile shows "This profile isn't available."`; `own profile shows Edit profile even with roommates off`; `nav has Places, Students, Saved, Messages, Account and no Map`; `a 300-character unbroken bio does not widen the card` (class assertion: `break-words`/`min-w-0`).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** full suite, lint, build. **Step 5:** Commit "Add the Students tab and profile pages".

### Task 5: Docs (Haiku)

**Files:** `README.md`

- [ ] Add a "Community" bullet under "What it does" (profiles, Students tab; roommate seekers only; email and phone never shown); in Accounts → Setup add step "run `supabase/migrations/0002_profiles.sql`" after `0001`; add `profile.ts`, `avatar.ts`, the new components and pages to the file tree; change the map bullet's wording if it mentions a Map tab; move "roommate matching" out of "Not in version 1" only as far as "direct messages between students (part 2)".
- [ ] `npm test && npm run lint && npm run build`. Commit "Document profiles and the Students tab".

### Then

1. Owner runs `0002_profiles.sql` in the Supabase SQL Editor.
2. Opus checks the database rules by hand with two test accounts: cannot read a profile with the switch off, cannot read another student's `profile_private` row, cannot write into another student's photo folder, signed-out reads return nothing.
3. Browser check at 375 px and 1280 px (sign-up → setup → skip; photo upload; Students filters; five nav items fit).
4. Final Opus review of the whole part, one fix wave, push.
