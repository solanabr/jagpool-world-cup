import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { clampInt, isValidUuid } from "@/lib/security";

type PatchBody = {
  homeTeam?: string | null;
  awayTeam?: string | null;
  kickoffAt?: string;
  status?: "upcoming" | "live" | "locked" | "completed" | "cancelled";
  homeScore?: number | null;
  awayScore?: number | null;
  winner?: "home" | "away" | "draw" | null;
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

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if ("homeTeam" in body) update.home_team = body.homeTeam;
  if ("awayTeam" in body) update.away_team = body.awayTeam;
  if ("kickoffAt" in body) update.kickoff_at = body.kickoffAt;
  if ("status" in body) update.status = body.status;
  if ("homeScore" in body) {
    if (body.homeScore != null) {
      const n = clampInt(body.homeScore, 0, 99);
      if (n === null) return NextResponse.json({ error: "invalid_score" }, { status: 400 });
      update.home_score = n;
    } else {
      update.home_score = null;
    }
  }
  if ("awayScore" in body) {
    if (body.awayScore != null) {
      const n = clampInt(body.awayScore, 0, 99);
      if (n === null) return NextResponse.json({ error: "invalid_score" }, { status: 400 });
      update.away_score = n;
    } else {
      update.away_score = null;
    }
  }
  if ("winner" in body) update.winner = body.winner;
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

  await supabase.from("admin_audit_log").insert({
    admin_user_id: auth.state.userId,
    action: "update_match",
    target_table: "matches",
    target_id: id,
    changes: update,
  });

  return NextResponse.json({ match: data });
}
