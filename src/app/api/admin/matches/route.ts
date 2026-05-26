import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { isValidUuid } from "@/lib/security";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    tournamentId?: string;
    stage?: string;
    groupName?: string | null;
    matchNumber?: number;
    homeTeam?: string | null;
    awayTeam?: string | null;
    kickoffAt?: string;
    parentMatchA?: string | null;
    parentMatchB?: string | null;
  } | null;

  if (
    !body?.tournamentId ||
    !isValidUuid(body.tournamentId) ||
    !body.stage ||
    !body.kickoffAt
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase
    .from("matches")
    .insert({
      tournament_id: body.tournamentId,
      stage: body.stage,
      group_name: body.groupName ?? null,
      match_number: body.matchNumber ?? 0,
      home_team: body.homeTeam ?? null,
      away_team: body.awayTeam ?? null,
      kickoff_at: body.kickoffAt,
      parent_match_a: body.parentMatchA ?? null,
      parent_match_b: body.parentMatchB ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "insert_failed", details: error.message },
      { status: 500 },
    );
  }

  await supabase.from("admin_audit_log").insert({
    admin_user_id: auth.state.userId,
    action: "create_match",
    target_table: "matches",
    target_id: data.id,
    changes: body as Record<string, unknown>,
  });

  return NextResponse.json({ match: data });
}
