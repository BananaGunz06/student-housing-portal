# Working on this repo

## Workflow (the owner's standing preference)

1. **Plan with Opus.** Talk ideas through, write the spec (`docs/superpowers/specs/`) and the implementation plan (`docs/superpowers/plans/`), and get the owner's approval before building.
2. **Every plan step gets its own builder** (a fresh subagent per task):
   - **Haiku** for simple, mechanical steps (small edits, copy, docs, one or two files with a complete spec).
   - **Sonnet** for thorough steps (multi-file work, integration, state, data, anything needing judgment).
3. **Test and review with Opus.** Each step is reviewed by an Opus reviewer before the next starts, and the whole branch gets a final Opus review. Browser checks (Playwright, phone 375 px and laptop 1280 px) are part of testing.

Always name the model explicitly when dispatching a subagent.

## Project rules

- Mobile-first. Tests first (Vitest + Testing Library); `npm test`, `npm run lint` and `npm run build` pass before every commit.
- `src/lib/listingsRepo.ts` is the only way screens get listings; `src/lib/backend/` is the only code that talks to Supabase.
- Supabase: only the publishable key belongs in the repo. Never commit or ask for the secret / service_role key. Database changes go in `supabase/migrations/` for the owner to run in the SQL Editor.
- Sample data stays fictional (555-01xx phones, `example.com` emails).
