import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveAuthenticatedUserState } from "@/lib/user-state";
import { isValidUuid, clampInt } from "@/lib/security";

export async function POST(request: NextRequest) {
  const state = await resolveAuthenticatedUserState();
  if (!state) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        matchId?: string;
        winner?: "home" | "away" | "draw";
        homeScore?: number;
        awayScore?: number;
      }
    | null;

  if (
    !body?.matchId ||
    !isValidUuid(body.matchId) ||
    !body.winner ||
    !["home", "away", "draw"].includes(body.winner)
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const homeScore = body.homeScore != null ? clampInt(body.homeScore, 0, 99) : null;
  const awayScore = body.awayScore != null ? clampInt(body.awayScore, 0, 99) : null;
  if (body.homeScore != null && homeScore === null) {
    return NextResponse.json({ error: "invalid_score" }, { status: 400 });
  }
  if (body.awayScore != null && awayScore === null) {
    return NextResponse.json({ error: "invalid_score" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("submit_match_prediction", {
    p_match_id: body.matchId,
    p_winner: body.winner,
    p_home_score: homeScore,
    p_away_score: awayScore,
  });

  if (error) {
    return NextResponse.json(
      { error: "submit_failed", details: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ prediction: data });
}
