# Student community part 1: follow-ups left for later

Small items found in review and deliberately not fixed. None blocks merging.

- (step 1) loadProfile no-row branch returns an extra id field (supabase.ts)
- (step 1) saveProfile writes profiles and profile_private non-atomically (not fixing: see 2026-11-15 plan)
- (step 1) fakeBackend.test ordering test doesn't detect the upload bump (only removal)
- (step 1) avatars read policy doesn't require a non-empty display_name (list does)
- (step 1) policy subquery compares p.id::text, can't use the PK index
- (step 2) BUDGET_MIN/MAX duplicated from cost.ts
- (step 2) profile.test dates are UTC strings; add local-date boundary test
- (step 2) test gaps — toSquareJpeg unreadable, Avatar muted, AccountState avatar methods
- (step 3) "Message is dropped" test cannot fail (ProfileSetup.test.tsx) — use delayed onAuthChange and assert no message dialog
- (step 3) AccountProvider context value changes on every route change (useNavigate identity) — keep navigate in a ref
- (step 3) pending setup request could catch a different sign-in within 10s (not fixing: see 2026-11-15 plan)
- (step 4) break-words on truncated bio line is inert
- After deleting an account the app calls log-out for the deleted user and gets a 403 (visible only in the browser console). (not fixing: see 2026-11-15 plan)
- Bus routes: no test at exactly 151 m (uses 220 m); the data credit links to the Mobility Database page, not a City of Guelph licence page.
- Part 2 (direct messages) must extend the photo read rule to students who share a conversation.
