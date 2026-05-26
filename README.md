# JagPool World Cup 2026

Prediction game platform for FIFA World Cup 2026, built by [Superteam Brazil](https://superteam.fun/br) for JagPool. Users sign in with their Solana wallet, hold a minimum amount of JagSOL, pick a validator team, and predict tournament outcomes. The validator whose users accumulate the most points wins additional stake from JagPool; the top 10 individual users win SPL token prizes.

**Status:** MVP foundation (Phase 1). Backend, schema, and placeholder UI are in place. UI refinement is in progress.

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
# CRON_SECRET, ADMIN_WALLET_ALLOWLIST

npm install
npm run dev
```

## Database

Migrations live in `supabase/migrations/`. The Supabase project is shared with two other Superteam Brazil apps (`bh-onchain`, `superteam-maker`); before applying our migrations to it, run:

```bash
pg_dump "postgres://..." > ~/Desktop/supabase-backup-2026-05-26.sql
```

Then either:

- Apply our migrations via the Supabase CLI (`supabase db push`), OR
- Paste each `.sql` file into the Supabase SQL editor in numeric order.

## Architecture

- `src/app/(public)/` — no auth (landing, /auth)
- `src/app/(app)/` — auth-required (dashboard, onboarding, predictions, leaderboard, admin)
- `src/app/api/` — route handlers (SIWS, predictions, admin, cron)
- `src/lib/supabase/` — three Supabase client roles
- `src/lib/siws/` — Sign in with Solana flow
- `src/lib/solana/` — RPC + JagSOL balance check
- `src/lib/scoring/` — pure functions for points
- `supabase/migrations/` — schema + RLS + RPCs + views

## Phases

| Phase | Window | Scope |
|------|--------|-------|
| 1 | May 25 – Jun 1 | MVP foundation: auth, validator selection, group predictions |
| 2 | Jun 1 – Jun 10 | Match prediction system + scoring engine |
| 3 | Jun 11 – Jun 27 | Live leaderboard + Solana House integration |
| 4 | Jun 28 – Jul 3 | Knockout bracket |
| 5 | Jul 4 – Jul 19 | Finals + rewards |
| 6 | Jul 20+ | Wrap-up + analytics |

## License

Internal Superteam Brazil x JagPool project. Not open source.
