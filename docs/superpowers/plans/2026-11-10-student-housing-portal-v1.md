# Student Housing Portal v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first, budget-first student housing search for University of Guelph, using seeded sample listings, a true-monthly-cost breakdown, a map with price pins and bus routes, and saved/compare.

**Architecture:** Static React SPA, no backend. Screens get listings only through `src/lib/listingsRepo.ts`. All maths (cost, fit, commute, filters) lives in pure functions in `src/lib/`, which are unit-tested directly. Shared user state (budget, filters, saved ids) lives in one React context backed by a localStorage hook that survives storage being unavailable.

**Tech Stack:** Vite 8, React 19, TypeScript 7, React Router 7, Tailwind 4, Leaflet + react-leaflet 5 (OpenStreetMap tiles), Vitest 5 + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-10-student-housing-portal-design.md`

## Global Constraints

- Mobile-first; must work at 375px wide and on laptops. Thumb-reachable bottom navigation, large tap targets (≥44px).
- Fit status is never shown by colour alone: always the text label **Fits / Stretch / Over budget** plus an icon (✓ / ! / ✕).
- Stretch = up to 10% over budget. `total <= budget` → fits; `total <= budget × 1.1` → stretch; otherwise over.
- Commute numbers are estimates, labelled "≈". Walking = straight-line distance × 1.3 at 80 m/min. Bus = distance along route line (no paid routing API).
- No backend, no sign-up, no accounts. Do not deploy (spec step 10 waits for the user).
- Plain language; friendly empty states ("Nothing fits $600 — 3 places fit at $650").
- Transit cost per campus in `campus.ts`. Guelph undergrads pay the UPass in student fees → `transitMonthly: 0`, note "Bus pass included in U of G student fees".
- Transit data: the Guelph open-data hosts are blocked by this build environment's network policy, so use the spec's fallback: hand-made sample stops/routes, stated in the README.
- Listing photos: no image hosting/network for images; render generated SVG illustrations per listing (`ListingArt`), stated in the README.

## Review Focus

1. Budget field typed empty, `0`, letters or a huge number → no crash; budget clamps to 300–5000 on commit, field can be temporarily empty. (Task 4 test)
2. localStorage throws (Safari private mode, blocked storage) → app still works, nothing remembered. (Task 2 test)
3. Saved id no longer in the data → dropped quietly from Saved and Compare. (Task 6 test)
4. `/compare` with 0–1 valid ids, unknown ids or >3 ids → helpful message for <2, only first 3 shown. (Task 6 test)
5. `/listing/does-not-exist` → friendly "not found" with a link back, not a blank screen. (Task 5 test)

---

## File structure

```
src/
  data/types.ts             Listing, HousingType, LatLng, Stop, Route
  data/listings.json        40 seeded Guelph listings (generated once by scripts/generate-listings.mjs)
  data/campus.ts            CAMPUS: name, coords, campus stop id, defaults, transit note
  data/transit/stops.geojson  hand-made sample stops (FeatureCollection<Point>, props: id, name, routes[])
  data/transit/routes.geojson hand-made sample routes (FeatureCollection<LineString>, props: id, name, color)
  data/transit/index.ts     parses geojson (?raw) → STOPS: Stop[], ROUTES: Route[]
  lib/listingsRepo.ts       getAll(): Listing[]; getById(id): Listing | undefined
  lib/cost.ts               trueMonthlyCost, fitStatus, formatMoney
  lib/commute.ts            distanceMeters, walkMinutes, nearestStop, alongRouteMeters, campusCommute
  lib/filters.ts            evaluate, applyFilters, nearestBudgetWithResults, DEFAULT_FILTERS
  lib/storage.ts            safeStorage + useLocalStorage
  state/AppState.tsx        AppStateProvider + useAppState (budget, filters, saved)
  components/               BudgetBar, ListingCard, FitBadge, CostBreakdown, FilterSheet, MapView,
                            pricePin.ts, TransitLayer, BottomNav, CompareTable, ListingArt, MiniMap
  pages/                    Welcome, Results, ListingDetail, Saved, Compare, NotFound
  App.tsx                   routes; main.tsx wraps BrowserRouter + AppStateProvider
scripts/generate-listings.mjs  deterministic seeded generator
```

---

### Task 1: Data — types, campus, transit, listings, repo

**Files:** Create `src/data/types.ts`, `src/data/campus.ts`, `src/data/transit/{stops,routes}.geojson`, `src/data/transit/index.ts`, `scripts/generate-listings.mjs`, `src/data/listings.json`, `src/lib/listingsRepo.ts`; Test `src/lib/listingsRepo.test.ts`

**Interfaces — Produces:**
```ts
type HousingType = 'room' | 'studio' | 'apartment' | 'basement' | 'house'
interface LatLng { lat: number; lng: number }
interface Listing {
  id: string; title: string; address: string; neighbourhood: string; type: HousingType
  bedrooms: number            // bedrooms you rent; a room in a shared house = 1, studio = 0
  bathrooms: number; lat: number; lng: number
  rent: number                // advertised monthly rent, whole dollars
  utilitiesIncluded: boolean; utilitiesEstimate: number   // used only when not included
  internetIncluded: boolean;  internetEstimate: number
  furnished: boolean; leaseMonths: 4 | 8 | 12; availableFrom: string  // 'YYYY-MM'
  included: string[]          // e.g. 'Laundry in building', 'Parking'
  description: string
}
interface Stop { id: string; name: string; lat: number; lng: number; routes: string[] }
interface Route { id: string; name: string; color: string; path: LatLng[] }
CAMPUS: { name: 'University of Guelph'; lat: 43.5305; lng: -80.2262; stopId: string
          transitMonthly: 0; transitNote: string; defaultUtilities: number; defaultInternet: number }
STOPS: Stop[]; ROUTES: Route[]
getAll(): Listing[]; getById(id: string): Listing | undefined
```

- [ ] Write tests: 40 listings, unique ids, all within Guelph bbox (lat 43.48–43.58, lng −80.32 to −80.15), `getById` hit/miss, every route passes within 150 m of campus stop, every stop's routes exist.
- [ ] Run `npx vitest run src/lib/listingsRepo.test.ts` → FAIL (modules missing).
- [ ] Hand-make 4 sample routes (99 Mainline N–S via downtown/Gordon; Stone Rd E–W; Edinburgh N–S west side; Victoria/College east) all through the campus loop, plus ~30 stops. Generator uses a seeded PRNG; Guelph-realistic rents: room $650–950, studio $1250–1500, basement $1150–1450, 1-bed apt $1450–1850, 2-bed $1950–2400, house (3-bed) $2600–3200. Commit generated JSON.
- [ ] Run tests → PASS. Commit `feat(data): seeded listings, campus, sample transit, listings repo`.

### Task 2: Pure logic, test-first — cost, commute, filters, storage

**Files:** `src/lib/{cost,commute,filters,storage}.ts` + `.test.ts` each

**Interfaces — Produces:**
```ts
type FitStatus = 'fits' | 'stretch' | 'over'
interface CostBreakdown { rent: number; utilities: number; internet: number; transit: number; total: number }
trueMonthlyCost(l: Listing, campus = CAMPUS): CostBreakdown
fitStatus(total: number, budget: number): FitStatus
formatMoney(n: number): string                        // '$1,240'
distanceMeters(a: LatLng, b: LatLng): number          // haversine
walkMinutes(meters: number): number                   // ceil(m × 1.3 / 80), min 1
nearestStop(p: LatLng, stops: Stop[]): { stop: Stop; meters: number }
alongRouteMeters(path: LatLng[], a: LatLng, b: LatLng): number  // between nearest vertices
type Commute = { mode: 'walk'; minutes: number }
  | { mode: 'bus'; minutes: number; walkToStopMinutes: number; stop: Stop; route: Route; busMinutes: number }
campusCommute(p: LatLng, stops?, routes?, campus?): Commute   // bus at 330 m/min; walk if walk ≤ 15 or ≤ bus total
interface Filters { bedrooms: 'any' | 0 | 1 | 2 | 3; types: HousingType[]; furnishedOnly: boolean
                    maxCommute: number | null; moveIn: string | null; showOver: boolean }
DEFAULT_FILTERS: Filters  // any, [], false, null, null, false
interface ListingResult { listing: Listing; cost: CostBreakdown; fit: FitStatus; commute: Commute }
evaluate(listings: Listing[], budget: number): ListingResult[]
applyFilters(results: ListingResult[], f: Filters): ListingResult[]   // sorted by total asc, then id
nearestBudgetWithResults(listings: Listing[], f: Filters, budget: number): { budget: number; count: number } | null
safeStorage: { get(key): string | null; set(key, value): void }   // swallow errors
useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void]
```
Rules: bedrooms 3 means 3+; moveIn keeps `availableFrom <= moveIn`; maxCommute keeps `commute.minutes <= maxCommute`; non-budget filters always apply; fit filter hides `over` unless `showOver`. nearestBudget: smallest total above `budget` among listings passing non-budget filters, rounded up to $50, count = listings that *fit* at that budget.

- [ ] Tests (cost): included utilities/internet → 0; not included → estimate; transit = 0; total sums. fitStatus: exactly budget → fits; budget+1 → stretch; exactly 110% (1000→1100) → stretch; 1101 → over.
- [ ] Tests (commute): distance between two known points ±1%; walkMinutes(800) = 13; nearestStop picks closest; a listing 300 m from campus → walk; a listing 4 km away → bus with stop, route, minutes = walk + bus.
- [ ] Tests (filters): sort order; Stretch shown by default and Over hidden; showOver; bedrooms 3 matches 4; types; furnished; maxCommute; moveIn; nearestBudget returns {650, n} style answer, null when nothing ever matches.
- [ ] Tests (storage): round-trips JSON; corrupt JSON → initial; `localStorage.getItem/setItem` throwing → hook still returns initial and setter updates state.
- [ ] Run each test file → FAIL, implement, → PASS. Commit per module.

### Task 3: App shell — state, routing, bottom nav

**Files:** `src/state/AppState.tsx`, `src/components/BottomNav.tsx`, `src/App.tsx`, `src/main.tsx`, `src/pages/NotFound.tsx`; Test `src/App.test.tsx`

**Produces:** `useAppState(): { budget: number | null; setBudget(n: number): void; filters: Filters; setFilters(f: Filters): void; savedIds: string[]; isSaved(id): boolean; toggleSaved(id): void; clearSaved?: never }`. Keys: `shp.budget`, `shp.filters`, `shp.saved`. Routes: `/` Welcome (redirects to `/results` if budget set), `/results` (`?view=map`), `/listing/:id`, `/saved`, `/compare?ids=a,b`, `*` NotFound. BottomNav: Search, Map, Saved (with count), hidden on Welcome. Tests render `App` inside `MemoryRouter` (export `AppRoutes`).

- [ ] Test: no budget → Welcome heading "What can you spend per month, all-in?"; stored budget → results. Implement. Commit.

### Task 4: Welcome + Results list

**Files:** `src/pages/{Welcome,Results}.tsx`, `src/components/{BudgetBar,ListingCard,FitBadge,FilterSheet,ListingArt}.tsx`; Tests `src/pages/Results.test.tsx`, `src/components/BudgetBar.test.tsx`

Welcome: slider (300–3000, step 25) + number field, optional move-in month (`<input type="month">`), bedrooms select, "Show places" button. BudgetBar: sticky top, shows budget + edit (slider + number), count "12 fit · 4 stretch". ListingCard: art, true cost large, "Advertised rent $X" small, FitBadge, ≈commute, save toggle (aria-pressed). FilterSheet: bottom sheet dialog with bedrooms, type, furnished, max commute, show over-budget. Empty state uses nearestBudgetWithResults with a button to apply it.

- [ ] Tests: changing budget from 1000 to 700 reduces card count; empty state message "Nothing fits $300" and button sets suggested budget; BudgetBar typing "" then "abc" doesn't crash and blur clamps to 300; FitBadge always has text. Implement (mock `MapView` in page tests). Commit.

### Task 5: Listing detail with CostBreakdown

**Files:** `src/pages/ListingDetail.tsx`, `src/components/CostBreakdown.tsx`; Test `src/pages/ListingDetail.test.tsx`

Breakdown rows rent + utilities ("Included" when 0 because included) + internet + bus pass (with transit note) = true monthly cost; "Left of your budget: $X" or "$X over your budget". Also included items, lease length, available from, bedrooms/bathrooms, commute text "≈4 min walk to stop · Route 99 · ≈12 min to campus", save button, mini-map placeholder slot (filled in Task 7).

- [ ] Tests: rows sum to total shown; "left of budget" value; unknown id → "We couldn't find that place" + link to results. Implement. Commit.

### Task 6: Saved + Compare

**Files:** `src/pages/{Saved,Compare}.tsx`, `src/components/CompareTable.tsx`; Test `src/pages/SavedCompare.test.tsx`

Saved: list of saved cards with a checkbox "Select to compare" (max 3; 4th disabled with hint); "Compare (n)" button enabled at 2–3 → `/compare?ids=`. Empty state links to search. CompareTable rows: True monthly cost (cheapest marked "Lowest"), Rent, Included, Commute, Lease, Bedrooms, Fit.

- [ ] Tests: save two from results → Saved shows both → select both → Compare shows both titles and row labels; stale saved id ignored; `/compare?ids=x` (1 valid) → "Pick at least 2 places"; 4 ids → 3 columns. Implement. Commit.

### Task 7: Map — price pins, transit layer, walking line

**Files:** `src/components/{MapView,pricePin.ts,TransitLayer,MiniMap}.tsx`; Test `src/components/pricePin.test.ts`

`pricePinHtml(r: ListingResult): string` → contains formatted total, fit icon and `aria-label`-style text; class `pin pin--{fit}`. MapView: OSM TileLayer (attribution), campus marker, TransitLayer (route Polylines in route colour, stops as CircleMarkers with name tooltips), pins for every listing passing non-budget filters coloured by fit, tap → preview card at bottom with link to detail; `tileerror` → notice "Map tiles couldn't load — the list still works" with "Show list" button. MiniMap on detail: listing marker, nearest stop, dashed walking Polyline listing→stop, the route highlighted, campus marker. Results `?view=map` renders MapView lazily (React.lazy) so tests/list don't load Leaflet. Import `leaflet/dist/leaflet.css`.

- [ ] Test pricePin html for each fit. Implement. Verify in browser (Task 8). Commit.

### Task 8: Visual pass, accessibility, README, verification

- [ ] Frontend-design pass: consistent tokens, typography, cards, sheet, pins.
- [ ] Accessibility: visible focus rings, labels on all inputs, sheet focus/escape, `aria-pressed` on save, landmarks, colour contrast.
- [ ] Playwright walk at 375×812 and 1280×800: budget → results → detail → save → compare → map; reload persists budget/saved. Save screenshots to `docs/screenshots/`.
- [ ] README: what it is, run/test commands, data caveats (sample listings, sample transit, generated art, estimates), architecture, screenshots.
- [ ] `npm test`, `npm run lint`, `npm run build` all pass. Commit, push, open PR.
