# Move-in by term and length of stay Implementation Plan

> **For agentic workers:** follow `CLAUDE.md`: one builder for the whole plan (resume it for fixes), one Opus review at the end, nothing in parallel. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Students choose a move-in term and how long they need instead of a month; listings show their start term and lease length and flag leases longer than needed; bedrooms leave the first screen.

**Architecture:** Term helpers live in `src/lib/profile.ts` beside `upcomingTerms`/`termLabel`. `Filters` swaps `moveIn` (a month) for `moveInTerm` (a term) and gains `stay`. One cleaning function turns any stored filters (browser or account) into valid `Filters`, converting the old month. Matching and the sublet note are pure functions in `src/lib/filters.ts`, used by the card, listing page and Compare.

**Tech Stack:** React 19, TypeScript, Tailwind 4, Vitest + Testing Library. No database change.

**Spec:** `docs/superpowers/specs/2026-11-17-move-in-by-term-design.md`

## Global Constraints

- Project rules in `CLAUDE.md` apply: tests first; `npm test`, `npm run lint`, `npm run build` pass before every commit; `src/lib/listingsRepo.ts` stays the only way screens get listings.
- No change to `supabase/migrations/`, profiles, the Students tab or `.env`.
- Copy (exact): "Which term do you move in?", "Not sure yet", "For how long?", "Any", "4 months", "8 months", "8+ months", "Term", "Any term", "How long", "Moving in <Term>", "From <Term> · <N> months", "Starts", "<Term> (<Month>)", "<N> months (<T> terms)", "<N>-month lease · you'd sublet the last <M> months".
- Every control ≥ 44 px tall; no horizontal scroll at 375 px.

## Review Focus

- A signed-in student whose account still holds `{ moveIn: "2027-01" }` loads the app → filter becomes Winter 2027, nothing crashes, and the next sync saves the new shape.
- A stored term that has become past (say Winter 2027 in May 2027) still shows in the select and its chip, and can be cleared.
- "4 months" chosen: a 12-month lease reads "12-month lease · you'd sublet the last 8 months" on both the card and the listing page; with "Any" or "8+ months" no note appears anywhere.
- The "nearest budget with results" suggestion ("Nothing fits $600. 3 places fit at $650.") still respects the term and length filters.
- The phone filter drawer and the laptop sidebar both show the new group and fit at 375 px and 1280 px.

---

### Step 1: Terms, filters, screens and sample data (Sonnet)

**Files:**
- Modify: `src/lib/profile.ts` (+ test), `src/lib/filters.ts` (+ test), `src/lib/sync.ts` (+ test), `src/state/AppState.tsx`, `src/pages/Welcome.tsx`, `src/components/FilterPanel.tsx`, `src/components/ListingCard.tsx`, `src/components/ListingDetailContent.tsx`, `src/components/CompareTable.tsx`, the tests of those screens (`Results.test.tsx`, `ListingDetail.test.tsx`, `SavedCompare.test.tsx`, plus a new `src/pages/Welcome.test.tsx` if none exists), `scripts/generate-listings.mjs`, `src/data/listings.json` (regenerated), `README.md`

**Interfaces (produces):**

```ts
// profile.ts
export function termOfMonth(month: string): string          // '2027-09' → '2027-fall'; Jan–Apr winter, May–Aug summer, Sep–Dec fall
export function termStartMonthName(term: string): string     // '2027-fall' → 'September'
// filters.ts
export type Stay = 'any' | 4 | 8 | '8+'
export interface Filters { /* … */ moveInTerm: string | null; stay: Stay /* moveIn removed */ }
export const STAY_OPTIONS: { value: Stay; label: string }[]  // Any, 4 months, 8 months, 8+ months
export function subletMonths(leaseMonths: number, stay: Stay): number   // months to sublet; 0 when no note
export function subletNote(leaseMonths: number, stay: Stay): string | null
export function cleanFilters(raw: unknown): Filters          // moved here from sync.ts and exported; never throws
```

**Rules:**
- `subletMonths`: `stay` 4 → `lease − 4`; `stay` 8 → `max(0, lease − 8)`; `'any'` and `'8+'` → 0.
- Matching (inside `matchesNonBudget`): term: `termOfMonth(l.availableFrom) === f.moveInTerm` when set; length: hidden when `l.leaseMonths < (stay === 4 ? 4 : stay === 'any' ? 0 : 8)`.
- `cleanFilters`: keeps today's checks for the other fields; `moveInTerm` accepted when it matches `^\d{4}-(winter|summer|fall)$`; otherwise, an old `moveIn` matching `^\d{4}-\d{2}$` becomes `termOfMonth(moveIn)`; `stay` accepted only from the four values, else `'any'`. The old `moveIn` key never survives. `sync.ts` uses it for account data; `AppState` uses it for browser data instead of `{ ...DEFAULT_FILTERS, ...stored }`.
- Term select options in Welcome and the side filter: `termOptionsWith(upcomingTerms(new Date()), f.moveInTerm)`, so a past stored term still shows.
- Welcome saves `{ ...filters, moveInTerm, stay }` and no longer touches `bedrooms`.
- `generate-listings.mjs`: in the `months` array, replace `'2026-12'` with `'2027-01'` (same array length, so the seeded picks and every other field stay identical). Regenerate; `git diff src/data/listings.json` must show only `availableFrom` lines changing, exactly 6 of them.
- `README.md`: "What it does" lines about the first question and the filters mention move-in term and how long instead of move-in month and bedrooms on the first screen.

- [ ] **Tests first:**
  - `profile.test.ts`: `termOfMonth` for months 01, 04, 05, 08, 09, 12; `termStartMonthName` for each season.
  - `filters.test.ts`: the spec's length table (every row × every lease), including `subletNote(12, 4)` = "12-month lease · you'd sublet the last 8 months" and `subletNote(12, 8)` = "12-month lease · you'd sublet the last 4 months", null for `'any'` and `'8+'`; term matching; chips for term and stay and removing each; `cleanFilters` with `{ moveIn: '2027-01' }` → Winter 2027, `{ moveIn: 'junk' }` → null term, `{ stay: 12 }` → `'any'`, `null` and non-objects → defaults, never throws; the nearest-budget suggestion with a term set.
  - `sync.test.ts`: an account holding the old `moveIn` month loads as the term.
  - Welcome: no "How many bedrooms?"; choosing Fall 2027 and "8 months" then submitting stores `moveInTerm: '<year>-fall'` and `stay: 8`; bedrooms left as they were.
  - Results: the side filter's term and "How long" change the list; chips "Moving in …" and "4 months" appear and remove their filter.
  - Card / listing page / Compare: "From Winter 2027 · 12 months", "Starts" "Winter 2027 (January)", "12 months (3 terms)"; the sublet note with stay 4 on a 12-month listing, and its absence with "Any".
  - Data: every listing's `availableFrom` month is 01, 05 or 09.
- [ ] Run them → FAIL. Implement.
- [ ] `npm test && npm run lint && npm run build`. Commit "Choose move-in by term and length of stay".

### Then (in this order, one at a time)

1. Browser check in demo mode (`npm run demo`) at 375 px and 1280 px: Welcome with term and length and no bedroom question; results with the new chips; the side filter on a laptop and in the phone drawer; a 12-month listing with "4 months" chosen shows the sublet note on the card and the listing page; Compare; no sideways scroll; no console errors.
2. One Opus review, one fix pass by the same builder.
3. A pull request only when the owner asks.
