# Accounts, member postings and real messaging

Date: 2026-11-11 · Status: design approved in chat; this spec awaits review

## Why

Students want their information to follow them: sign in on a laptop and see the budget, filters, saved places and messages they set on their phone. Anyone with a place, including a student who won't use their own place for a term, should be able to post it for a set period. Once posters have accounts, messages can be delivered and answered for real.

## What was agreed

- **Audience:** a portfolio / demo. Accounts, posting and messaging work for real, but heavy safety features (identity checks, moderation queues) are out of scope for now. The 40 sample listings stay.
- **Backend:** Supabase (hosted Postgres + Auth), project `tcuvvemijjsqbphqphqn`. The site stays on GitHub Pages; there is no server of ours.
- **Sign-in:** visitors can browse, search, filter and open listings without an account. Saving a place, messaging and posting ask you to sign in. Your budget and filters set before signing in move into your account.
- **Build order:** three pull requests, each tested and usable on its own.
  1. Accounts, plus syncing budget, filters, saved places and (demo) messages.
  2. Posting a place, with availability by term or custom months, and an "Available during" filter.
  3. Real messaging: delivered to the poster's account, a poster inbox and two-way threads.

  Afterwards: finish the budget ruler and dark mode.

## Part 1: accounts and sync (detailed)

### Sign up, sign in, account page

- **Create account:** name, email, password (at least 8 characters). **Sign in:** email and password. Clear errors for a wrong password, an email already in use, a weak password, or no connection.
- For the demo, email confirmation is turned **off** in Supabase so testers can sign in straight away. If it is left on, sign-up says "Check your email to confirm your account" and still works.
- **Account page** (`/account`, a new bottom-nav item):
  - Signed out: Sign in / Create account.
  - Signed in: name and optional phone (used to prefill the message form), Log out, and **Delete account**, which asks for confirmation and removes the profile, synced data and sign-in.
- A **sign-in sheet** opens wherever an action needs an account ("Sign in to save places and see them on any device"), with Create account in the same sheet. After signing in, the action you started finishes (e.g. the place is saved).

### What syncs

| Data | Signed out | Signed in |
|---|---|---|
| Budget, filters | This device | Account (and this device) |
| Saved places | Needs an account | Account |
| Messages (still demo until part 3) | Needs an account | Account |

- The app keeps working from the device copy and saves changes to the account in the background (debounced), so it stays fast and survives a dropped connection. A small "Saved to your account" / "Not synced, will retry" status shows on the Account page.
- **On signing in:** the account's data is loaded. If the account has no budget yet, the device's budget and filters are copied up. Saved places and messages are combined (union by id), never lost.
- **On logging out:** saved places and messages are cleared from the device; budget and filters stay so browsing continues.

### Data (Supabase, created by `supabase/migrations/0001_accounts.sql`)

- `profiles`: `id` (the user's id), `display_name`, `phone` (optional), timestamps.
- `user_state`: one row per user: `budget`, `filters` (JSON), `saved_ids` (text array, so sample and member listing ids both fit), `messages` (JSON, the demo messages until part 3), `updated_at`.
- **Row-level security** on both tables: a signed-in user can read and write only their own rows. Anonymous visitors can read neither.
- `delete_my_account()`: a database function that deletes the signed-in user's sign-in record (and, by cascade, their rows). It acts only on the caller.
- The public **publishable key** is committed in the app config; it is designed to be public and is limited by the security rules above. The secret key is never used by the app or stored in the repo.

### Code shape

- `src/lib/backend/` is the only code that talks to Supabase: `auth` (session, sign up/in/out, delete) and `cloud` (load/save profile and user state). Screens use them through `AccountState` (a React context), never Supabase directly.
- Tests use an in-memory fake of the same interface, so the test suite needs no network. `listingsRepo` stays the seam for listings (part 2 adds member listings there).
- `AppState` keeps its current API. Saving/messaging route through a `requireAccount(action)` helper that opens the sign-in sheet when signed out.

### Testing (part 1)

- **Unit:** merging device and account data (empty account, both sides, duplicates, junk), sign-up validation, sync scheduling and retry.
- **Flow (with the fake backend):** browse signed out; Save opens the sign-in sheet; create an account and the place is saved; sign out clears saved places; sign in again restores them; budget set before sign-up moves into the account; Delete account confirms and signs out; error messages for a wrong password and a taken email.
- **Real project:** a browser run against Supabase: create an account, save places and set a budget on one browser, sign in on a second clean browser and see the same data, then delete the test account.

## Part 2: posting a place (outline; detailed spec before building)

- "Post a place" from the Account page; a form with the same fields as the sample listings (title, address, type, bedrooms, bathrooms, rent, utilities and internet included or estimated, furnished, what's included, description).
- **Availability:** quick picks **Fall 2026** (Sep–Dec), **Winter 2027** (Jan–Apr), **Summer 2027** (May–Aug), or custom from/to months. A sublet is a posting with a short window.
- **Location:** drop a pin on the map (no address lookup service for now).
- Contact: choose whether phone and/or email show; in-app messaging is always on.
- **My listings:** edit, pause, delete. Member listings appear with the samples, labelled "Posted by a member"; samples stay labelled as samples.
- New filter: "Available during" a term. Saved and compared like any other listing.
- Data: `listings` table, readable by everyone when active, writable only by its owner.

## Part 3: real messaging (outline; detailed spec before building)

- Messages to a member listing are delivered to the poster's account; the poster gets an inbox (Messages tab) and can reply; threads become two-way with read/unread.
- Sample listings keep the demo behaviour (no one owns them), labelled as such.
- Data: `conversations` and `messages` tables; only the two people in a conversation can read it; what a student shares stays per message.

## Out of scope

Identity verification (e.g. @uoguelph.ca), reporting and moderation, photo uploads, address lookup, payments or deposits, email notifications, social sign-in (Google etc.), multiple languages.

## Setup the person does (once)

1. Supabase → **SQL Editor** → paste `supabase/migrations/0001_accounts.sql` → **Run**.
2. Supabase → **Authentication → Sign In / Providers → Email** → turn **Confirm email** off → Save.
