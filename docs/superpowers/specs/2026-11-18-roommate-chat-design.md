# Roommate chat

Date: 2026-11-18 · Status: direction and sketches approved by the owner in chat (2026-11-17); this written design awaits the owner's approval. Replaces part 2 of `2026-11-12-student-community-design.md`, whose plan the owner did not approve.

## Why

The app is a budget-first housing search for University of Guelph students. Many good places need more than one person: a whole house signed by a group, or a 2-bed where the landlord wants both rooms filled. The Students tab already lists students looking for roommates, but there is no way to reach them, so it is a dead end. A student who has asked around housing groups confirmed: a general community adds nothing here, but finding roommates does.

The owner rejected a general "direct messages" feature because it turned the app into social media. This design keeps chat narrow: it exists so possible roommates can talk about living together.

## Goals

- From the Students tab, a student can message someone who is looking for roommates, and the two can talk it through in the app.
- Messages really arrive, live while the app is open, with an unread count.
- Students can block or report someone who misuses it.
- The Messages tab stays one simple list.

## Non-goals and anti-goals

- No messaging a student who isn't looking for roommates, no group chats, no follows, likes, feeds or "people you may know".
- No photos, links previews, typing indicators, read receipts or push / email notifications.
- No change to messages to posters: they stay the labelled demo they are.
- No admin screen; reports are read in the Supabase table view.
- Anti-goal: anything that makes the app feel like a social network rather than a housing search.
- Not in this part: living habits, "1 of 5 rooms" on listings, per-person cost, attaching a place to your search (part B, designed after this).

## Approaches considered

1. **Real chat, built screens-first (chosen).** Build the screens and an in-memory chat in demo mode first; the owner clicks through with sample students and reacts; only then write the database file and connect the real backend. Cheap to change while it is still in demo mode.
2. **Real chat, database first** (the rejected part 2 plan's order). The owner sees nothing until the database is done and run.
3. **A one-time introduction** (a note plus chosen contact details, no thread) or **a contact line on profiles**. Lighter, but the owner chose a real conversation once its purpose was clear.

## What students see

**Starting a chat.** On a Students card and on that student's profile, a button "Message <first name>". It appears only when that student has "Looking for roommates" on, never on your own profile, and only for signed-in students (signed out, the existing sign-in prompt shows). If you already have a chat with them, it opens that chat. A small line under the button says what it is for: "Talk about rooming together."

```
Sam K.
Biology · 2nd year · Moving in Fall 2027 · $750 a month
[ Message Sam ]
Talk about rooming together.
```

**The Messages tab: one list, newest first.** Roommate chats and the existing messages to posters are mixed in one list. Each row says what it is about:

```
Messages
(S) Sam K.       Roommate                        2:14 pm  ●
    You: Are you still looking for Fall?
[🏠] Dean Ave     To the poster · waiting for reply   Mon
(P) Priya R.     Roommate                        Sun
    Sounds good, talk soon
```

- A roommate row: photo, name, "Roommate", the last message ("You: …" when yours), time, and an unread dot (with hidden text "Unread" for screen readers).
- A poster row: as today, labelled "To the poster", still "waiting for reply".
- The demo note ("messages to sample listings aren't delivered…") applies only to poster messages, so it moves to the poster conversation screen and the message form, where it already appears, and leaves the top of the list.
- Empty list: "No messages yet. Message a place's poster from its listing, or a student from the Students tab."

**The chat screen** (`/messages/s/:chatId`):

- Header: the other student's photo and name (a link to their profile), and a "⋯" menu with Block / Unblock and Report.
- Messages oldest to newest in bubbles: yours dark on the right, theirs light on the left, with times. "Show earlier messages" when there are more than 50.
- A text box and Send above the bottom bar. Enter sends, Shift+Enter makes a new line; the box clears and keeps focus. Text only, 1–2000 characters.
- The screen scrolls to the newest message when it opens and when one arrives. Opening it, or receiving a message while it is open, marks the chat read.
- If sending fails, the text stays and a message says why: "Couldn't send. Check your connection and try again.", "You can't message this student.", or "You're sending messages too fast. Wait a moment and try again."

**Unread count:** the Messages item in the bottom bar shows the number of roommate chats with unread messages, like "Messages (2)". Nothing at zero.

**Profiles between chat partners:** once two students have a chat, each can open the other's profile even if "Looking for roommates" is off (so you can always see who is messaging you).

## Safety

- **Block** (from a profile or the chat menu): asks "Block <name>? They won't be able to message you, and you won't see each other in Students." The blocked student's sends fail with "You can't message this student." Neither sees the other in Students or can open the other's profile. The existing chat stays readable for both. Unblock from the same menu.
- **Report** (from a profile or the chat menu): a reason (Spam or scam, Harassment, Fake profile, Something else) and an optional note up to 500 characters. Afterwards: "Thanks. Your report was sent." Stored for the owner; students can't read reports.
- **Sending limit:** 30 messages a minute per student, enforced in the database.
- **Deleted accounts:** the chat stays with "Deleted student" and a grey circle, their messages muted, and "This student deleted their account. You can't reply." instead of the text box. Name and photo aren't links. A deleted student can't be reported.

## Demo mode

- The in-memory backend gets the same chat behaviour, so everything above works in `npm run demo`.
- Demo Student starts with two sample chats: one unread from a sample student, one where Demo Student sent the last message.
- When Demo Student messages a sample student, that student replies a few seconds later with a short canned reply ("Hi! Yes, still looking. What area are you thinking?"), so live delivery and the unread count can be felt without a second person.

## Data (part of the database step)

- New tables: conversations (the two students, last message time), messages (conversation, sender, text, time), read times per student, blocks, reports. One conversation per pair of students.
- A deleted account clears its references instead of deleting messages, so the other student keeps the history.
- Rules in the database: only the two students in a conversation can read it; sending, marking read and starting a conversation go through database functions that check participation, blocks, the sending limit, that the recipient still exists, and that a **new** conversation can only be started with a student who has "Looking for roommates" on (an existing conversation continues even if they later switch it off). Blocks are readable only by the blocker; reports can be written but not read.
- Profile and photo read rules widen to chat partners and narrow for blocked pairs. The two waiting follow-ups go in too: photos are readable only when the owner has a name, and the photo rule's lookup uses the primary key.
- Live delivery uses Supabase Realtime on the messages table.
- One file, `supabase/migrations/0003_roommate_chat.sql`, safe to run twice, run by the owner once the code is ready. Running it before the code is merged is safe: it only adds tables and widens profile reading for chat partners.
- The rejected part 2 plan's database section is a usable starting point for this.

## Build order

1. **Screens and demo chat.** In-memory chat in the backend interface, the Message button, the one-list Messages tab, the chat screen, unread count, block and report, deleted-student display, demo sample chats and replies. No database work.
2. **Owner checkpoint.** The owner clicks through in demo mode (laptop or iPad preview) and asks for changes. Changes are made before going on.
3. **Database and real backend.** `0003_roommate_chat.sql`, the Supabase adapter, realtime. The owner runs the file when told it is final.
4. **Checks.** Database rules with three throwaway `example.com` accounts (deleted afterwards); browser checks in demo mode at 375 px and 1280 px; one live two-browser check against the real project; one Opus review; one fix pass.

## Left to the builder

Exact component split, the realtime subscription details, the demo reply timing, and the visual details of bubbles and the menu within the app's existing style.

## Testing

- Unit: message validation (empty, whitespace, 2001 characters), unread counting, the "who can be messaged" rule, deleted-student display.
- Component and flow (memory backend): Message button only on roommate seekers and never on your own profile; first message creates one chat, a second tap opens the same one; both students see it in one Messages list with poster rows still there; unread dot and bottom-bar count, cleared on open; live arrival in an open chat doesn't count as unread; Enter / Shift+Enter; failed send keeps the text; block stops sends and hides both from Students; unblock restores; report recorded; deleted student shown muted with no text box; chat partner's profile readable with the switch off; a student who switched off can't receive a new chat but an existing one continues.
- Database: a checklist against the real project with three throwaway accounts (a third student can't read or write a pair's chat; blocked sends fail; reports and blocks unreadable by others; tables can't be written directly; the 31st message in a minute fails; profile and photo visibility for partners and blocked pairs).
- Browser: 375 px and 1280 px in demo mode, a 2000-character unbroken message wraps without sideways scroll, the text box stays reachable with the on-screen keyboard, no console errors.
