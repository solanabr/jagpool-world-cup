import Link from "next/link";
import { resolveAuthenticatedUserState } from "@/lib/user-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAdminWallet } from "@/lib/admin";
import { WalletStatus } from "@/components/auth/wallet-status";

export async function Header() {
  const state = await resolveAuthenticatedUserState();
  let validatorName: string | null = null;

  if (state?.profile?.validator_id) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("validators")
      .select("name")
      .eq("id", state.profile.validator_id)
      .maybeSingle();
    validatorName = data?.name ?? null;
  }

  const isAdmin =
    !!state &&
    (state.profile?.is_admin === true || isAdminWallet(state.walletAddress));

  return (
    <header className="border-b border-white/10 bg-background/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href={state ? "/dashboard" : "/"} className="font-bold text-lg text-foreground no-underline">
          JagPool <span className="text-jagpool-primary">WC 2026</span>
        </Link>
        {state ? (
          <div className="flex items-center gap-4">
            {isAdmin ? (
              <Link
                href="/admin"
                className="text-sm text-jagpool-primary hover:text-jagpool-primary-hover no-underline"
              >
                Admin
              </Link>
            ) : null}
            <WalletStatus
              username={state.profile?.username ?? null}
              walletAddress={state.walletAddress}
              validatorName={validatorName}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}
