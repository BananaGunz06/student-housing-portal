# Real bus routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the 4 sample routes with Guelph Transit's real routes, stops and timetable ride times.

**Architecture:** A Node script turns the GTFS zip into small committed files (`routes.geojson`, `stops.geojson`, `meta.json`) in the same folder the app already reads; the app's transit loader, commute maths and map layers adapt to multi-line routes and per-stop ride times.

**Tech Stack:** Node ≥ 22 (built-in `fetch`), a zip reader (`fflate` as a devDependency), Vitest, React-Leaflet.

**Spec:** `docs/superpowers/specs/2026-11-11-real-bus-routes-design.md`

## Global Constraints

- Feed URL `https://files.mobilitydatabase.org/mdb-3140/latest.zip`; excluded routes `BREW`, `ZehrsGS`, `HMidGCS`, `HMidUC`; campus stops = names starting "University Centre"; ride-time window 7:00–10:00 arrivals at the University Centre, weekday service, median rounded up.
- Simplification tolerance ≈ 10 m; generated GeoJSON total < 250 KB.
- Bus option only for stops within a 10-minute walk; walk-only rule unchanged (≤ 15 min or no slower than bus).
- Copy (exact): "Transfer needed"; map notice "Bus routes: Guelph Transit, Winter 2026 schedule" (label from meta.json); attribution "Transit data: City of Guelph"; welcome "Your budget stays on this device unless you sign in."
- Tests never touch the network (the script's download is not exercised in tests).

## Review Focus

- A listing right next to campus → walk, never "Transfer needed".
- A stop served only in the direction away from campus → must not get a ride time (stop must come before the University Centre in the trip).
- A route whose trips loop through the University Centre twice → use the first University Centre arrival after the stop.
- "Longest commute" filter with a transfer listing → excluded under any limit; shown when the filter is "Any".
- Map performance on a phone: stops hidden below zoom 15; route lines simplified.

---

### Task 1: GTFS converter (Sonnet)

**Files:** Create `scripts/lib/gtfs.mjs`, `scripts/build-transit-from-gtfs.mjs`, `scripts/lib/gtfs.test.ts` (+ a tiny fixture feed under `scripts/lib/__fixtures__/`); regenerate `src/data/transit/routes.geojson`, `stops.geojson`; create `src/data/transit/meta.json`; delete `scripts/build-sample-transit.mjs`. Add `fflate` devDependency; include `scripts/**/*.test.ts` in Vitest.

**Produces (file formats):**
- `routes.geojson`: FeatureCollection of `MultiLineString` features, properties `{ id, shortName, longName, color }` (`color` with `#`).
- `stops.geojson`: `Point` features, properties `{ id, name, routes: string[], toCampus: Record<routeId, number> }`, plus `campus: true` on University Centre stops.
- `meta.json`: `{ schedule: "Winter 2026", serviceStart: "2026-01-04", serviceEnd: "2026-05-02", source, generated }`.

- [ ] Tests first on the fixture: route filtering, shape simplification (endpoints kept, max deviation ≤ tolerance), ride-time (direction, first UC arrival after the stop, 7–10 window, median rounded up), stop→routes.
- [ ] Implement; run the script on the real feed; check sizes and spot-check a Gordon St stop and a 99 Mainline stop.
- [ ] `npm test`, lint, build. Commit.

### Task 2: App uses the real network (Sonnet)

**Files:** `src/data/types.ts` (Route: `shortName`, `longName`, `paths: LatLng[][]`; Stop: `toCampus`, `campus?`), `src/data/transit/index.ts`, `src/data/campus.ts` (campus point = University Centre loop centre), `src/lib/commute.ts` (+ tests), `src/lib/filters.ts` (transfer vs maxCommute, + tests), `src/components/TransitLayer.tsx`, `MapView.tsx`, `MiniMap.tsx`, `ListingCard.tsx`, `CompareTable.tsx`, `src/pages/ListingDetail.tsx`, affected tests.

**Interfaces:** `Commute = {mode:'walk'; minutes} | {mode:'bus'; minutes; walkToStopMinutes; stop; route; rideMinutes} | {mode:'transfer'}`; `describeCommute` → "≈6 min walk to stop · Route 99 · ≈14 min to campus" / "Transfer needed"; `shortCommute` → "≈14 min by bus" / "Transfer needed".

- [ ] Tests first: commute walk / direct bus / nearest-of-several / transfer / next-to-campus; filters with transfer.
- [ ] Implement; stops layer only at zoom ≥ 15; mini-map draws the chosen route's paths and the walk line.
- [ ] Full suite, lint, build. Commit.

### Task 1b: One-transfer trips in the converter (Sonnet, same builder as Task 1)

Per stop, `viaTransfer: { minutes, firstRoute, secondRoute, transferStop: { id, name } }` = min over (route A from this stop → later stop B on the same trip, where B has a direct `toCampus` on a different route) of median ride A→B + 5 + toCampus[B][routeB]; departures from this stop 6:30–9:30 on the representative weekday; omit when the stop already has a direct time ≤ the best transfer time, or none exists. Fixture tests; report new coverage on the 40 listings.

### Task 2b: App shows one-transfer commutes (Sonnet, same builder as Task 2, together with Task 2's review fixes)

Commute `bus` gains optional `transfer: { secondRoute, stop }`; candidates include walk + viaTransfer.minutes; copy "≈N min by bus, 1 transfer · Route A then Route B" (describe) and "≈N min by bus, 1 transfer" (short). `transfer` mode remains only when nothing is reachable.

### Task 3: Copy, credit and docs (Haiku)

**Files:** `MapView.tsx` notice, tile attribution string (`src/components/mapShared.ts`), `ListingDetail.tsx` commute note, `src/pages/Welcome.tsx`, `README.md` (About the data, how to refresh the feed, licence credit, budget copy), tests asserting copy.

- [ ] Update copy exactly per Global Constraints; README explains `node scripts/build-transit-from-gtfs.mjs [path-to-zip]`.
- [ ] Full suite, lint, build. Commit.

### Then

Opus browser check (375 / 1280 px), Opus final review, one fix wave, push, update the PR.
