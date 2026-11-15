# Project notes: where things stand

Last updated: 2026-11-13. Written so a future session can pick up without the earlier conversation. `CLAUDE.md` holds the working rules; this file holds the history, decisions and open items.

## State right now

- **Paused by the owner** on 2026-11-13, after the part 2 plan was written. Nothing is being built.
- **`main` has everything built so far** and publishes to https://bananagunz06.github.io/student-housing-portal/ (GitHub Pages, via `.github/workflows/deploy.yml`).
- **Working branch:** `claude/serene-lovelace-hziayf`. After each merge it is fast-forwarded to `main` and reused. At the pause it holds two commits not yet on `main`: the part 2 plan and this file. No pull request is open.
- **Waiting on the owner:** approval of the part 2 plan (`docs/superpowers/plans/2026-11-13-student-community-part2.md`).

## What has been built (all merged)

| Pull request | Contents |
|---|---|
| #1 | Version 1: budget-first search, true monthly cost, results, map, listing detail, saved, compare |
| #2 | Accounts with sync (Supabase), in-app "contact the poster" demo messaging, filter sidebar |
| #3 | Real Guelph Transit routes with one-transfer trips; laptop side-by-side list and map; centred pop-ups; student profiles, profile setup after sign-up, Students tab, profile pages |
| #4 | README screenshots retaken; profile photo shown once on Account; the owner's ideas file |

## How the owner wants to work

- Plan first (spec, then plan), and get approval before building. A design approval only permits writing the spec; a spec approval only permits writing the plan.
- Keep usage low: few large build steps, one builder at a time (Sonnet; Haiku for docs), resume a builder for its own fixes, one Opus review per part at the end, nothing in parallel. This replaced an earlier per-step review workflow on 2026-11-12.
- Do not open a pull request unless asked. Never merge; the owner merges.
- The owner is not a developer by trade here: explain in plain language, say exactly what they need to click or run, and give file paths.

## Supabase

- Project URL and the publishable key are in `.env` (committed on purpose; the publishable key is safe in the browser). Never commit or ask for the secret / service_role key.
- Email confirmation is turned off for the demo.
- **Migrations run by the owner:** `0001_accounts.sql` and `0002_profiles.sql`. `0003_direct_messages.sql` does not exist yet (part 2, step 1).
- The owner runs every migration by hand in the SQL Editor. Tell them only when the file is final, and remember that a migration changes the live site's database immediately, before the matching code is merged. (`0002` moved phone numbers to a new table while `main` still had the old code, which broke profile loading on the live site until #3 was merged.)
- `profiles` rows are readable by other signed-in students only while "Looking for roommates" is on. Phone lives in `profile_private`, owner-only. Photos are in the private `avatars` bucket at `<user id>/avatar.jpg`, readable by the owner or while the owner is visible. Part 2 must extend both rules to students who share a conversation.
- The owner has a real account and a real profile that appears in the Students tab. Keep it out of screenshots and test output (filter the list, or use throwaway accounts only).

## Decisions made along the way

- **Commutes:** walk if the walk to campus is 15 minutes or less, or no slower than the bus. Otherwise the best direct or one-transfer trip from a stop within a 15-minute walk. A change of bus adds 5 minutes, plus the walk when the second bus leaves from a different stop within 150 m. Waiting time is not included. With no reachable bus: "≈N min walk to campus (no bus nearby)".
- **Bus data:** Guelph Transit GTFS from the Mobility Database (feed mdb-3140), Winter 2026 schedule, converted by `scripts/build-transit-from-gtfs.mjs`. Routes without a plain number are shown by their long name.
- **Students tab:** lists only students who switched on "Looking for roommates" and have a name. No fake students in the real database, so it starts nearly empty.
- **Deleted accounts (part 2):** sent messages are kept; the other student sees "Deleted student", muted messages and no reply box.
- **Bottom bar:** Places, Students, Saved, Messages, Account. The map is reached with the List / Map toggle.
- **After sign-up from a listing action:** Save is completed; Message is dropped (one more tap), and the student returns to that listing after the profile step.
- **"Students only"** means signed-in users. There is no University of Guelph email check.

## Open items

1. **Part 2, direct messages.** Plan written, awaiting approval. It adds four things the spec did not state: a 30-messages-a-minute limit, loading 50 messages at a time, blocking hides profiles both ways, and a deleted student cannot be reported.
2. **The owner's seven map and listing ideas:** `docs/superpowers/ideas/2026-11-13-map-and-listing-feedback.md`. Not designed. Each needs the full plan-first path.
3. **Small follow-ups from the part 1 review:** `docs/superpowers/plans/2026-11-12-student-community-part1-followups.md`. None blocks anything.
4. **Deferred earlier and never done:** the budget ruler and dark mode.
5. **Later, per the owner:** the landlord / posting side (listing titles as "type of place + address" belong there), and real delivery of messages to posters.

## Things that went wrong, worth remembering

- **Stale pull request state.** A pull request was merged by the owner while later work kept going onto the same branch, and status reports kept saying "don't merge it yet". Check the pull request's real state before reporting on it, and after a merge, fast-forward the branch to `main` before new work.
- **GitHub Pages was switched off once.** The publish step failed with "Ensure GitHub Pages has been enabled" and the live link stopped working. The fix is in the repository's Settings → Pages (Source: GitHub Actions), which only the owner can change.
- **Tests failing under load.** Three UI tests each failed once when the full suite ran next to a dev server. The waits were lengthened in `src/test/setup.ts` and `vite.config.ts`. Stop any dev server before judging a full test run.
- **Layout bugs are invisible to unit tests.** The laptop map stretching to thousands of pixels, a sideways scroll at 375 px and pop-ups drawn under the map were all found only in a real browser. Measure in a browser (375 px, 1024 px, 1280 px) before calling layout work done.
- **Fixing one layering bug caused another.** Giving the details panel its own stacking context hid its pop-ups under the map. The panel must not create a stacking context.
- **Usage limits.** A builder was cut off mid-task by the plan's 5-hour limit. Unfinished work was saved as a clearly labelled work-in-progress commit only after tests, lint and build passed; otherwise it was stashed.

## Practical notes for a cloud session

- The session cannot open the live site or `github.io` (blocked by its network rules), but it can reach the Supabase project. Node needs `NODE_USE_ENV_PROXY=1` for its built-in `fetch` to get through the proxy.
- Real-project checks use throwaway accounts with `example.com` emails, created through the app or supabase-js and deleted afterwards. Check the `avatars` bucket is empty after photo tests.
- Browser checks use the pre-installed Playwright against `npm run dev`. Earlier check scripts lived in the session's scratch folder and are gone; rewrite them as needed.
- The sub-agent ledgers under `.superpowers/` are git-ignored and do not survive a fresh clone.
