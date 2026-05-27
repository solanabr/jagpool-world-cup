import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { timingSafeEqual } from "@/lib/security";
import { scoreMatchAndPersist } from "@/lib/scoring/persist";
import type { Match } from "@/types/db";

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

  // Cron is now a safety net — finalize_match scores knockout predictions
  // inline. Cron picks up anything missed (e.g. inline scoring failed) by
  // skipping matches already scored and processing the rest. The shared
  // `scoreMatchAndPersist` is the single source of truth for the math.
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

      const scoring = await scoreMatchAndPersist(supabase, match);
      if (scoring.error) throw new Error(scoring.error);
      totalEvents += scoring.eventsWritten;
    } catch (err) {
      const reason = (err as Error).message;
      console.error("[cron/score] match failed", match.id, reason);
      failed.push({ matchId: match.id, reason });
    }
  }

  // 207 Multi-Status when any match failed — Vercel cron will surface this as
  // an alert. 200 only if everything succeeded.
  if (failed.length > 0) {
    return NextResponse.json(
      { events_written: totalEvents, failed },
      { status: 207 },
    );
  }
  return NextResponse.json({ events_written: totalEvents, failed });
}
