# Student community part 1: follow-ups left for later

Small items found in review and deliberately not fixed. None blocks merging.

- (step 1) loadProfile no-row branch returns an extra id field (supabase.ts)
- (step 1) saveProfile writes profiles and profile_private non-atomically
- (step 1) fakeBackend.test getStudent('user-2') relies on generated ids
- (step 1) listStudents signs the limit+1 row's link it never uses
- (step 1) fakeBackend.test ordering test doesn't detect the upload bump (only removal)
- (step 1) avatars read policy doesn't require a non-empty display_name (list does)
- (step 1) policy subquery compares p.id::text, can't use the PK index
- (step 2) name note not in aria-describedby / not role=status
- (step 2) bio counter counts untrimmed, validation trimmed
- (step 2) LoadedForm has no key on user change
- (step 2) stored far-future term prepended out of order
- (step 2) BUDGET_MIN/MAX duplicated from cost.ts
- (step 2) profile.test dates are UTC strings; add local-date boundary test
- (step 2) test gaps — toSquareJpeg unreadable, Avatar muted, AccountState avatar methods
- (step 3) "Message is dropped" test cannot fail (ProfileSetup.test.tsx) — use delayed onAuthChange and assert no message dialog
- (step 3) AccountProvider context value changes on every route change (useNavigate identity) — keep navigate in a ref
- (step 3) pending setup request could catch a different sign-in within 10s
- (step 3) Account "Saved" role=status mounted with text (may not announce); test not scoped to the section
- (step 3) safeReturnTo accepts "/\\host"
- (step 4) select inside label → name read with chosen option
- (step 4) status texts not live regions; profile page loading/error states lack h1
- (step 4) break-words on truncated bio line is inert
- (step 4) Show more stuck if a whole page is duplicates (30+ joined between clicks)
- (step 4) StudentProfile.test hard-codes 'user-2'
- (step 4) offset paging skips a student when someone leaves the list between pages (needs keyset paging)
- After deleting an account the app calls log-out for the deleted user and gets a 403 (visible only in the browser console).
- Bus routes: no test at exactly 151 m (uses 220 m); the data credit links to the Mobility Database page, not a City of Guelph licence page.
- Part 2 (direct messages) must extend the photo read rule to students who share a conversation.
- Listing mini-map: the "This place" label and the "≈N min walk" label overlap when the stop is close to the listing.
