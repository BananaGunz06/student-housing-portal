# Plan: contact the poster

Spec: `docs/superpowers/specs/2026-11-11-contact-poster-design.md`. Test-first; commit after each step; `npm test`, `npm run lint` and `npm run build` pass at every commit.

1. **Poster data.** Add `Poster`/`PosterRole` to `src/data/types.ts` and `poster` to `Listing`. Generate posters in `scripts/generate-listings.mjs` with a separate seed. Test in `listingsRepo.test.ts`: every listing has a valid poster; phones are 555-01xx; emails are `@example.com`; some posters share nothing, some share a phone, some an email. Update `makeListing`.
2. **Messages logic.** `src/lib/messages.ts` + `messages.test.ts`: `validateDraft`, `sharedFrom`, `starterMessage`, `conversations`, `phoneHref`, `isMessage`.
3. **State.** `AppState`: `messages`, `sendMessage`, `lastShared`; storage key `shp.messages`; drop junk and unknown listings.
4. **Shared modal behaviour.** Move FilterSheet's focus trap, Escape and scroll lock into `src/lib/useModal.ts`; reuse it.
5. **Poster card + message sheet** on the listing page, with the sticky-bar Message button and the confirmation. Flow tests.
6. **Messages and Conversation pages**, routes and the bottom-nav item. Flow tests (send → list → conversation → follow-up; stale messages dropped).
7. **Docs and checks.** README; browser walkthrough at 375 px and 1280 px; screenshots; push and open a PR.
