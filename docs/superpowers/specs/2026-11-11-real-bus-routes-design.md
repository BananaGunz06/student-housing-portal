# Real Guelph Transit routes

Date: 2026-11-11 · Status: design approved in chat ("Yes")

## Why

The map and commute estimates use 4 hand-made sample routes. Students judge a place partly by how they'd get to campus, so the routes, stops and ride times should be Guelph Transit's real ones.

## Source

- Guelph Transit's official GTFS feed, from the Mobility Database (`https://files.mobilitydatabase.org/mdb-3140/latest.zip`; catalogue page `https://mobilitydatabase.org/feeds/gtfs/mdb-3140`). City of Guelph open data licence: credit "Transit data: City of Guelph".
- The latest copy is the **Winter 2026** schedule (service 4 Jan – 2 May 2026). The app says which schedule it uses; re-running the script picks up a newer feed.
- The zip is not committed. The script downloads it (or takes a local path) and writes small generated files that are committed.

## What changes

1. **Converter script** `scripts/build-transit-from-gtfs.mjs` (pure helpers in `scripts/lib/gtfs.mjs`, unit-tested):
   - **Routes:** keep regular routes that run on weekdays; drop charters, shuttles and school specials (`BREW`, `ZehrsGS`, `HMidGCS`, `HMidUC`). Each route keeps Guelph Transit's colour, short name (e.g. `99`, `50 U`) and long name.
   - **Route lines:** every distinct shape of a route, simplified to about 10 m accuracy (Douglas–Peucker), drawn as one multi-line per route.
   - **Stops:** every stop served by a kept route, with the routes serving it.
   - **Ride time to campus:** campus = the University Centre loop (stops whose name starts "University Centre"). For each stop and route, the typical scheduled minutes from that stop to the University Centre on the same weekday trip (stop comes earlier in the trip), using trips that reach the University Centre between 7:00 and 10:00, median rounded up. Stored on the stop as `toCampus: { [routeId]: minutes }`.
   - **Meta:** `src/data/transit/meta.json` with the feed's service start and end dates, a schedule label ("Winter 2026"), source URL and generated date.
2. **Commute estimate** (`src/lib/commute.ts`):
   - Walk-only stays as today (≤ 15 min walk, or no slower than the bus, shows walking).
   - Bus: consider stops within a **15-minute walk**; for each stop and route with a `toCampus` time, total = walk to stop + ride. Pick the smallest. Waiting time is not included (stated in the copy, as today).
   - **One transfer (added after the first build, owner's choice):** the converter also stores, per stop, the best trip with one change of bus anywhere on the network: ride on route A to a stop where route B goes directly to the University Centre, plus **5 minutes to change**, using the same weekday timetable and morning window. Stored as `viaTransfer: { minutes, firstRoute, secondRoute, transferStop }`. In the app, each stop within a 15-minute walk offers its direct rides and its one-transfer trip, and the app picks the minimum total (walk to stop + ride). A transfer trip reads "≈10 min walk to stop · Route 9 then Route 99 (change at <stop>) · ≈34 min to campus, 1 transfer" (cards: "≈34 min by bus to campus, 1 transfer"). These count in the "Longest commute" filter like any other time.
   - **No bus nearby:** if no stop within a 15-minute walk has a direct or one-transfer ride, the commute is the walk with `noBusNearby: true`, shown as "≈N min walk to campus (no bus nearby)" (short form "≈N min walk"). It counts in the "Longest commute" filter with its minutes like any walk. There is no "Transfer needed" state.
3. **Map:** real route lines in their colours; stops drawn only when zoomed in (zoom ≥ 15) so 600+ dots don't clutter the city view; campus marker at the University Centre. The mini-map on a listing draws the chosen route and the walk to its stop.
4. **Copy and credit:** the map notice says "Bus routes: Guelph Transit, Winter 2026 schedule"; the map attribution adds "Transit data: City of Guelph"; the listing's commute note says times come from the timetable and don't include waiting. README "About the data" updated. The old sample-network script and its "sample" wording are removed.
5. **Also fixed here (parked from accounts review):** Welcome and README copy "Your budget stays on this device" → "Your budget stays on this device unless you sign in."

## Out of scope

Real-time arrivals, multi-transfer journey planning (one change of bus is supported), weekend or evening schedules, walking along real streets (still straight line × 1.3).

## Testing

- Unit: GTFS parsing on a tiny fixture feed (route filtering, shape simplification keeps endpoints and tolerance, ride-time median and the 7–10 window, stop→routes), commute (walk, direct bus, nearest-of-several, one-transfer, no-bus-nearby walk, short walk never flagged).
- Data sanity: generated files load; every kept route has a colour and a line; the University Centre stops exist; a known stop on Gordon St has a ride time to campus on a route that serves it; total bundle growth stays small (generated GeoJSON under ~250 KB).
- Flow tests updated for the new copy; browser check (375 and 1280 px): routes visible, stops appear when zoomed, a listing shows a real route number, no console errors, no horizontal scroll.
