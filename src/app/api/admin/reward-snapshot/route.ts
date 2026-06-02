import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { isValidUuid, clampInt } from "@/lib/security";

const VALID_STATUSES = new Set(["draft", "finalized", "paid"]);

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  let body: {
    tournamentId?: string;
    topUsers?: number;
    notes?: string;
  } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch (err) {
    console.error("[admin/reward-snapshot POST] invalid JSON", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!body?.tournamentId || !isValidUuid(body.tournamentId)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const topUsers = clampInt(body.topUsers ?? 10, 1, 100) ?? 10;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_reward_snapshot", {
    p_tournament_id: body.tournamentId,
    p_top_users: topUsers,
    p_notes: body.notes ?? null,
  });

  if (error) {
    return NextResponse.json(
      { error: "snapshot_failed", details: error.message },
      { status: 400 },
    );
  }
  return NextResponse.json({ snapshot: data });
}

// PATCH transitions a snapshot through draft → finalized → paid.
// Delegates to the set_reward_snapshot_status RPC which gates on is_admin
// inside the function (defence in depth on top of requireAdmin here).
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  let body: { snapshotId?: string; status?: string } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch (err) {
    console.error("[admin/reward-snapshot PATCH] invalid JSON", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (
    !body?.snapshotId ||
    !isValidUuid(body.snapshotId) ||
    !body.status ||
    !VALID_STATUSES.has(body.status)
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("set_reward_snapshot_status", {
    p_snapshot_id: body.snapshotId,
    p_status: body.status,
  });

  if (error) {
    return NextResponse.json(
      { error: "status_update_failed", details: error.message },
      { status: 400 },
    );
  }
  return NextResponse.json({ snapshot: data });
}

// DELETE removes a snapshot (the RPC blocks `paid` — a real payout record).
// Cascades to reward_users + reward_validators.
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  let body: { snapshotId?: string } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch (err) {
    console.error("[admin/reward-snapshot DELETE] invalid JSON", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!body?.snapshotId || !isValidUuid(body.snapshotId)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("delete_reward_snapshot", {
    p_snapshot_id: body.snapshotId,
  });

  if (error) {
    return NextResponse.json(
      { error: "delete_failed", details: error.message },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
