import { resolveAuthenticatedUserState } from "./user-state";

// Single source of truth is `users.is_admin`. The previous fallback to
// `ADMIN_WALLET_ALLOWLIST` led to a layer-mismatch: a wallet on the
// allowlist would pass `requireAdmin()` here but fail the `is_admin = true`
// check inside our SECURITY DEFINER RPCs. Bootstrap the first admin via
// a direct DB update (see CLAUDE.md / README).
export async function requireAdmin() {
  const state = await resolveAuthenticatedUserState();
  if (!state) return { ok: false as const, reason: "unauthenticated" as const };
  if (!state.profile?.is_admin) {
    return { ok: false as const, reason: "forbidden" as const };
  }
  return { ok: true as const, state };
}
