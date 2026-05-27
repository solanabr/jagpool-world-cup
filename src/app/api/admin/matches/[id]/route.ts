import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { isValidUuid } from "@/lib/security";

// PATCH does NOT accept winner / homeScore / awayScore — those go through
// finalize_match RPC which enforces knockout-cannot-draw, locking, scoring.
// Allowing them here would let admins bypass those invariants.
type PatchBody = {
  homeTeam?: string | null;
  awayTeam?: string | null;
  kickoffAt?: string;
  status?: "upcoming" | "live" | "locked" | "cancelled";
  parentMatchA?: string | null;
  parentMatchB?: string | null;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: PatchBody | null;
  try {
    body = (await request.json()) as PatchBody | null;
  } catch (err) {
    console.error("[admin/matches PATCH] invalid JSON", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (!body) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  // Reject any attempt to patch result-related fields — must use finalize_match.
  if (
    "winner" in body ||
    "homeScore" in body ||
    "awayScore" in body
  ) {
    return NextResponse.json(
      {
        error: "use_finalize_match",
        details:
          "Use POST /api/admin/finalize-match to set result fields. PATCH cannot bypass scoring/locking invariants.",
      },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = {};
  if ("homeTeam" in body) update.home_team = body.homeTeam;
  if ("awayTeam" in body) update.away_team = body.awayTeam;
  if ("kickoffAt" in body) update.kickoff_at = body.kickoffAt;
  if ("status" in body) {
    // Defend at runtime against status = 'completed' even though the type
    // excludes it — body is HTTP input, the type is just a hint.
    if ((body.status as unknown as string) === "completed") {
      return NextResponse.json(
        {
          error: "use_finalize_match",
          details: "Use POST /api/admin/finalize-match to mark a match completed.",
        },
        { status: 400 },
      );
    }
    update.status = body.status;
  }
  if ("parentMatchA" in body) update.parent_match_a = body.parentMatchA;
  if ("parentMatchB" in body) update.parent_match_b = body.parentMatchB;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase
    .from("matches")
    .update(update)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "update_failed", details: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "match_not_found" }, { status: 404 });
  }

  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    admin_user_id: auth.state.userId,
    action: "update_match",
    target_table: "matches",
    target_id: id,
    changes: update,
  });
  if (auditError) {
    console.error("[admin/matches PATCH] audit log insert failed", auditError);
  }

  return NextResponse.json({ match: data });
}
