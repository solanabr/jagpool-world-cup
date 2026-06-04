# JagPool World Cup 2026

Prediction game platform for FIFA World Cup 2026, built by [Superteam Brazil](https://superteam.fun/br) for JagPool. Users sign in with their Solana wallet, hold a minimum amount of JagSOL, pick a validator team, and predict tournament outcomes. The validator whose users accumulate the most points wins additional stake from JagPool; the top individual users win SPL token prizes.

**Status:** feature-complete backend + working prediction/scoring/leaderboard flows. Frontend polish in progress.

## Stack

- **Next.js 16** App Router + TypeScript
- **Supabase** (Postgres + Auth + RLS)
- **Solana wallet adapter** with Sign in with Solana (SIWS)
- **Tailwind CSS v4**
- **Vitest**

## Setup

```bash
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, WALLET_PASSWORD_PEPPER, NEXT_PUBLIC_JAGSOL_MINT,
# CRON_SECRET

pnpm install
pnpm dev
```

**Admin bootstrap:** there is no env-var allowlist. To make the first admin, run this SQL once against the live DB:

```sql
UPDATE public.users SET is_admin = true WHERE wallet_address = '<pubkey>';
```

After that, additional admins are granted from `/admin/users` in the app.

## Database

Migrations live in `supabase/migrations/`. Before any destructive schema change against the live DB, take a backup:

```bash
pg_dump "postgres://..." > supabase-backup.sql
```

**Schema layout:**

- `supabase/schema.sql` — single-file baseline for **fresh DB setups**. Apply once against a clean Postgres and you get the full schema. Not idempotent (contains plain `create type`, `create policy` statements that would error on a second apply). Designed for `psql -f` on an empty DB, not re-runs.
- `supabase/migrations/` — **forward-going migrations only**. The supabase CLI applies these to the live DB. Currently empty (everything applied has been moved to `_archive/`).
- `supabase/migrations/_archive/` — historical incremental migrations (00001..00026). Kept for reference; not active. The live DB has all of these tracked in `supabase_migrations.schema_migrations`.

**For fresh setups:** `psql -f supabase/schema.sql` on a clean DB.
**For ongoing schema work:** add new migrations as `00027_*.sql`, `00028_*.sql`, etc. in `supabase/migrations/`. After applying, append the SQL to `supabase/schema.sql` so the baseline stays current, then move the migration file to `_archive/`.

## Architecture

- `src/app/(public)/` — no auth (landing page, SIWS sign-in)
- `src/app/(app)/` — auth-required (dashboard, onboarding, predictions, matches, leaderboard, admin)
- `src/app/api/` — route handlers (SIWS, predictions, admin, cron)
- `src/lib/supabase/` — three Supabase client roles (browser, server, service-role)
- `src/lib/siws/` — Sign in with Solana flow
- `src/lib/solana/` — RPC + JagSOL balance check
- `src/lib/scoring/` — pure scoring functions (`compute.ts`) + DB persistence (`persist.ts`)
- `supabase/migrations/` — baseline schema + future incremental migrations

## Routes

**User-facing:**

- `/` — landing, sign in with Solana
- `/onboarding` — username + validator selection (one-time)
- `/dashboard` — overview, CTA card for predictions, stats
- `/predictions` — single timeline page with collapsible stage sections (groups + champion, R32, R16, QF, Semi, Third, Final). Auto-opens the next actionable stage.
- `/matches` — full schedule + results
- `/leaderboard` — live standings, your personal status, payouts when a snapshot is finalized

**Admin:**

- `/admin/matches` — finalize match (scores knockout predictions inline), rescore on correction
- `/admin/groups` — set group advancers (auto-scores group predictions)
- `/admin/users` — grant/revoke admin
- `/admin/rewards` — create reward snapshots, manage status (draft → finalized → paid)

## Testing

```bash
pnpm test
```

Unit tests in `src/lib/__tests__/` cover the scoring engine, sanitizers, formatters, knockout helpers, and SIWS message builder.

DB integration tests aren't included — RPCs and route handlers are smoke-tested manually before each phase rollout.

## License

Internal Superteam Brazil x JagPool project. Not open source.
