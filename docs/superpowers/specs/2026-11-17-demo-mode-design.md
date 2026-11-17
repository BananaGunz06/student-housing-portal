# Demo mode: the real app with sample data and no database

Date: 2026-11-17 · Status: idea approved in chat ("yes, do demo mode first"); this short design awaits the owner's approval

## Why

New ideas (roommate chat next) should be clickable with believable data before any database work, so the owner can react to the screens and workflow while changes are still cheap. Today, seeing anything that involves accounts means creating real throwaway accounts in the live Supabase project, and the owner's real profile can turn up in screenshots.

## Goals

- `npm run demo` opens the full app on the owner's computer with sample data held in the browser's memory. Nothing is read from or written to Supabase.
- It feels like the real app: same screens, same behaviour, believable fictional people.
- Later features add their own sample data here, so they can be built and tried screens-first.
- Browser checks and README screenshots use demo mode instead of throwaway accounts.

## Non-goals and anti-goals

- Not grey-box wireframes and not a second copy of the screens: the real screens run unchanged.
- No change to `npm run dev`, the live site or the database. Demo code must not end up in the live site's bundle.
- No "Try the demo" link on the live site yet (possible later, as its own decision).
- It must never be mistaken for the real site: a demo screenshot always shows the banner.

## Approaches considered

1. **Plug a pretend backend into the real app (chosen).** The app gets all account data through one `Backend` object passed in at `src/App.tsx`, and tests already use a complete in-memory one (`src/test/fakeBackend.ts`). Demo mode reuses it with sample people. Smallest change, and every screen is the real one.
2. **Separate wireframe pages.** Hand-made mock screens for each idea. Rejected: everything gets built twice and the mock drifts from the real app.
3. **A separate Supabase project for testing.** Rejected: still needs accounts, setup and cleanup, and doesn't help try screens before the database exists.

## Design

- **Starting it:** `npm run demo` runs the dev server in demo mode on port **5174**. A different port keeps demo budget, filters and saved places apart from `npm run dev` (5173), because the browser stores them per address.
- **Choosing the backend:** `src/lib/backend/index.ts` picks the demo backend when the demo flag is set, and the Supabase one otherwise. The Supabase client is not created in demo mode. A normal `npm run build` must contain no demo code or sample people.
- **Where the code lives:** the in-memory backend moves from `src/test/fakeBackend.ts` to `src/lib/backend/memory.ts`, so tests and demo mode share one copy. `src/test/fakeBackend.ts` stays as a thin re-export so existing tests don't change. Sample people go in `src/lib/backend/demoData.ts`.
- **Sample data (fictional, per the project rules):**
  - About 8 students looking for roommates, with `example.com` emails and a mix of programs, years, move-in terms, budgets and bios. Some have no photo, so the initial circle shows; the rest use bundled illustrated avatars (no real photos, no outside image hosts).
  - One or two students with "Looking for roommates" off, so hidden profiles can be tried.
  - The visitor starts signed in as **"Demo Student"** (`demo@example.com`, password shown on the banner), with an empty profile, so profile setup can be tried. Logging out, signing in as a sample student, and creating a new account all work in memory.
- **Banner:** a slim bar at the top of every screen: "Demo mode: sample data, nothing is saved. Refresh to start over." It doesn't cover content or cause sideways scroll at 375 px.
- **Behaviour:** everything resets on page refresh. Photo uploads are kept in memory and shown from the browser. A small delay (about 300 ms) on backend calls keeps loading states visible. Demo mode never goes "offline" on its own.
- **README:** a "Try it without an account" note on `npm run demo`, and screenshots retaken from demo mode later, when they next need updating.

## Left to the builder

The exact environment flag name, how the delay is added, the illustrated avatars' look, and the sample people's names and bios (fictional and varied).

## Testing

- Unit: the demo backend starts with the sample students listed newest first, signed in as Demo Student; the Supabase backend is chosen when the flag is off.
- Build check: a normal production build contains none of the sample names (search the built files).
- Browser at 375 px and 1280 px in demo mode: banner visible on every tab, Students lists the sample students, a profile opens, profile setup saves, no sideways scroll, no console errors, and no network requests to the Supabase project.
