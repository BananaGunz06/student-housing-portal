# Student Housing Portal — Version 1 Design & Plan

## Context

University students on tight budgets struggle to find a place they can actually afford: advertised rent hides utilities, internet and commute, and general marketplaces don't filter by what a student can really pay. This project is a **portfolio piece and an idea test** for a budget-first student housing search, with the hope of turning it into a real product later.

Decisions made with the user:

- **Core job:** budget-first search. The student says what they can afford per month and sees only places that fit, with the true monthly cost shown.
- **Listings:** realistic seeded sample data (no accounts, no posting, no backend in v1).
- **Platform:** mobile-first web app that also works on laptops.
- **Build:** React + TypeScript + Vite, no backend; listing access behind one module so a database can be added later.
- **Extras in v1:** map with price pins, bus routes and stops with walk-to-stop shown, commute to campus, compare saved places.
- **Location:** new git repo at `~/Desktop/student-housing-portal` (separate from the CIS3210 folder).

Assumptions (mine, not stated by the user — correct if wrong):

- Sample campus is **University of Guelph**; listings are fictional but priced realistically for Guelph.
- Working name "student-housing-portal"; no branding decided.
- Out of scope for v1: accounts, landlord posting, messaging, roommate matching, rent-splitting, scam warnings, real listings.

## What the student sees

1. **Welcome / budget** — one question: "What can you spend per month, all-in?" (slider + number field), optional move-in month and bedrooms. Remembered in the browser.
2. **Results** — list/map toggle, budget always visible and editable at the top.
   - Each card: photo, true monthly cost (large), advertised rent (small), a text label **Fits / Stretch / Over budget** (Stretch = up to 10% over), walk or bus time to campus, save button.
   - Default shows Fits + Stretch, sorted by true cost. Filters in a bottom sheet: bedrooms, housing type, furnished, max commute.
3. **Map** — a pin for every available listing with its **price shown on the pin**, coloured by fit. Bus routes drawn as lines, stops as dots, campus marked. Tapping a pin opens a preview card.
4. **Listing detail** — photos, **cost breakdown** (rent + utilities + internet + transit = true monthly cost, and how much is left of the budget), what's included, lease length, and a mini-map showing the nearest bus stop with a dashed walking line: "≈4 min walk to stop · Route 99 · ≈12 min to campus".
5. **Saved** — saved places; select 2–3 to **Compare** side by side (true cost, rent, included items, commute, lease length, bedrooms).

Usability rules: thumb-reachable bottom navigation, large tap targets, fit status never shown by colour alone, plain language, friendly empty states ("Nothing fits $600 — 3 places fit at $650"), works without sign-up.

## Architecture

```
student-housing-portal/
  docs/superpowers/specs/2026-11-10-student-housing-portal-design.md   (this design, committed)
  src/
    data/
      listings.json            ~40 seeded Guelph listings (coords, rent, inclusions, lease, photos)
      campus.ts                campus name + coordinates, default cost estimates
      transit/stops.geojson    bus stops
      transit/routes.geojson   bus route lines
    lib/
      listingsRepo.ts          ONLY way screens get listings (getAll, getById) — future backend seam
      cost.ts                  trueMonthlyCost(listing) -> breakdown; fitStatus(cost, budget)
      commute.ts               distance, nearest stop, walk minutes, campus commute estimate
      filters.ts               filter + sort listings
      storage.ts               useLocalStorage hook (budget, saved ids, filters)
    components/                BudgetBar, ListingCard, FitBadge, CostBreakdown, FilterSheet,
                               MapView, PricePin, TransitLayer, BottomNav, CompareTable
    pages/                     Welcome, Results, ListingDetail, Saved, Compare
    App.tsx, main.tsx          React Router routes
```

- **Stack:** Vite, React 18, TypeScript, React Router, Tailwind CSS, Leaflet + react-leaflet with OpenStreetMap tiles (free, no API key), Vitest + React Testing Library.
- **Pure logic is separate from screens.** `cost.ts`, `commute.ts`, `filters.ts` are plain functions with no React, so they are unit-tested directly and reused by list, map, detail and compare.
- **Price pins** are Leaflet `divIcon`s rendering the price text; colour + a small icon show fit.
- **Transit data:** built from Guelph Transit's public GTFS feed (stops + route shapes) converted once to GeoJSON by a small script in `scripts/`. If the feed can't be fetched during the build, fall back to a hand-made sample set of stops/routes and say so in the README.
- **Commute numbers are estimates** and labelled "≈": walking time from straight-line distance × 1.3 at ~80 m/min; bus time from distance along the route. No paid routing API.
- **Transit cost** is a per-campus setting in `campus.ts` (many universities include a bus pass in student fees; confirm Guelph's during build and default accordingly).
- **Errors/edge cases:** localStorage unavailable -> app still works without remembering; map tiles fail -> list view still works with a notice; saved listing no longer in data -> dropped quietly; no results -> suggest the nearest budget that has results.

## Build order

1. Create the repo, scaffold Vite + React + TS + Tailwind + Vitest, commit. Save this design to `docs/superpowers/specs/` and commit.
2. Write the detailed step-by-step implementation plan (superpowers writing-plans) and get it reviewed before coding features.
3. Data: listing type, seeded `listings.json`, `listingsRepo.ts`, `campus.ts`.
4. Logic, test-first: `cost.ts`, `filters.ts`, `commute.ts`.
5. Welcome + Results list (BudgetBar, ListingCard, FitBadge, FilterSheet), budget persisted.
6. Listing detail with CostBreakdown.
7. Saved + Compare.
8. Map: price pins, then transit layer, then nearest-stop walking line on detail.
9. Visual design pass (frontend-design skill), accessibility check, README with screenshots.
10. Deploy to a free static host (Vercel or GitHub Pages) — only after the user confirms.

## Verification

- `npm test` — unit tests for cost breakdown, fit status boundaries (exactly at budget, 10% over), filters/sorting, nearest-stop and walk-time maths; component tests for budget change updating results and save/compare flow.
- `npm run build` passes with no TypeScript errors.
- Run the dev server and walk the full flow in the browser at phone width (375px) and laptop width: set budget -> results update -> open listing -> breakdown adds up -> save -> compare -> map shows price pins, bus routes, stops, and the walk-to-stop line; reload and confirm budget and saved places persist.
- Check keyboard navigation and that fit status is readable without colour.
