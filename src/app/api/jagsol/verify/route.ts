import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { resolveAuthenticatedUserState } from "@/lib/user-state";
import { getJagsolBalance, meetsMinimum } from "@/lib/solana/jagsol";

export async function POST() {
  const state = await resolveAuthenticatedUserState();
  if (!state) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!state.walletAddress) {
    return NextResponse.json({ error: "no_wallet" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("min_jagsol_amount")
    .eq("is_active", true)
    .maybeSingle();

  const minimum = Number(tournament?.min_jagsol_amount ?? 0);
  const balance = await getJagsolBalance(state.walletAddress);

  const verifiedAt = new Date().toISOString();
  const service = await createServiceRoleClient();
  await service
    .from("users")
    .update({
      jagsol_verified_at: verifiedAt,
      jagsol_balance: balance?.uiAmount.toString() ?? null,
    })
    .eq("id", state.userId);

  return NextResponse.json({
    balance: balance?.uiAmount.toString() ?? "0",
    meetsMinimum: meetsMinimum(balance, minimum),
    minimumRequired: minimum.toString(),
    verifiedAt,
  });
}
