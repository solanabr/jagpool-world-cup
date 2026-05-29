import Link from "next/link";
import Image from "next/image";
import { resolveAuthenticatedUserState } from "@/lib/user-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { WalletStatus } from "@/components/auth/wallet-status";
import { SiwsButton } from "@/components/auth/siws-button";
import { NavLinks } from "@/components/layout/nav-links";

export async function Header({ transparent = false, staticMode = false }: { transparent?: boolean; staticMode?: boolean }) {
  const state = staticMode ? null : await resolveAuthenticatedUserState();
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
        <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-[#129D49]/40 to-transparent" />
      )}

      <div className="max-w-6xl mx-auto px-5 h-18 flex items-center justify-between gap-8">

        <div className="flex items-center gap-6 h-full">

          <Link
            href={state ? "/dashboard" : "/"}
            className="no-underline shrink-0 flex items-center gap-2.5"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
              <Image
                src="/brand/jgst.svg"
                alt="JagPool × Superteam Brazil"
                width={40}
                height={40}
                unoptimized
                className="w-full h-full"
              />
            </div>
            <div className="flex flex-col leading-none gap-[3px]">
              <span className="font-black text-sm tracking-tight text-white">
                JagPool{" "}
                <span style={{
                  background: "linear-gradient(90deg, #129D49, #FFD23F, #129D49)",
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "gradient-flow 3s linear infinite",
                }}>
                  WC 2026
                </span>
              </span>
              <span className="text-[9px] font-semibold text-white/30 tracking-[0.18em] uppercase">
                × Superteam Brazil
              </span>
            </div>
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
            avatarUrl={state.profile?.x_avatar_url ?? null}
            walletAddress={state.walletAddress}
            validatorName={validatorName}
            isAdmin={isAdmin}
          />
        ) : (
          <div className={staticMode ? "hidden sm:block" : undefined}>
            <SiwsButton compact />
          </div>
        )}
      </div>
    </header>
  );
}
