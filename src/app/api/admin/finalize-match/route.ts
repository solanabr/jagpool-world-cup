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
import { resolveBracketAdvancement } from "@/lib/wc2026/knockout";
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

  // Scores are optional now — early knockout rounds are winner-only. Only
  // reject when a score was provided but is out of range.
  const homeScore =
    body.homeScore != null ? clampInt(body.homeScore, 0, 99) : null;
  const awayScore =
    body.awayScore != null ? clampInt(body.awayScore, 0, 99) : null;
  if (
    (body.homeScore != null && homeScore === null) ||
    (body.awayScore != null && awayScore === null)
  ) {
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
    propagated?: number;
    matchScoring?: { eventsWritten: number; error: string | null };
    championScoring?: { eventsWritten: number; error: string | null };
    warning?: string;
  } = { match };

  const warnings: string[] = [];

  // Knockout-only work: bracket propagation + inline scoring. Group matches
  // don't feed a bracket and score via advancer predictions, not per-match.
  if (match.stage !== "group" && match.winner && match.winner !== "draw") {
    const service = await createServiceRoleClient();

    if (match.home_team && match.away_team) {
      const { data: children, error: childErr } = await service
        .from("matches")
        .select("id, stage, status, parent_match_a, parent_match_b")
        .or(`parent_match_a.eq.${match.id},parent_match_b.eq.${match.id}`);
      if (childErr) {
        console.error("[admin/finalize-match] child lookup failed", childErr);
        warnings.push("bracket lookup failed — verify downstream slots");
      }
      const advancements = resolveBracketAdvancement(
        match,
        (children as Parameters<typeof resolveBracketAdvancement>[1]) ?? [],
      );
      let propagated = 0;
      const failed: string[] = [];
      const overwrote: string[] = [];
      for (const adv of advancements) {
        const { error: upErr } = await service
          .from("matches")
          .update(adv.patch)
          .eq("id", adv.childId);
        if (upErr) {
          console.error("[admin/finalize-match] propagation failed", adv.childId, upErr);
          failed.push(adv.childId);
        } else {
          propagated++;
          if (adv.childWasCompleted) overwrote.push(adv.childId);
        }
      }
      result.propagated = propagated;
      if (failed.length > 0) {
        warnings.push(
          `${failed.length} downstream slot(s) failed to update — re-finalize to retry`,
        );
      }
      if (overwrote.length > 0) {
        warnings.push(
          `${overwrote.length} already-finalized downstream match(es) had a team replaced — re-finalize them`,
        );
      }
    }

    const matchScoring = await scoreMatchAndPersist(service, match);
    result.matchScoring = {
      eventsWritten: matchScoring.eventsWritten,
      error: matchScoring.error ?? null,
    };
    if (matchScoring.error) {
      console.error("[admin/finalize-match] match scoring failed", matchScoring.error);
      warnings.push("scoring failed — run rescore from admin UI");
      result.warning = warnings.join("; ");
      return NextResponse.json(result, { status: 207 });
    }

    if (match.stage === "final") {
      const championTeam =
        match.winner === "home" ? match.home_team : match.away_team;
      if (championTeam) {
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
          console.error("[admin/finalize-match] champion scoring failed", scoring.error);
          warnings.push("champion scoring failed — manual rescore needed");
          result.warning = warnings.join("; ");
          return NextResponse.json(result, { status: 207 });
        }
      }
    }
  }

  if (warnings.length > 0) {
    result.warning = warnings.join("; ");
    return NextResponse.json(result, { status: 207 });
  }
  return NextResponse.json(result);
}
