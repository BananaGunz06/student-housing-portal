# Contact the poster (in-app messaging demo)

Date: 2026-11-11 · Status: approved in chat

## Why

Posters (landlords, property managers, students subletting) need a way to hear from interested students without putting a phone number or email on a public listing. Students need the same choice. In-app messaging is the private default; phone and email are extras each side shares only if they want to.

## What the person asked for

- Every listing shows who posted it and how to reach them.
- Students can contact the poster directly in the app.
- Sharing a phone number or anything else is optional, and only goes to the poster.
- Posters who don't want their number public can still be contacted.

## Assumptions (agreed)

- Still a demo: no backend, no sign-up. Messages are saved on the student's device only and are not delivered. The UI says so.
- Only the student side works. Poster replies need a server (an inbox for posters plus delivery) and are out of scope.
- Posters are fictional: phone numbers use the reserved 555-01xx range and emails use `example.com`.

## Design

### Data

`Listing.poster: Poster`

```ts
type PosterRole = 'landlord' | 'property-manager' | 'student-sublet'
interface Poster {
  name: string        // "Sam K." or a fictional company
  role: PosterRole
  replyTime: string   // "Usually replies within a day"
  phone?: string      // only if the poster chose to share it
  email?: string      // only if the poster chose to share it
}
```

`scripts/generate-listings.mjs` adds posters with a **separate seed**, so every existing field stays byte-identical. About half share nothing beyond in-app messages; the rest share an email, a phone, or both.

### Messages (pure logic, `src/lib/messages.ts`)

- `Message { id, listingId, sentAt (ISO), body, shared: SharedDetails }`
- `SharedDetails { name?, phone?, email?, other? }`: trimmed; empty fields are dropped, so nothing blank is "shared".
- `validateDraft`: message required (max 1000 characters); phone must have 10–11 digits if given; email must look like an email if given.
- `starterMessage(listing)`: an editable opener, e.g. "Hi Sam, is the room on Dean Ave still available from December 2026?"
- `conversations(messages)`: grouped by listing, newest conversation first, messages oldest first.
- Stored in localStorage under `shp.messages`, through `AppState`, with junk and messages for listings that no longer exist dropped (same as saved places).

### Screens

- **Listing detail → "Posted by" card.** Name, role and typical reply time. A primary **Message** button. Call, Text and Email links appear only when the poster shared them; otherwise "Sam chose not to share a phone number or email. Send a message here instead." If you already messaged, "You messaged Sam on Nov 11 · See conversation". A **Message** button also sits in the sticky bottom bar beside Save.
- **Message sheet** (a dialog, like Filters): the message box pre-filled with the starter; an optional "Share your details" group (name, phone, email, anything else) with "Only what you fill in is shared with Sam."; inline errors; a demo note. Remembers the details you shared last time so you don't retype them. Escape or Cancel closes and returns focus.
- **Messages tab** (`/messages`): a new bottom-nav item. A demo banner, and one row per conversation (listing, poster, last message, date, "Waiting for a reply"). Empty state explains how to start.
- **Conversation** (`/messages/:listingId`): your messages with the details you shared under each one, "Waiting for Sam to reply", and a follow-up box.

### Seams for a real backend later

`listingsRepo` supplies posters; `AppState.sendMessage` is the one place a message is created. A server would replace those two, plus add the poster's inbox.

## Out of scope

Poster replies and inbox, accounts, posters editing their details, real delivery, notifications, spam or abuse controls.

## Testing

- Unit: validation, shared-details cleanup, starter text, grouping, phone link formatting, generated poster data (fictional numbers and domains, a mix of private and shared).
- Flow: open a listing → Message → errors for an empty message and a bad phone → send → confirmation → Messages tab → conversation shows the shared details → follow-up → listing shows "You messaged". Private poster shows no call or email links. Stored messages for removed listings are dropped. Escape closes the sheet and returns focus.
- Browser check at 375 px and 1280 px: no horizontal scroll, sticky bar fits, no console errors.
