import { redirect } from "next/navigation";
import { resolveAuthenticatedUserState } from "@/lib/user-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import type { Validator } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const state = await resolveAuthenticatedUserState();
  if (!state) redirect("/");
  if (state.profile?.x_user_id && state.profile?.validator_locked_at) {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const { data: validators } = await supabase
    .from("validators")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <StepDot done />
          <div className="h-px w-6 bg-[#129D49]/40" />
          <StepDot active />
          <span className="text-xs text-foreground/40 ml-2 uppercase tracking-wider">
            Setup · Step 2 of 2
          </span>
        </div>
        <h1 className="text-4xl font-black tracking-tight">
          Pick your{" "}
          <span className="text-[#129D49]">validator team</span>
        </h1>
        <p className="text-foreground/55 max-w-xl leading-relaxed">
          Your points contribute to your validator&apos;s collective score —
          the winning validator earns extra SOL delegation from JagPool.{" "}
          <strong className="text-foreground/75">
            This choice is permanent.
          </strong>
        </p>
      </div>

      <OnboardingForm
        validators={(validators as Validator[]) ?? []}
        profile={state.profile}
      />
    </div>
  );
}

function StepDot({ done, active }: { done?: boolean; active?: boolean }) {
  if (done) {
    return (
      <div className="w-6 h-6 rounded-full bg-[#129D49] flex items-center justify-center shrink-0">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
    );
  }
  if (active) {
    return (
      <div className="w-6 h-6 rounded-full bg-[#129D49]/20 border-2 border-[#129D49] flex items-center justify-center shrink-0">
        <div className="w-2 h-2 rounded-full bg-[#129D49]" />
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 shrink-0" />
  );
}
