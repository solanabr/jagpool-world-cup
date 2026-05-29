import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "./supabase/server";
import type { User } from "@/types/db";

export type AuthenticatedState = {
  userId: string;
  walletAddress: string;
  profile: User | null;
  redirectPath: string;
};

export const resolveAuthenticatedUserState = cache(async function (): Promise<AuthenticatedState | null> {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasAuthCookie) return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const typed = profile as User | null;
  const walletAddress =
    typed?.wallet_address ?? (user.user_metadata?.wallet_address as string | undefined) ?? "";

  const needsOnboarding = !typed || !typed.username || !typed.validator_locked_at;

  return {
    userId: user.id,
    walletAddress,
    profile: typed,
    redirectPath: needsOnboarding ? "/onboarding" : "/dashboard",
  };
});

export async function requireUser() {
  const state = await resolveAuthenticatedUserState();
  if (!state) redirect("/");
  return state;
}

export async function requireOnboardedUser() {
  const state = await requireUser();
  if (!state.profile || !state.profile.validator_locked_at) {
    redirect("/onboarding");
  }
  return state;
}
