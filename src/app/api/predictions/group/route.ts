import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveAuthenticatedUserState } from "@/lib/user-state";
import { isValidUuid } from "@/lib/security";

export async function POST(request: NextRequest) {
  const state = await resolveAuthenticatedUserState();
  if (!state) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body:
    | {
        tournamentId?: string;
        groupName?: string;
        team1?: string;
        team2?: string;
      }
    | null;
  try {
    body = (await request.json()) as typeof body;
  } catch (err) {
    console.error("[predictions/group] invalid JSON", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (
    !body?.tournamentId ||
    !isValidUuid(body.tournamentId) ||
    !body.groupName ||
    typeof body.groupName !== "string" ||
    !body.team1 ||
    !body.team2 ||
    body.team1 === body.team2
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("submit_group_prediction", {
    p_tournament_id: body.tournamentId,
    p_group_name: body.groupName,
    p_team_1: body.team1,
    p_team_2: body.team2,
  });

  if (error) {
    return NextResponse.json(
      { error: "submit_failed", details: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ prediction: data });
}
