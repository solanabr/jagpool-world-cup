import Link from "next/link";
import { resolveAuthenticatedUserState } from "@/lib/user-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { WalletStatus } from "@/components/auth/wallet-status";
import { SiwsButton } from "@/components/auth/siws-button";
import { NavLinks } from "@/components/layout/nav-links";

export async function Header({ transparent = false }: { transparent?: boolean }) {
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

  const isAdmin = !!state && state.profile?.is_admin === true;

  return (
    <header className={`sticky top-0 z-30 ${transparent ? "" : "bg-background/90 backdrop-blur-xl"}`}>
      {!transparent && (
        <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-jagpool-primary/35 to-transparent" />
      )}

      <div className="max-w-6xl mx-auto px-5 h-18 flex items-center justify-between gap-8">

        <div className="flex items-center gap-6 h-full">

          <Link
            href={state ? "/dashboard" : "/"}
            className="no-underline shrink-0 font-black text-xl tracking-tight text-white leading-none"
          >
            JagPool{" "}
            <span className="text-jagpool-primary">WC 2026</span>
          </Link>

          {state?.profile?.validator_locked_at ? (
            <>
              <div className="h-5 w-px bg-white/10 shrink-0 hidden lg:block" />
              <NavLinks />
            </>
          ) : null}
        </div>

        {state ? (
          <WalletStatus
            username={state.profile?.username ?? null}
            walletAddress={state.walletAddress}
            validatorName={validatorName}
            isAdmin={isAdmin}
          />
        ) : (
          <SiwsButton compact />
        )}
      </div>
    </header>
  );
}
