import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { timingSafeEqual } from "@/lib/security";
import { scoreMatchPrediction } from "@/lib/scoring/compute";
import type { Match, MatchPrediction } from "@/types/db";

export async function GET(request: NextRequest) {
  const authz = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || !timingSafeEqual(authz, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "completed");

  if (matchesError) {
    console.error("[cron/score] failed to fetch matches", matchesError);
    return NextResponse.json(
      { error: "fetch_matches_failed", details: matchesError.message },
      { status: 500 },
    );
  }

  let totalEvents = 0;
  const failed: { matchId: string; reason: string }[] = [];

  for (const match of (matches as Match[]) ?? []) {
    try {
      const { count, error: countError } = await supabase
        .from("scores")
        .select("id", { count: "exact", head: true })
        .eq("match_id", match.id);
      if (countError) {
        throw new Error(`score count: ${countError.message}`);
      }
      if ((count ?? 0) > 0) continue;

      const { data: preds, error: predsError } = await supabase
        .from("match_predictions")
        .select("*")
        .eq("match_id", match.id);
      if (predsError) {
        throw new Error(`predictions fetch: ${predsError.message}`);
      }

      const events = ((preds as MatchPrediction[]) ?? []).flatMap((p) =>
        scoreMatchPrediction(p, match),
      );
      if (events.length === 0) continue;

      const { error: insertError } = await supabase.from("scores").insert(
        events.map((e) => ({
          user_id: e.userId,
          match_id: e.matchId,
          group_prediction_id: e.groupPredictionId,
          match_prediction_id: e.matchPredictionId,
          points: e.points,
          reason: e.reason,
        })),
      );
      if (insertError) {
        throw new Error(`scores insert: ${insertError.message}`);
      }

      totalEvents += events.length;
    } catch (err) {
      const reason = (err as Error).message;
      console.error("[cron/score] match failed", match.id, reason);
      failed.push({ matchId: match.id, reason });
    }
  }

  return NextResponse.json({
    events_written: totalEvents,
    failed,
  });
}
