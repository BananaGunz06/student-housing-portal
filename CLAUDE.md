# Working on this repo

## Workflow (the owner's standing preference)

Keep usage low: few builders, one review per part, one thing at a time.

1. **Plan first.** Talk ideas through, write the spec (`docs/superpowers/specs/`) and the implementation plan (`docs/superpowers/plans/`), and get the owner's approval before building.
2. **Few, large build steps.** Group a plan into as few steps as sensible and let one builder carry several related steps, so builders don't keep starting from scratch. Resume an existing builder for follow-up fixes instead of starting a new one.
   - **Haiku** for simple, mechanical work (small edits, copy, docs).
   - **Sonnet** for everything else.
3. **One Opus review per part, at the end.** No review after each step or each fix. If a re-check of fixes is needed, keep it small and use Sonnet. Browser checks (Playwright, phone 375 px and laptop 1280 px) are part of the end-of-part testing.
4. **One thing at a time.** Don't run builders or reviewers in parallel.

Always name the model explicitly when dispatching a subagent.

## Project rules

- Mobile-first. Tests first (Vitest + Testing Library); `npm test`, `npm run lint` and `npm run build` pass before every commit.
- `src/lib/listingsRepo.ts` is the only way screens get listings; `src/lib/backend/` is the only code that talks to Supabase.
- Supabase: only the publishable key belongs in the repo. Never commit or ask for the secret / service_role key. Database changes go in `supabase/migrations/` for the owner to run in the SQL Editor.
- Sample data stays fictional (555-01xx phones, `example.com` emails).
