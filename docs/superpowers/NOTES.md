# Project notes: where things stand

Last updated: 2026-11-17. Written so a future session can pick up without the earlier conversation. `CLAUDE.md` holds the working rules; this file holds the history, decisions and open items. Check the real state of `main`, the branch and any pull request before trusting the "State right now" section.

## State right now

- **`main`** has everything up to demo mode (#7) and publishes to https://bananagunz06.github.io/student-housing-portal/ (GitHub Pages, via `.github/workflows/deploy.yml`).
- **Working branch:** `claude/busy-dijkstra-xj8nbg`. After each merge it is fast-forwarded to `main` and reused. At the last update it holds **move-in by term and length of stay**, built, reviewed and browser-checked but **not merged and with no pull request yet**, plus this housekeeping.
- **Next, in order:** a pull request for move-in by term when the owner asks; then the **roommate chat** design (see "Roommates" below), built screens-first in demo mode.
- **Old branch** `claude/serene-lovelace-hziayf` is fully merged and can be deleted by the owner on GitHub.

## What has been built (all merged unless noted)

| Pull request | Contents |
|---|---|
| #1 | Version 1: budget-first search, true monthly cost, results, map, listing detail, saved, compare |
| #2 | Accounts with sync (Supabase), in-app "contact the poster" demo messaging, filter sidebar |
| #3 | Real Guelph Transit routes with one-transfer trips; laptop side-by-side list and map; centred pop-ups; student profiles, profile setup after sign-up, Students tab, profile pages |
| #4 | README screenshots retaken; profile photo shown once on Account; the owner's ideas file |
| #5 | These notes and the (later rejected) direct messages plan |
| #6 | Part 1 follow-ups: Students list pages by position (keyset), profile form fixes, screen-reader fixes, safe return link after sign-up, mini-map walk label |
| #7 | Demo mode: `npm run demo`, the real app with fictional sample data in memory and no database |
| not yet | Move-in by term (Winter / Summer / Fall + year) and length of stay (4, 8, 8+ months); bedrooms off the first screen; sublet note on longer leases |

## How the owner wants to work

- Plan first (spec, then plan), and get approval before building. A design approval only permits writing the spec; a spec approval only permits writing the plan.
- Keep usage low: few large build steps, one builder at a time (Sonnet; Haiku for docs), resume a builder for its own fixes, one Opus review per part at the end, nothing in parallel.
- Do not open a pull request unless asked. Never merge; the owner merges.
- The owner is not a developer by trade: explain in plain language, say exactly what to click or run, give file paths.
- The owner tests ideas with real students (a friend gave the roommate feedback below) and brings back screenshots of the app with notes. Treat that as design input, not as approval to build.
- Purpose check: the app is a clean, budget-first housing search for U of G students. Features must serve finding a place (and the people to share it with); the owner rejected anything that turns it into a social app.

## Decisions made along the way

- **Commutes:** walk if the walk to campus is 15 minutes or less, or no slower than the bus. Otherwise the best direct or one-transfer trip from a stop within a 15-minute walk. A change of bus adds 5 minutes, plus the walk when the second bus leaves from a different stop within 150 m. Waiting time is not included.
- **Bus data:** Guelph Transit GTFS from the Mobility Database (feed mdb-3140), Winter 2026 schedule, converted by `scripts/build-transit-from-gtfs.mjs`.
- **Terms:** Winter = Jan–Apr, Summer = May–Aug, Fall = Sep–Dec, stored as `YYYY-season` (e.g. `2027-fall`). Used by profiles and (once merged) by the move-in filter. Listings start in January, May or September and run 4, 8 or 12 months. A lease longer than the student needs is shown with "you'd sublet the last N months"; a shorter one is hidden.
- **First screen:** budget, then "Which term do you move in?" and "For how long?", always visible and optional. Bedrooms are only in the side filter.
- **Students tab:** lists only students who switched on "Looking for roommates" and have a name. No fake students in the real database.
- **Bottom bar:** Places, Students, Saved, Messages, Account. The map is reached with the List / Map toggle.
- **"Students only"** means signed-in users. There is no University of Guelph email check.
- **It's a portfolio prototype** (the owner's GitHub; audience: recruiters, a few students, maybe a professor). Listings and posters stay fictional; messages to posters stay a labelled demo until a landlord side exists.

## Roommates (agreed direction, not yet designed in a spec)

- **Rejected on 2026-11-16:** the part 2 plan for general student-to-student direct messages with a "Students" group in Messages. The owner felt it turned the app into social media. The plan file is kept, marked not approved.
- **Feedback from a student** (Waterloo / Laurier housing groups): a general community has no point here, but finding roommates does. Two cases: listings that rent one room of five vs. the whole house to a group; and "I found a great 2-bed within budget but the landlord wants both rooms filled". Also, students sometimes post themselves and landlords contact them (parked with the landlord side).
- **Agreed so far:**
  - The Students tab's purpose is finding roommates to rent a place together.
  - **Roommate chat (part A, next):** a "Message" button only for students who are looking for roommates, from their card or profile (e.g. "Message Sam about rooming together"); **one Messages list** (no Students / Places groups), each row saying what it is about ("Roommate · 2-bed on Dean Ave", "To the poster · waiting for reply"); text only; real delivery; unread count; block and report kept; messages to posters stay a demo. Needs a new `0003` migration.
  - **Roommate details (part B, after):** living habits on profiles (cleanliness, noise, sleep, pets, smoking), listings showing "1 of 5 rooms" or "whole place", per-person cost against the budget, and attaching a place to your search ("Needs 1 roommate for: 2-bed on Dean Ave · $1,150 each").
- **Data gap:** only 6 of 40 sample listings have more than one bedroom, so part B needs more multi-bedroom sample places.

## Supabase

- Project URL and the publishable key are in `.env` (committed on purpose). Never commit or ask for the secret / service_role key.
- Email confirmation is turned off for the demo.
- **Migrations run by the owner:** `0001_accounts.sql` and `0002_profiles.sql`. No `0003` exists yet. Two items wait for it: the photo read rule should also require a non-empty name, and its lookup should use the primary key.
- The owner runs every migration by hand in the SQL Editor. Tell them only when the file is final; a migration changes the live database immediately, before the matching code is merged. (`0002` once broke profile loading on the live site until #3 was merged.)
- `profiles` rows are readable by other signed-in students only while "Looking for roommates" is on. Phone lives in `profile_private`, owner-only. Photos are in the private `avatars` bucket at `<user id>/avatar.jpg`.
- The owner has a real account and profile that appears in the Students tab. Keep it out of screenshots and test output.

## Open items

1. Pull request for move-in by term (built, waiting for the owner).
2. Roommate chat design (part A), then roommate details (part B).
3. The owner's seven map and listing ideas: `docs/superpowers/ideas/2026-11-13-map-and-listing-feedback.md`, plus one found since: the map notice counts over-budget places too ("11 places" beside "2 places" in the list); it could say "including over budget".
4. Remaining small follow-ups: `docs/superpowers/plans/2026-11-12-student-community-part1-followups.md`. None blocks anything.
5. Deferred and never finished: the budget ruler (`src/lib/ruler.ts` exists, no screen uses it) and dark mode.
6. Later, per the owner: the landlord / posting side, real delivery of messages to posters, and listing titles as "type of place + address".

## Things that went wrong, worth remembering

- **Stale pull request state.** A pull request was merged while status reports still said "don't merge it yet". Check the real state before reporting, and after a merge fast-forward the branch to `main`.
- **A plan that drifted from what the owner meant.** The direct messages plan followed the written spec, but the owner remembered agreeing to something narrower and rejected it. Before planning a feature, play back its purpose in the owner's words and check it still serves "find a place within budget".
- **GitHub Pages was switched off once.** Fix: repository Settings → Pages → Source: GitHub Actions (only the owner can change it).
- **Tests failing under load** next to a running dev server. Stop any dev server before judging a full test run.
- **Layout bugs are invisible to unit tests.** The laptop map stretching, sideways scroll at 375 px, pop-ups under the map, the walk label under the map credit, and the demo banner adding page scroll were all found only in a real browser. Measure at 375 px and 1280 px before calling layout work done.
- **Tests that depend on today's date** break later (a term test would have failed from September 2027). Pin the clock in tests that use `upcomingTerms(new Date())` with the sample data.
- **Demo mode resets on any full page load.** Browser-check scripts must navigate inside the app (click links) after the first load; `page.goto` starts the demo over.
- **Usage limits.** A builder was once cut off mid-task. Save unfinished work only as a clearly labelled work-in-progress commit after tests, lint and build pass; otherwise stash it. Don't commit a running builder's half-done files because a hook asks for it.

## Practical notes for a cloud session

- The session cannot open the live site or `github.io`, but it can reach the Supabase project. Node needs `NODE_USE_ENV_PROXY=1` for its built-in `fetch` to get through the proxy.
- Browser checks use the pre-installed Playwright against `npm run demo` (port 5174). Check scripts live in the session's scratch folder and are gone afterwards; rewrite them as needed.
- **Showing the owner the demo on a phone or iPad:** build it with `npx vite build --mode demo --outDir <scratch>/demo-dist`, serve that folder on port 5174 with a small static server that falls back to `index.html`, and report the port to the Claude app (it shows a preview). It works only while the session is awake and shows the branch's current code.
- The sub-agent ledgers under `.superpowers/` are git-ignored and do not survive a fresh clone.
