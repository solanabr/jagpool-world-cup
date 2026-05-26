import { resolveAuthenticatedUserState } from "./user-state";

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdminWallet(walletAddress: string | null): boolean {
  if (!walletAddress) return false;
  const wallets = splitList(process.env.ADMIN_WALLET_ALLOWLIST);
  return wallets.includes(walletAddress);
}

export async function requireAdmin() {
  const state = await resolveAuthenticatedUserState();
  if (!state) return { ok: false as const, reason: "unauthenticated" as const };
  if (!state.profile?.is_admin && !isAdminWallet(state.walletAddress)) {
    return { ok: false as const, reason: "forbidden" as const };
  }
  return { ok: true as const, state };
}
