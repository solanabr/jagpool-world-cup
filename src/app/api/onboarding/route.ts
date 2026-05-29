import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveAuthenticatedUserState } from "@/lib/user-state";
import { isValidUuid } from "@/lib/security";

export async function POST(request: NextRequest) {
  const state = await resolveAuthenticatedUserState();
  if (!state) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { validatorId?: string }
    | null;

  if (!body?.validatorId || !isValidUuid(body.validatorId)) {
    return NextResponse.json({ error: "invalid_validator" }, { status: 400 });
  }

  // X must be linked before locking a validator — enforces the onboarding order
  // server-side so the permanent validator choice can't be set out of band.
  if (!state.profile?.x_user_id) {
    return NextResponse.json({ error: "x_not_linked" }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();

  // Validator selection routes through a SECURITY DEFINER RPC. The X handle is
  // set by the X-link sync (/auth/callback), not here.
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
