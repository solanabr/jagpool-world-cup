import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveAuthenticatedUserState } from "@/lib/user-state";
import { sanitizeUsername, isValidUuid } from "@/lib/security";

export async function POST(request: NextRequest) {
  const state = await resolveAuthenticatedUserState();
  if (!state) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { username?: string; validatorId?: string }
    | null;

  const username = sanitizeUsername(body?.username);
  if (!username) {
    return NextResponse.json({ error: "invalid_username" }, { status: 400 });
  }
  if (!body?.validatorId || !isValidUuid(body.validatorId)) {
    return NextResponse.json({ error: "invalid_validator" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  // Update username first (RLS allows self-update)
  const { error: updErr } = await supabase
    .from("users")
    .update({ username })
    .eq("id", state.userId);
  if (updErr) {
    if (updErr.code === "23505") {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "update_failed", details: updErr.message },
      { status: 500 },
    );
  }

  // Lock validator via SECURITY DEFINER RPC
  const { data, error: rpcErr } = await supabase.rpc("lock_validator", {
    p_validator_id: body.validatorId,
  });
  if (rpcErr) {
    return NextResponse.json(
      { error: "lock_failed", details: rpcErr.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ user: data });
}
