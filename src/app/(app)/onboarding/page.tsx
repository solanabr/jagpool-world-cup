import { redirect } from "next/navigation";
import { resolveAuthenticatedUserState } from "@/lib/user-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import type { Validator } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const state = await resolveAuthenticatedUserState();
  if (!state) redirect("/auth");
  if (state.profile?.validator_locked_at) redirect("/dashboard");

  const supabase = await createServerSupabaseClient();
  const { data: validators } = await supabase
    .from("validators")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Almost there</h1>
      <p className="text-foreground/70 mb-8">
        Pick your username and the validator that will receive your points. Your
        validator is locked once confirmed.
      </p>
      <OnboardingForm validators={(validators as Validator[]) ?? []} />
    </div>
  );
}
