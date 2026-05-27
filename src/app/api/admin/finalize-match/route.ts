import { NextResponse, type NextRequest } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { isValidUuid, clampInt } from "@/lib/security";
import {
  scoreChampionsAndPersist,
  scoreMatchAndPersist,
} from "@/lib/scoring/persist";
import type { Match } from "@/types/db";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  let body: {
    matchId?: string;
    homeScore?: number;
    awayScore?: number;
    winner?: "home" | "away" | "draw";
  } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch (err) {
    console.error("[admin/finalize-match] invalid JSON", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (
    !body?.matchId ||
    !isValidUuid(body.matchId) ||
    !body.winner ||
    !["home", "away", "draw"].includes(body.winner)
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const homeScore = clampInt(body.homeScore, 0, 99);
  const awayScore = clampInt(body.awayScore, 0, 99);
  if (homeScore === null || awayScore === null) {
    return NextResponse.json({ error: "invalid_score" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  // Early validation: knockout matches can't end in draw. The RPC also enforces
  // this, but rejecting here gives a clearer error code.
  const { data: matchPreview } = await supabase
    .from("matches")
    .select("stage")
    .eq("id", body.matchId)
    .maybeSingle();
  if (
    matchPreview &&
    matchPreview.stage !== "group" &&
    body.winner === "draw"
  ) {
    return NextResponse.json(
      { error: "knockout_cannot_draw" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("finalize_match", {
    p_match_id: body.matchId,
    p_home_score: homeScore,
    p_away_score: awayScore,
    p_winner: body.winner,
  });

  if (error) {
    return NextResponse.json(
      { error: "finalize_failed", details: error.message },
      { status: 400 },
    );
  }

  const match = data as Match;
  const result: {
    match: Match;
    matchScoring?: { eventsWritten: number; error: string | null };
    championScoring?: { eventsWritten: number; error: string | null };
    warning?: string;
  } = { match };

  // H1 (Codex audit): score the match inline instead of waiting up to 5 min
  // for cron. Cron is now backup-only; the user sees points immediately.
  // Group matches don't score per-match (group_predictions handles those).
  if (match.stage !== "group" && match.winner) {
    const service = await createServiceRoleClient();
    const matchScoring = await scoreMatchAndPersist(service, match);
    result.matchScoring = {
      eventsWritten: matchScoring.eventsWritten,
      error: matchScoring.error ?? null,
    };
    if (matchScoring.error) {
      console.error(
        "[admin/finalize-match] match scoring failed",
        matchScoring.error,
      );
      result.warning =
        "match finalized, but scoring failed — run rescore from admin UI";
      return NextResponse.json(result, { status: 207 });
    }
  }

  // If we just finalized the tournament final, score everyone's champion pick.
  if (match.stage === "final" && match.winner && match.winner !== "draw") {
    const championTeam =
      match.winner === "home" ? match.home_team : match.away_team;
    if (championTeam) {
      const service = await createServiceRoleClient();
      const scoring = await scoreChampionsAndPersist(
        service,
        match.tournament_id,
        championTeam,
      );
      result.championScoring = {
        eventsWritten: scoring.eventsWritten,
        error: scoring.error ?? null,
      };

      if (scoring.error) {
        console.error(
          "[admin/finalize-match] final finalized but champion scoring failed",
          scoring.error,
        );
        result.warning =
          "final finalized, but champion scoring failed — manual rescore needed";
        return NextResponse.json(result, { status: 207 });
      }
    }
  }

  return NextResponse.json(result);
}
