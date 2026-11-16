# Part 1 follow-ups batch Implementation Plan

> **For agentic workers:** follow `CLAUDE.md`: few large steps, one builder for the whole plan (resume it for fixes), one Opus review at the end, nothing in parallel. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix the follow-ups from the part 1 review that a student could notice, the screen-reader gaps, and the unsafe return link after sign-up. No database change.

**Architecture:** The Students list moves from "skip N rows" paging to "continue after the last row seen" paging, behind the same `Backend.listStudents` method (Supabase adapter and fake). Everything else is a local fix in the file that owns it, with two small pure helpers (`safeReturnTo`, `termOptionsWith`) pulled into `src/lib/` so they can be unit-tested.

**Tech Stack:** React 19, TypeScript, React Router 7, Tailwind 4, react-leaflet, Supabase (PostgREST), Vitest + Testing Library.

**Source list:** `docs/superpowers/plans/2026-11-12-student-community-part1-followups.md` (there is no separate spec; the owner approved this selection in chat on 2026-11-15).

## Global Constraints

- Project rules in `CLAUDE.md` apply: tests first; `npm test`, `npm run lint`, `npm run build` pass before every commit; only `src/lib/backend/` talks to Supabase; sample data fictional.
- No file under `supabase/migrations/` is created or changed. No visible copy changes except the two added headings named below.
- Mobile-first; no horizontal scroll at 375 px; controls stay ≥ 44 px tall.
- Stop any dev server before judging a full test run.

## What is in, what is out

**In (this plan):**

| # | Follow-up | Fix |
|---|---|---|
| 1 | "Show more" stuck when a whole page is duplicates | keyset paging (Step 1) |
| 2 | Paging skips a student when someone leaves the list | keyset paging (Step 1) |
| 3 | `listStudents` signs a photo link for the extra row it never shows | only kept rows are signed (Step 1) |
| 4 | Tests rely on the generated id `user-2` | fake gets `idOf(email)` (Step 1) |
| 5 | Mini-map: "This place" and "≈N min walk" overlap | walk label moves below the line when the points are close (Step 2) |
| 6 | Bio counter counts untrimmed text | counter shows the trimmed length (Step 2) |
| 7 | Stored far-future term shown out of order | `termOptionsWith` (Step 2) |
| 8 | Form keeps the previous person's details after an account switch | `key` on `LoadedForm` (Step 2) |
| 9 | Name note not announced or linked to the switch | Step 2 |
| 10 | "Saved" and photo status may not be read aloud; test not scoped | Step 2 |
| 11 | Students filters: label read together with the chosen option | Step 2 |
| 12 | Students and profile page loading / error texts are not live regions; states lack an `h1` | Step 2 |
| 13 | `safeReturnTo` accepts `/\host` | Step 2 |

**Dropped after reading the code (owner to confirm):**

- **`saveProfile` writes two tables non-atomically.** A real fix needs a database function. In practice a failed save shows "Couldn't save", and trying again repeats both writes safely.
- **A pending setup request could catch a different sign-in within 10 s.** It can only happen when a sign-up produces no session (email confirmation on, which is off here), and the result is one optional setup screen with "Skip for now".
- **403 in the console after deleting an account.** It comes from the Supabase library's own sign-out call, is ignored by the library, and is invisible to students. Avoiding it means bypassing the library.

**Moved to part 2's `0003_direct_messages.sql`** (noted in that plan): the photo rule requires a non-empty name, and the rule's lookup uses the primary key.

**Left for later:** the remaining test-only and tidy-up items in the source list.

## Review Focus

- A student switches "Looking for roommates" off between page 1 and "Show more" → nobody on page 2 is skipped or shown twice.
- Two students saved their profile in the same instant (equal `updated_at`) and fall on a page boundary → both appear exactly once.
- A return link of `/\example.com`, `//example.com`, `https://example.com` or one containing a tab or newline → the student lands on `/results`.
- A listing whose stop is under a 2-minute walk, at 375 px and 1280 px → "This place" and the walk label are both fully readable.
- Log out, then log in as another student on the same device without reloading → the profile form shows the second student's details.

---

### Step 1: Students list paging (Sonnet)

**Files:**
- Modify: `src/lib/backend/types.ts`, `src/lib/backend/supabase.ts`, `src/lib/backend/supabase.test.ts`, `src/test/fakeBackend.ts`, `src/test/fakeBackend.test.ts`, `src/pages/Students.tsx`, `src/pages/Students.test.tsx`, `src/pages/StudentProfile.test.tsx`

**Interfaces (produces):**

```ts
// types.ts — replaces `offset` and `hasMore`
export interface StudentQuery {
  moveInTerm?: string
  band?: BudgetBand
  after?: string          // the `nextCursor` of the previous page; omitted for the first page
  limit: number
}
listStudents(q: StudentQuery): Promise<{ students: StudentCard[]; nextCursor: string | null }>  // null = no more

// fakeBackend.ts — new test helper
idOf(email: string): string
```

**Rules:**
- Order is `updated_at` newest first, then `id` descending as the tie-break. A page holds the rows strictly after the cursor in that order.
- The cursor is opaque to screens: `<updated_at exactly as the database returned it>|<id>`. The adapter never passes the time through a JavaScript `Date` (that would drop microseconds and re-show or skip rows).
- Adapter: add `updated_at` to the columns selected for the list; filter with PostgREST `or(updated_at.lt."<t>",and(updated_at.eq."<t>",id.lt.<id>))` (the time is double-quoted because it contains `+` and `:`); fetch `limit + 1` rows; sign photo links for the first `limit` rows only; `nextCursor` comes from the last kept row when an extra row exists, otherwise `null`. A malformed `after` is treated as no cursor.
- Fake: same order and cursor using its clock value and id.
- `Students.tsx`: keeps `nextCursor` in the result instead of `hasMore`; "Show more" sends `after: r.nextCursor`; the duplicate filter stays as a guard.

- [ ] **Tests first:**
  - `fakeBackend.test.ts`: 31 students page as 30 then 1 with `nextCursor` null at the end; a student who leaves the list after page 1 does not cause anyone on page 2 to be skipped; a student who joins after page 1 is not shown on page 2 twice; two students with the same clock value across a page boundary each appear once; replace `getStudent('user-2')` with `idOf(...)`.
  - `supabase.test.ts`: the cursor filter string is built with the raw time and the id; only `limit` photo links are requested; a malformed `after` behaves as the first page.
  - `Students.test.tsx`: rewrite the two tests that fake `offset` to use `after`; "Show more" disappears when `nextCursor` is null; a page made only of already-shown students does not leave "Show more" stuck (the button goes when `nextCursor` is null, and otherwise the next click advances).
  - `StudentProfile.test.tsx`: use `idOf(...)` instead of `'user-2'`.
- [ ] Run them → FAIL. Implement.
- [ ] `npm test && npm run lint && npm run build`. Commit "Page the Students list by position, not by count".

### Step 2: Form, screen-reader, return-link and mini-map fixes (same Sonnet builder)

**Files:**
- Create: `src/lib/safeReturnTo.ts`, `src/lib/safeReturnTo.test.ts`
- Modify: `src/pages/ProfileSetup.tsx`, `src/lib/profile.ts`, `src/lib/profile.test.ts`, `src/components/ProfileForm.tsx`, `src/components/ProfileForm.test.tsx`, `src/pages/Account.tsx`, `src/pages/Account.test.tsx`, `src/pages/Students.tsx`, `src/pages/Students.test.tsx`, `src/pages/StudentProfile.tsx`, `src/pages/StudentProfile.test.tsx`, `src/components/CommuteLayers.tsx`, `src/components/MiniMap.test.tsx`, `docs/superpowers/plans/2026-11-12-student-community-part1-followups.md`

**Interfaces (produces):**

```ts
// src/lib/safeReturnTo.ts
/** An in-app path from router state, or '/results'. */
export function safeReturnTo(state: unknown): string
// src/lib/profile.ts
/** The upcoming terms, with a stored term that isn't among them placed in date order. */
export function termOptionsWith(terms: { value: string; label: string }[], stored: string | null): { value: string; label: string }[]
```

**Behaviour:**
- **`safeReturnTo`:** returns `state.returnTo` only when it is a string that starts with exactly one `/`, whose second character is not `/` or `\`, and that contains no `\` and no control characters (U+0000–U+001F); otherwise `/results`. `ProfileSetup.tsx` imports it and loses its local copy.
- **`termOptionsWith`:** terms compare by year, then winter < summer < fall. A stored term earlier than the first option goes first; one later than the last goes last; `null` or one already present returns the list unchanged. `ProfileForm` uses it for the Move-in term options.
- **Bio counter:** shows `bio.trim().length` and turns red on the same number validation uses.
- **Account switch:** `ProfileForm` renders `<LoadedForm key={session.userId} …>` so its fields restart for a different student.
- **Name note:** the "Add your name to appear in Students." text gets the id `${switchId}-name`, sits inside an always-present `role="status"` wrapper, and its id is added to the switch's `aria-describedby` while it is shown.
- **Status messages:** the "Saved" messages in `Account.tsx` (details form and Your profile) and the photo "Uploading… / Removing…" text in `ProfileForm` keep their `role="status"` element mounted all the time and change only the text inside, so screen readers announce it.
- **Students filters:** each `<label>` becomes `<label htmlFor>` beside its `<select id>` (ids from `useId`), no longer wrapping it. Layout unchanged.
- **Live regions and headings:** in `Students.tsx`, "Loading students…" and "Loading…" are `role="status"`, "Couldn't load students." and "Couldn't load more students." are `role="alert"`. In `StudentProfile.tsx`, the loading and both error states show an `h1` "Student profile" (same classes as the "This profile isn't available." heading), loading text is `role="status"`, error text is `role="alert"`.
- **Mini-map label:** in `CommuteLayers.tsx`, measure the on-screen distance between the listing and the end of the walk line (`useMap().latLngToContainerPoint`, recomputed on `zoomend`). Under 90 px, the "≈N min walk" label is drawn with `direction="bottom"` and `offset={[0, 18]}`; otherwise it stays `direction="center"`. Confirm in the browser that this clears the "This place" label; adjust the offset if it does not, and say so in the report.
- **Follow-ups file:** delete the lines this plan fixes, and mark the three dropped items "(not fixing: see 2026-11-15 plan)".

- [ ] **Tests first:**
  - `safeReturnTo.test.ts`: `/listing/gue-001` and `/results?x=1` pass through; `//example.com`, `/\example.com`, `/a\b`, `https://example.com`, `'/a\tb'`, `''`, `null`, `{}` and a non-string all give `/results`.
  - `profile.test.ts`: `termOptionsWith` with a far-future term (last), a past term (first), a present term and `null` (unchanged).
  - `ProfileForm.test.tsx`: a bio of 300 characters plus trailing spaces shows `300 / 300` and is not red; after switching the signed-in student the fields show the second student's values; with the switch on and no name, the switch is described by the name note and the note is inside a `status` region; the photo status region exists before an upload starts.
  - `Account.test.tsx`: the Your profile section has an empty `status` region before saving and "Saved" inside that same region afterwards (query scoped to the section with `within`); the same for the details form.
  - `Students.test.tsx`: `getByLabelText('Move-in term')` and `getByLabelText('Budget')` have accessible names exactly "Move-in term" and "Budget"; the loading text is in a `status` region and the load error in an `alert`.
  - `StudentProfile.test.tsx`: loading and error states have a level-1 heading "Student profile"; the error is an `alert`.
  - `MiniMap.test.tsx`: with the stop a few metres from the listing the walk tooltip is rendered with the bottom direction; with a distant stop it is centred.
- [ ] Run them → FAIL. Implement.
- [ ] `npm test && npm run lint && npm run build`. Commit "Fix profile form, screen-reader and return-link follow-ups".

### Then (in this order, one at a time)

1. Browser check with Playwright at 375 px and 1280 px against `npm run dev`, using throwaway `example.com` accounts that are deleted afterwards (the owner's real profile stays out of screenshots and output): Students filters and "Show more"; the profile form counter and name note; a listing with a very close stop and one with a distant stop on the mini-map; sign-up from a listing returns to that listing; no horizontal scroll; no console errors.
2. One Opus review of the whole batch, one fix pass by the same builder.
3. A pull request only when the owner asks.
