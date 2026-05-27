# Agent notes

Next.js 16 App Router-specific warnings for contributors (human or AI).

## Don't

- **Don't run `create-next-app`** — the project was scaffolded by hand; running the CLI here will fail (non-empty dir) or wipe configuration.
- **Don't add auth checks in `(app)/layout.tsx`** — middleware already gates auth. Layout-level checks cause redirect loops on token refresh.
- **Don't use `.single()`** on Supabase queries unless you've verified the row must exist. Use `.maybeSingle()` and handle null.
- **Don't introduce a service-role call from a client component.** The service role key must never reach the browser.
- **Don't apply migrations to the live DB without backing it up first.** Schema changes are easy to undo with `pg_dump` in hand; without it, you're rolling back from memory.
- **Don't add backwards-compatibility shims** for removed code. Delete cleanly.

## Do

- Use `createServerSupabaseClient()` from `src/lib/supabase/server.ts` for server components and route handlers. RLS handles auth.
- Use `createServiceRoleClient()` only for: SIWS verify, admin endpoints (gated by `requireAdmin()`), and `/api/cron/*` (gated by `CRON_SECRET`).
- Add `export const dynamic = 'force-dynamic'` on any new `(app)/*` page that reads auth state.
- Mirror the pattern in `lib/user-state.ts` for any new gated page: call `requireUser()` or `requireOnboardedUser()` server-side.
- Validate all user input via `lib/security.ts` helpers before passing to RPCs.
- When adding cross-table mutations with invariants, prefer a SECURITY DEFINER RPC over a server action with the service role.
