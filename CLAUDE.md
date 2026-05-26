# JagPool World Cup 2026 — Platform

Next.js 16 App Router, TypeScript, Tailwind v4, Supabase, Solana Sign-In. JagPool x Superteam Brazil prediction game for FIFA WC 2026 (June 11 – July 19, 2026).

## Quick reference

- `npm run dev` — start dev server
- `npm test` — run vitest tests
- `npm run build` — production build (catches type errors)
- Design spec: `docs/superpowers/specs/2026-05-26-jagpool-world-cup-design.md`
- UI contract for frontend handoff: `docs/UI-CONTRACT.md`

## Architecture

- **Route groups:** `(public)/` = no auth, `(app)/` = auth required. Middleware (`middleware.ts` + `lib/supabase/middleware.ts`) gates auth — do NOT add auth checks in `(app)/layout.tsx` (causes redirect loops).
- **Supabase clients** (`src/lib/supabase/*`):
  - `createClient()` (browser) — user-scoped, RLS-enforced
  - `createServerSupabaseClient()` (server) — same scoping, used in server components and route handlers
  - `createServiceRoleClient()` — bypasses RLS. Used by:
    - SIWS verify (creating `auth.users` rows)
    - Admin route handlers (gated by `requireAdmin()`)
    - Cron endpoints (`/api/cron/*`, bearer-auth via `CRON_SECRET`)
    - Scoring writes
- **Auth = Sign in with Solana**: `lib/siws/*` handles challenge/verify/session. The verify endpoint upserts an `auth.users` row keyed by a deterministic email (`<wallet>@wallet.jagpool.local`) with a server-only password derived from `WALLET_PASSWORD_PEPPER` + the wallet pubkey, then mints a real Supabase session via `signInWithPassword`. Frontend stores it via `supabase.auth.setSession()`.
- **Cross-table mutations** with invariants go through SECURITY DEFINER RPCs:
  - `lock_validator(p_validator_id)` — one-time validator selection
  - `submit_group_prediction(...)` — upsert with TOCTOU-safe lock check
  - `submit_match_prediction(...)` — upsert with kickoff-window check
- **Scoring** (`lib/scoring/*`) is a pair of pure functions (`scoreMatchPrediction`, `scoreGroupPrediction`). The cron at `/api/cron/score` runs them over completed matches and writes `scores` rows.
- **Leaderboards** are SQL views (`user_leaderboard`, `validator_leaderboard`) — recomputed on every read. Fine for our scale (hundreds of users).

## Conventions

- **Language:** UI copy in English (divergence from sibling STBR projects, which are pt-BR). Routes, identifiers, and code in English.
- **Brand:** JagPool purple (`--color-jagpool-primary: #5b21b6`) + accent. Tokens are in `@theme` in `src/app/globals.css`.
- **Supabase queries:** use `.maybeSingle()` over `.single()` — `.single()` throws on 0 rows.
- **Dynamic pages:** every `(app)/` page exports `dynamic = 'force-dynamic'`.
- **No code comments** by default. If you write one, explain WHY, not WHAT.
- **Input validation** lives in `lib/security.ts`. Use `isValidUuid`, `isValidBase58`, `sanitizeUsername`, `clampInt` before passing user input to RPCs.

## Gotchas

- **The Supabase DB is shared with `../bh-onchain` and `../superteam-maker`**. Before applying our migrations, take a backup (`pg_dump`) and drop the old tables from those apps. **Do not** run our migrations against the live DB until backup has been confirmed on disk.
- **SIWS deterministic password** — derived from `WALLET_PASSWORD_PEPPER`. Generate once with `openssl rand -base64 48` and treat as permanent. If you rotate it, every wallet user becomes locked out (their derived password no longer matches the hash stored in `auth.users`).
- **`NEXT_PUBLIC_JAGSOL_MINT`** is required for `getJagsolBalance()` to work. If unset, the function returns null and `meetsMinimum` becomes effectively a no-op (always false). Set this before launching JagSOL gating.
- **Cron endpoints** are bearer-auth'd via `CRON_SECRET`. Vercel sends `Authorization: Bearer <secret>` when configured in `vercel.json`. Don't expose them publicly.
- **Validator selection is one-time.** Once `users.validator_locked_at` is set, the user can't change. The DB enforces this via the `lock_validator` RPC's `RAISE EXCEPTION` branch.
- **Match data is text, not enum** — admin updates `home_team`/`away_team` ad-hoc as group results come in. Don't try to constrain these to a fixed list.
- **The user dev for frontend** will iterate on `src/components/**`. Don't touch their components if you can avoid it; add new ones or extend types in `src/types/api.ts`.

## Testing

- Unit tests in `src/lib/__tests__/`. Cover the scoring engine, sanitizers, and SIWS message builder.
- No DB integration tests — RPCs and route handlers are smoke-tested manually before each phase rollout. Add tests if a regression bites twice.
