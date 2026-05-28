import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveAuthenticatedUserState } from "@/lib/user-state";
import { isValidUuid } from "@/lib/security";

type Pick = { groupName?: string; teamName?: string };

export async function POST(request: NextRequest) {
  const state = await resolveAuthenticatedUserState();
  if (!state) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: {
    tournamentId?: string;
    picks?: Pick[];
    champion?: string | null;
  } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch (err) {
    console.error("[predictions/advancers] invalid JSON", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!body?.tournamentId || !isValidUuid(body.tournamentId)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (!Array.isArray(body.picks)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const picks = body.picks
    .filter(
      (p): p is Required<Pick> =>
        typeof p?.groupName === "string" && typeof p?.teamName === "string",
    )
    .map((p) => ({ groupName: p.groupName, teamName: p.teamName }));

  const champion =
    typeof body.champion === "string" && body.champion.trim().length > 0
      ? body.champion
      : null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("submit_group_stage_predictions", {
    p_tournament_id: body.tournamentId,
    p_picks: picks,
    p_champion: champion,
  });

  if (error) {
    return NextResponse.json(
      { error: "submit_failed", details: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, count: data ?? picks.length, champion });
}
