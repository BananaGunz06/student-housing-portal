# Student community: profiles, Students tab, direct messages

Date: 2026-11-12 · Status: design approved in chat ("yes"); written spec awaiting the owner's review

## Why

The app should feel like a community of students looking for a place to live in Guelph, not only a listings search. Reaching another student should be as easy as on Instagram: see a person, tap, message. Everything here serves the housing goal (finding a place and people to share it with). No feeds, likes or followers.

## Decisions already made by the owner

- Profiles are visible to signed-in students only.
- Profile fields: photo, bio, program and year, move-in term, monthly budget, "Looking for roommates". All optional.
- Profile setup is offered right after sign-up, can be skipped, and is editable later in Account. Then the student lands on the listings.
- Features: profile pages, a Students tab, direct messages. No follow.
- The Students tab lists only students who switched on "Looking for roommates".
- When a student deletes their account, the messages they sent are kept. The other student sees them as from a "Deleted student", visually muted, and can't reply.

## Build order

Two parts, each with its own implementation plan and its own SQL file. Part 2 depends on part 1.

---

## Part 1: profiles and the Students tab

### Profile fields

| Field | Rule |
|---|---|
| Name | already exists (`display_name`, up to 80 characters) |
| Photo | optional; JPEG, PNG or WebP up to 5 MB; cropped to a square and resized in the browser to 512 px JPEG before upload |
| Bio | optional, up to 300 characters |
| Program | optional, up to 80 characters |
| Year | optional: 1st, 2nd, 3rd, 4th, 5th or later, Graduate |
| Move-in term | optional: one of the next six terms (Winter, Summer, Fall + year) |
| Monthly budget | optional, $300–$5000. The form offers the student's search budget as a starting value; it is shared only if they save it on the profile |
| Looking for roommates | switch, off by default |

A student with no photo gets a coloured circle with their initial.

### Screens

- **Set up your profile** (`/profile/setup`): shown once, right after a successful sign-up. One screen with the fields above, a **Save and continue** button and an equally visible **Skip for now**. Both go to `/results`. Exception: if the sign-up started from an action on a listing (Save or Message), both return to that listing so the student can finish what they started.
- **Account:** gains the same form ("Your profile") and a "View my profile" link. Name and phone stay where they are.
- **Profile page** (`/students/:id`): photo, name, program and year, move-in term, budget, "Looking for roommates" badge, bio. In part 1 the Message button is not shown; part 2 adds it. A signed-out visitor sees the sign-in prompt. An unknown, hidden or deleted profile shows "This profile isn't available."
- **Students tab** (`/students`): cards (photo, name, program · year, move-in term, budget, first line of bio) for students looking for roommates who have a name, most recently updated first, 30 at a time with "Show more". Filters: move-in term; budget band (Any, up to $600, $600–800, $800–1000, over $1000). The student's own card is not listed. Empty state: "No students are looking for roommates yet. Switch on 'Looking for roommates' in your profile to be the first." Signed out: a short explanation and a Sign in button.
- **Navigation:** the bottom bar becomes **Places, Students, Saved, Messages, Account**. The separate Map item goes; the map stays one tap away through the List / Map toggle on the results page (and is always visible on laptops). Six items don't fit a 375 px phone.

### Data and privacy

- `profiles` gains `bio`, `program`, `year`, `move_in_term`, `budget`, `looking_for_roommates`, `avatar_path`.
- **Phone moves out of `profiles`** into a new `profile_private` table that only its owner can read or write, because `profiles` rows become readable by other students. The migration copies existing phone numbers across and drops the old column. Email is never stored in `profiles`.
- **Who can read a profile row:** its owner; any signed-in student if the row has "Looking for roommates" on. (Part 2 adds: a student you share a conversation with.) Signed-out visitors can read nothing.
- **Photos:** private Supabase storage bucket `avatars`, one file per student at `<user id>/avatar.jpg`. Signed-in students can read; only the owner can upload, replace or remove their own file. The app shows photos through short-lived signed links.
- **Deleting an account** removes the photo, then the account (the profile rows go with it).
- All of this goes through `src/lib/backend/` (new methods on `Backend`; the fake backend gets the same methods and a few fictional sample students for tests).
- SQL: `supabase/migrations/0002_profiles.sql`, run once by the owner in the SQL Editor when the code is ready.

### Errors

- Photo too large or wrong type: message under the picker, nothing uploaded.
- Upload or save fails (offline): the form keeps what was typed and says "Couldn't save. Check your connection and try again."
- Students list fails to load: a message with a Try again button; the rest of the app is unaffected.

---

## Part 2: direct messages

### Behaviour

- **Start a chat:** a **Message** button on a profile page opens the conversation with that student (creating it on the first message). One conversation per pair of students.
- **Chat screen** (`/messages/s/:id`): the other student's photo and name at the top (tap to open their profile), messages oldest to newest, a text box and Send. Text only, up to 2000 characters.
- **Messages tab:** two groups, **Students** (real chats, newest first, with an unread dot and the last message) and **Places** (the existing demo messages to posters, unchanged).
- **Unread count** on the Messages item in the bottom bar: the number of student conversations with unread messages. Opening a chat marks it read.
- **Delivery:** really delivered and stored. New messages arrive live while the app is open (Supabase Realtime), and the lists also refresh when the app regains focus. No push notifications.
- **Profile visibility:** once two students share a conversation, each can open the other's profile even if "Looking for roommates" is off.

### Safety

- **Block** (from a profile or a chat): the blocked student can't send you messages or start a chat, and neither of you appears in the other's Students tab. The blocked student sees "You can't message this student." Unblock from the same menu.
- **Report** (from a profile or a chat): pick a reason (Spam or scam, Harassment, Fake profile, Something else) and add an optional note. Reports are stored for the owner to read in the Supabase table view. No admin screen.

### Deleted students

- The account, profile, photo and name are removed. Message text is kept.
- **Messages list:** the chat stays, with a grey placeholder circle and the name "Deleted student".
- **In the chat:** their messages stay readable but muted (grey bubble, lighter text). A notice replaces the text box: "This student deleted their account. You can't reply."
- The name and photo are not tappable.

### Data

- `conversations` (the two students, last message time), `direct_messages` (conversation, sender, text, time), `conversation_reads` (when each student last read), `blocks`, `reports`.
- Student references are cleared, not cascaded, when an account is deleted, so messages survive.
- Row-level security: only the two participants can read a conversation and its messages; a message can be sent only by a participant who isn't blocked, to a student who still exists; blocks are readable only by the blocker; reports can be written but not read by students.
- SQL: `supabase/migrations/0003_direct_messages.sql`, run once by the owner.

---

## Out of scope

Follow, feeds, likes, comments, group chats, photos or link previews in chats, read receipts, typing indicators, push or email notifications, an admin or moderation screen, real delivery of messages to listing posters, verifying that an account belongs to a U of G student.

## Known limits

- The Students tab is empty in the live app until real students switch on "Looking for roommates". No fake students are added to the real database.
- Anyone with an email address can sign up; "students only" means "signed-in users".

## Testing

- Unit: profile validation (lengths, year, term list, budget range), photo checks (type, size), Students filters, unread counting, deleted-student display rules.
- Component and flow (fake backend): sign-up → setup → Skip lands on results; sign-up from a listing action returns to the listing; edit profile in Account; Students tab lists only roommate seekers and never the viewer; filters; signed-out states; send a message and see it in both students' lists; unread badge clears on open; block hides and stops messages; report is recorded; deleted student shows muted with no reply box.
- Database rules: a checklist of manual checks against the real project with two test accounts (cannot read a hidden profile, another student's phone, another pair's messages, or anyone's reports).
- Browser checks at 375 px and 1280 px: no horizontal scroll, five nav items fit, forms usable with the keyboard, no console errors.
