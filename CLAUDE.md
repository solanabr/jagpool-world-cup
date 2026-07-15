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
- **X (Twitter) identity link**: wallet stays the sole login; X is linked post-login via `supabase.auth.linkIdentity({ provider: 'x' })` (manual linking). The OAuth return hits `/auth/callback`, which exchanges the code and syncs the identity onto `public.users`: the `@handle` becomes the display name (stored in `users.username`), plus `x_user_id` (immutable, unique — one X per account) and `x_avatar_url`. X is profile-only, never a login path. Parsing of the provider's `identity_data` lives in `lib/x-identity.ts`.
- **All state-changing operations go through SECURITY DEFINER RPCs.** Direct INSERT/UPDATE on `group_predictions`, `match_predictions`, `champion_predictions`, `users.is_admin`, `validators.is_active`, etc. is revoked from `authenticated`. RPCs:
  - User-facing: `lock_validator`, `submit_group_prediction`, `submit_match_prediction`, `submit_champion_prediction`
  - Admin-only (gated by `users.is_admin = true` inside the RPC): `finalize_match`, `set_group_advancers`, `set_validator_active`, `set_user_admin`, `list_users_admin`, `create_reward_snapshot`, `set_reward_snapshot_status`
  - Cron-only (service role): `lock_overdue_matches`
- **Scoring** (`lib/scoring/*`) is pure TS functions returning a discriminated `ScoreEvent` union (`scoreMatchPrediction`, `scoreGroupPrediction`, `scoreChampionPrediction`). `lib/scoring/persist.ts` flattens events to DB rows and handles writes. Inline scoring: `/api/admin/finalize-match` scores knockout match predictions immediately on finalize (no cron lag), plus champion picks when the final is finalized; `/api/admin/group-advancers` auto-scores group predictions on save. The cron at `/api/cron/score` is a safety net for anything the inline path missed. All scoring writes use non-partial unique indexes on `(prediction_id, reason)` so reruns are idempotent.
- **Leaderboards** are SECURITY DEFINER RPCs (`get_user_leaderboard`, `get_validator_leaderboard`) — they bypass the user RLS (which is self-only) to expose the global ranking. Views aren't usable here because `security_invoker` would have leaked only the current user's row.
- **Scoring rules** (v2, no multipliers):
  - Group advancer hit: 5 pts each (max 10 per group, no bonus)
  - Knockout winner: 10 pts
  - Late-stage (semi, third-place, final) winner-score / loser-score: +5 pts each, awarded **independently of the winner pick** — a correct scoreline scores even if you picked the wrong side to advance (only the +10 winner bonus needs the pick correct). Score = normal time + extra time, before penalties.
  - Champion: 30 pts

## Admin domain actions

Admin work goes through dedicated UI under `/admin/*`:

- `/admin/matches` — finalize match (calls `finalize_match` RPC, scores knockout predictions inline), rescore on correction
- `/admin/groups` — set group advancers (calls `set_group_advancers`, auto-scores)
- `/admin/users` — grant/revoke admin (calls `set_user_admin`)
- `/admin/rewards` — create reward snapshots, change status (draft → finalized → paid), view payout status
- `POST /api/admin/rescore-match` — upsert + prune stale scores for one match
- `PATCH /api/admin/reward-snapshot` — transitions snapshot status via `set_reward_snapshot_status` RPC

**Admin bootstrap** — there is no env-var allowlist. To grant the first admin, run:

```sql
UPDATE public.users SET is_admin = true WHERE wallet_address = '<pubkey>';
```

Subsequent admins are added through `/admin/users`. `requireAdmin()` checks `users.is_admin` only — single source of truth, agrees with the SECURITY DEFINER RPCs.

## User-facing pages

- `/` — landing page, SIWS sign-in button
- `/onboarding` — link X account (verified `@handle` via Supabase `linkIdentity`) + validator selection (locks after confirm)
- `/dashboard` — your stats + nav cards
- `/predictions` — single timeline page with collapsible stages (groups + champion, R32, R16, QF, Semi, Third, Final). Auto-opens the next actionable stage. Uses native `<details>` for zero-JS collapsibles.
- `/matches` — full tournament schedule + results
- `/leaderboard` — live standings + your personal status + payouts when a snapshot is finalized. Replaces the previous separate `/rewards` and `/claim` pages.

## Conventions

- **Language:** UI copy in English (divergence from sibling STBR projects, which are pt-BR). Routes, identifiers, and code in English.
- **Brand:** JagPool orange `--color-jagpool-primary: #f97316` (orange-500) for CTAs, `--color-jagpool-primary-hover: #fb923c` (orange-400) for hover, `--color-jagpool-accent: #fbbf24` (amber-400) for accents. Tokens are in `@theme` in `src/app/globals.css`.
- **Supabase queries:** use `.maybeSingle()` over `.single()` — `.single()` throws on 0 rows.
- **Dynamic pages:** every `(app)/` page exports `dynamic = 'force-dynamic'`.
- **No code comments** by default. If you write one, explain WHY, not WHAT.
- **Input validation** lives in `lib/security.ts`. Use `isValidUuid`, `isValidBase58`, `clampInt` before passing user input to RPCs.

## Gotchas

- **Always `pg_dump` before destructive schema changes.** Recovery from a bad migration is straightforward with a backup on disk; without one, you're rolling back from memory.
- **Schema baseline vs incremental migrations.** `supabase/schema.sql` is the single-file baseline for **clean-DB setups only** — it has plain `create type` / `create policy` statements that error on re-apply, so don't run it twice. All 30 historical migrations are preserved in `supabase/migrations/_archive/` (latest: `00030_x_identity`). Active `supabase/migrations/` is empty; new forward-going migrations start at `00031_*`. The live DB has `jagpool_wc_00001..00022 + rls_initplan_optimization + codex_audit_critical_fixes + codex_followup_audit + filter_zero_point_snapshot_rows` tracked in `supabase_migrations.schema_migrations`, so the supabase CLI only applies new files. Workflow for new migrations: write `00031_x.sql` in `migrations/`, apply, append to `schema.sql`, move file to `_archive/`.
- **SIWS deterministic password** — derived from `WALLET_PASSWORD_PEPPER`. Generate once with `openssl rand -base64 48` and treat as permanent. If you rotate it, every wallet user becomes locked out (their derived password no longer matches the hash stored in `auth.users`).
- **X / Twitter OAuth setup (required for `/onboarding`)** — dashboard config, not code: (1) create an **X OAuth 2.0 app** (X Developer Portal; App permissions: Read; type: Web App / confidential client); (2) set its callback to `https://<project-ref>.supabase.co/auth/v1/callback`; (3) paste the Client ID + Secret into Supabase → Auth → Providers → **X / Twitter (OAuth 2.0)**; (4) enable **Manual Linking** in Supabase Auth config — `linkIdentity` errors without it; (5) add the app origin to Supabase **Redirect URLs** (e.g. `http://localhost:3000/auth/callback`). This Supabase project is shared with sibling apps, so enabling the provider affects them too.
- **`NEXT_PUBLIC_JAGSOL_MINT`** is required for `getJagsolBalance()` to work. If unset, the function returns null and `meetsMinimum` becomes effectively a no-op (always false). Set this before launching JagSOL gating.
- **Cron endpoints** are bearer-auth'd via `CRON_SECRET`. Vercel sends `Authorization: Bearer <secret>` when configured in `vercel.json`. Don't expose them publicly.
- **Validator selection is one-time.** Once `users.validator_locked_at` is set, the user can't change. The DB enforces this via the `lock_validator` RPC's `RAISE EXCEPTION` branch.
- **Match data is text, not enum** — admin updates `home_team`/`away_team` ad-hoc as group results come in. Don't try to constrain these to a fixed list.
- **Team validation lives in `tournament_teams`** — a per-tournament team roster with group assignment. `submit_group_prediction` / `submit_champion_prediction` check teams against this table. To support a new tournament: insert team rows for that `tournament_id` before opening predictions.
- **`scores.tournament_id` is mandatory for new rows** — every writer (cron, finalize-match, rescore, persist helpers) sets it. Reward snapshots filter by tournament via this column; without it, future tournaments would aggregate prior-tournament points.
- **`finalize_match` scores knockout predictions inline** — admin clicks "finalize" and users see points immediately, no cron lag. The cron is now a safety net for any matches missed by the inline path.
- **The user dev for frontend** will iterate on `src/components/**`. Don't touch their components if you can avoid it; add new ones or extend types in `src/types/api.ts`.

## Testing

- Unit tests in `src/lib/__tests__/`. Cover the scoring engine, input validators, the X-identity parser (`x-identity.ts`), and SIWS message builder.
- No DB integration tests — RPCs and route handlers are smoke-tested manually before each phase rollout. Add tests if a regression bites twice.
