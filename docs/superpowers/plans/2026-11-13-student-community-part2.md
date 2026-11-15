# Student community part 2 (direct messages) Implementation Plan

> **For agentic workers:** follow `CLAUDE.md`: few large steps, one builder per step (resume it for fixes), one Opus review at the end, nothing in parallel. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Students can message each other one-to-one from a profile page, see their chats and an unread count in the Messages tab, and block or report another student.

**Architecture:** One SQL migration adds the chat tables and puts every write behind database functions, so the rules (participants only, no blocked senders, no deleted recipients) live in one place. The `Backend` interface gains chat methods (Supabase adapter + fake). A `ChatState` provider holds the chat list and unread count for the Messages tab and the bottom bar; the chat screen loads its own messages.

**Tech Stack:** React 19, TypeScript, React Router 7, Tailwind 4, Supabase (Postgres RLS, RPC functions, Realtime), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-12-student-community-design.md` (Part 2)

## Global Constraints

- Project rules in `CLAUDE.md` apply: tests first; `npm test`, `npm run lint`, `npm run build` pass before every commit; only `src/lib/backend/` talks to Supabase; only the publishable key in the repo; sample data fictional.
- Messages are text only, 1–2000 characters after trimming. One conversation per pair of students.
- Email and phone never appear in a chat, a chat list or a profile.
- The existing demo messages to posters (`/messages/:listingId`, the **Places** group) are unchanged.
- Copy (exact): "Message", "You can't message this student.", "This student deleted their account. You can't reply.", "Deleted student", "Block", "Unblock", "Report", "Blocked. They can't message you.", "Thanks. Your report was sent.", "Couldn't send. Check your connection and try again.", "No student chats yet. Open a student's profile and tap Message.", report reasons "Spam or scam", "Harassment", "Fake profile", "Something else".
- A deleted student's messages are shown muted (grey bubble, lighter text); their name and photo are not links.
- Mobile-first; every control ≥ 44 px tall; no horizontal scroll at 375 px; the chat screen works with the on-screen keyboard (text box stays reachable).

## Additions to the spec (decided here, flagged for the owner)

- **Sending limit:** at most 30 messages a minute per student, enforced in the database. Over the limit the app says "You're sending messages too fast. Wait a moment and try again."
- **Long chats:** the chat screen loads the latest 50 messages, with "Show earlier messages".
- **Blocked both ways for profiles:** when either student has blocked the other, neither can open the other's profile page ("This profile isn't available."). The existing chat stays readable for both.
- **Reporting needs a live account:** a deleted student can't be reported (there is nothing left to act on).

## Review Focus

- Two students message each other at the same moment for the first time → exactly one conversation exists afterwards, with both messages.
- A student blocks mid-chat → the other student's next send fails with "You can't message this student." and nothing is stored; the blocker can still read the history.
- The other student deletes their account while the chat is open → on the next refresh the chat shows "Deleted student", muted messages and no text box; nothing crashes on the missing name.
- A message arrives while the recipient is reading that same chat → it appears and the chat is not counted as unread; if they are elsewhere in the app the bottom-bar count goes up by one.
- A very long unbroken message (2000 characters, no spaces) → wraps inside the bubble at 375 px without sideways scroll.

---

### Step 1: Database and backend (Sonnet)

**Files:**
- Create: `supabase/migrations/0003_direct_messages.sql`, `src/lib/chat.ts`, `src/lib/chat.test.ts`
- Modify: `src/lib/backend/types.ts`, `src/lib/backend/supabase.ts`, `src/lib/backend/supabase.test.ts`, `src/test/fakeBackend.ts`, `src/test/fakeBackend.test.ts`

**Interfaces (produces):**

```ts
export type ReportReason = 'spam' | 'harassment' | 'fake' | 'other'
export type SendError = 'blocked' | 'gone' | 'too-fast' | 'network'
export interface ChatSummary {
  id: string
  other: { id: string; displayName: string; avatarUrl: string | null } | null   // null = deleted student
  lastBody: string; lastFromMe: boolean; lastAt: string                          // ISO time
  unread: boolean
  blockedByMe: boolean
}
export interface DirectMessage { id: string; chatId: string; fromMe: boolean; body: string; sentAt: string }
// added to Backend:
listChats(): Promise<ChatSummary[]>                                   // newest first
getChat(chatId: string): Promise<ChatSummary | null>                  // null when not a participant or unknown
findChatWith(studentId: string): Promise<string | null>
listDirectMessages(chatId: string, before?: string): Promise<{ messages: DirectMessage[]; hasEarlier: boolean }> // oldest→newest, 50 a page
sendDirectMessage(to: { chatId: string } | { studentId: string }, body: string):
  Promise<{ ok: true; chatId: string; message: DirectMessage } | { ok: false; error: SendError }>
markChatRead(chatId: string): Promise<void>
onDirectMessage(cb: (chatId: string) => void): () => void             // fires for messages sent TO the current student
blockStudent(studentId: string): Promise<void>
unblockStudent(studentId: string): Promise<void>
reportStudent(studentId: string, reason: ReportReason, note: string, chatId?: string): Promise<void>
// StudentCard gains: blockedByMe: boolean
// chat.ts (pure):
export const MESSAGE_MAX = 2000
export const REPORT_REASONS: { value: ReportReason; label: string }[]
export function validateMessage(body: string): string | null          // trimmed; null when valid
export function unreadCount(chats: ChatSummary[]): number
export function sendErrorCopy(e: SendError): string
```

**SQL (`0003_direct_messages.sql`, safe to run twice):**
- `conversations (id uuid pk default gen_random_uuid(), student_a uuid → auth.users on delete set null, student_b uuid → auth.users on delete set null, created_at, last_message_at)`, with `student_a < student_b` enforced on insert and a unique index on `(student_a, student_b)`.
- `direct_messages (id uuid pk, conversation_id → conversations on delete cascade, sender_id uuid → auth.users on delete set null, body text check 1–2000, created_at)`; index on `(conversation_id, created_at desc)`.
- `conversation_reads (conversation_id → conversations on delete cascade, user_id → auth.users on delete cascade, last_read_at, pk both)`.
- `blocks (blocker_id, blocked_id → auth.users on delete cascade, created_at, pk both, blocker_id <> blocked_id)`.
- `reports (id uuid pk, reporter_id, reported_id → auth.users on delete set null, conversation_id null, reason in the four values, note ≤ 500, created_at)`.
- RLS on all five. Select: participants on `conversations` and `direct_messages`; own rows on `conversation_reads`; blocker only on `blocks`; nobody on `reports`. **No insert/update/delete policies on conversations, direct_messages or conversation_reads**: writes go through the functions below. `blocks`: blocker may insert/delete own rows. `reports`: reporter may insert own rows.
- Functions (`security definer`, `set search_path = ''`, execute granted to `authenticated` only, each acts only for `auth.uid()`):
  - `send_direct_message(recipient uuid, body text) returns json`: trims and checks the body; refuses when the recipient doesn't exist (`gone`), when a block exists in either direction (`blocked`), when the sender has sent 30 messages in the last minute (`too-fast`), or when recipient = sender; creates the conversation if missing (`insert … on conflict do nothing`, then select); inserts the message; sets `last_message_at`; upserts the sender's read time; returns the conversation id and message.
  - `mark_conversation_read(conversation uuid)`: participant only; upserts `last_read_at = now()`.
  - `list_conversations() returns table(...)`: one row per conversation of the caller with the other student's id, name and `avatar_path` (nulls when deleted), last message body, whether the caller sent it, `last_message_at`, `unread` (last message not from the caller and later than their `last_read_at`), `blocked_by_me`.
  - `is_blocked_between(a uuid, b uuid) returns boolean` (used by policies).
- Replace the `profiles` read policy: own row; or `looking_for_roommates`; or shares a conversation with the caller; and in the last two cases not `is_blocked_between`. Replace the `avatars` read policy with the same rule.
- Add `direct_messages` to the `supabase_realtime` publication (guarded so a second run doesn't fail).

**Adapter notes:** `onDirectMessage` subscribes to Realtime inserts on `direct_messages` and calls back only for rows whose `sender_id` isn't the current student; unsubscribes on sign-out. Function errors map to `SendError` by the raised message; anything else is `network`. `listStudents`/`getStudent` fill `blockedByMe`. The fake backend implements the same rules in memory, with a deterministic clock, `deliver(chatId)` semantics through `onDirectMessage`, and helpers `chatsOf(email)` and `reportsCount()`.

- [ ] **Tests first** (`fakeBackend.test.ts`, `chat.test.ts`, `supabase.test.ts`): first message creates one chat and both students see it; both sending first at once still leaves one chat; `lastBody`/`lastFromMe`/`unread` for each side; `markChatRead` clears unread; a blocked sender gets `blocked` and nothing is stored, the blocker still reads history; unblock restores sending; blocked students vanish from each other's `listStudents` and `getStudent` returns null; after the other student's account is deleted the chat has `other: null`, their messages have `fromMe: false`, and sending gives `gone`; the 31st message in a minute gives `too-fast`; paging returns 50 then earlier ones with `hasEarlier`; `onDirectMessage` fires for the recipient only; a non-participant's `getChat`/`listDirectMessages` returns null/empty; `reportStudent` stores a report the reporter can't read back; a chat partner with roommates off is readable through `getStudent`; `validateMessage` rejects empty, whitespace-only and 2001 characters; `unreadCount`; error-name mapping in the adapter.
- [ ] Run them → FAIL. Implement the migration, types, adapter, fake and `chat.ts`.
- [ ] `npm test && npm run lint && npm run build`. Commit "Add direct messages, blocks and reports to the backend".

### Step 2: Chat screens, Messages tab, unread count, block and report (Sonnet)

**Files:**
- Create: `src/state/ChatState.tsx`, `src/pages/StudentChat.tsx`, `src/pages/StudentChat.test.tsx`, `src/components/StudentChatList.tsx`, `src/components/StudentMenu.tsx` (Block / Unblock / Report), `src/components/ReportSheet.tsx`
- Modify: `src/App.tsx` (provider; route `/messages/s/:chatId`, where `chatId` may be `new` with `?to=<studentId>`), `src/pages/Messages.tsx` (+ tests), `src/pages/StudentProfile.tsx` (+ tests), `src/components/BottomNav.tsx` (+ tests), `src/components/StudentCard.tsx` if needed

**Interfaces:**
- Consumes: Step 1's `Backend` methods and `chat.ts`; `Avatar` (`muted` for deleted students); `useModal` for the report sheet.
- Produces: `useChats(): { chats: ChatSummary[]; status: 'loading' | 'ready' | 'error'; unread: number; refresh(): void }` from `ChatState`, which loads when signed in, refreshes on `onDirectMessage`, on window focus / tab visible, and after sending or marking read; empty when signed out.

**Behaviour:**
- **Profile page:** a "Message" button for another student (not on your own profile). It opens the existing chat, or `/messages/s/new?to=<id>` when there is none. A "⋯" menu with Block / Unblock and Report. When you have blocked them, the button is replaced by "Blocked. They can't message you." and an Unblock button.
- **Chat screen:** header with the other student's photo and name (a link to their profile; plain text and a muted placeholder for a deleted student) and the "⋯" menu; messages oldest to newest in bubbles (mine dark on the right, theirs light on the left, a deleted student's muted) with times; "Show earlier messages" when there are more; a text box and "Send" pinned above the bottom bar; Enter sends, Shift+Enter adds a line; the box clears and keeps focus after sending; the view scrolls to the newest message on open and when one arrives. The first send from `/messages/s/new` creates the chat and replaces the URL with the real id. Opening a chat, and receiving a message while it is open and visible, marks it read. Send failures show the matching copy under the box and keep the text. For a deleted student, the text box is replaced by the notice. Signed out → redirect to `/account`. Unknown chat or not a participant → "This chat isn't available." with a link to Messages.
- **Messages tab:** two headed groups. **Students**: each chat with photo, name, last message ("You: …" when mine), time, and an unread dot with visually hidden text "Unread"; newest first; the empty-state copy when there are none; signed out shows "Sign in to message other students." **Places**: the existing demo list and banner, unchanged.
- **Bottom bar:** the Messages item shows the unread count ("Messages (2)", like Saved), with nothing shown at zero.
- **Report sheet:** the four reasons as radio buttons, an optional note (≤ 500), "Send report" and "Cancel"; afterwards "Thanks. Your report was sent."
- **Block:** asks "Block <name>? They won't be able to message you, and you won't see each other in Students." with "Block" and "Cancel".

- [ ] **Tests first** (fake backend, two students): Message on a profile opens a new chat, sending shows the bubble and the chat appears in both students' Messages lists; returning to the profile opens the same chat; an incoming message appears live in an open chat and does not raise the unread count; elsewhere in the app the bottom bar shows "Messages (1)" and opening the chat clears it; Enter sends and Shift+Enter doesn't; empty and 2001-character messages can't be sent; offline send shows the error and keeps the text; "Show earlier messages" loads the previous 50; blocking from the chat menu makes the other student's send show "You can't message this student." and hides each from the other's Students tab; Unblock restores it; a report is recorded and the thanks copy shows; after the other student deletes their account the list shows "Deleted student", the chat shows muted bubbles and the notice with no text box, and the name isn't a link; a non-participant sees "This chat isn't available."; signed-out states; the Places group still lists demo messages; a 2000-character unbroken message carries the wrapping classes.
- [ ] Run them → FAIL. Implement.
- [ ] `npm test && npm run lint && npm run build`. Commit "Add student chats, the unread count, block and report".

### Step 3: Docs (Haiku)

- [ ] `README.md`: describe student-to-student messages, block and report; update "What syncs" / Messaging notes (student chats are real; messages to posters are still a demo); setup step for `0003_direct_messages.sql` and turning on Realtime if the dashboard needs it; file tree; move direct messages out of "Not in version 1". Commit "Document direct messages".

### Then (in this order, one at a time)

1. Owner runs `supabase/migrations/0003_direct_messages.sql` in the Supabase SQL Editor.
2. Database rules check against the real project with three throwaway accounts: a third student can't read a pair's conversation or messages or write into it; a blocked student can't send; blocks and reports can't be read by others; tables can't be written directly; a chat partner's profile and photo are readable with roommates off and unreadable once blocked; messages survive account deletion.
3. Browser check at 375 px and 1280 px with two signed-in students, including live delivery between two browser windows.
4. One Opus review of the whole part, one fix pass by the Step 2 builder, then a pull request when the owner asks.
