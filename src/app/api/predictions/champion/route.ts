import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveAuthenticatedUserState } from "@/lib/user-state";
import { isValidUuid } from "@/lib/security";

export async function POST(request: NextRequest) {
  const state = await resolveAuthenticatedUserState();
  if (!state) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { tournamentId?: string; team?: string } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch (err) {
    console.error("[predictions/champion] invalid JSON", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (
    !body?.tournamentId ||
    !isValidUuid(body.tournamentId) ||
    !body.team ||
    typeof body.team !== "string" ||
    body.team.trim().length === 0
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("submit_champion_prediction", {
    p_tournament_id: body.tournamentId,
    p_team: body.team,
  });

  if (error) {
    return NextResponse.json(
      { error: "submit_failed", details: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ prediction: data });
}
