import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { isValidUuid } from "@/lib/security";
import { scoreMatchAndPersist } from "@/lib/scoring/persist";
import type { Match } from "@/types/db";

/**
 * Recompute scores for one match. Delegates to `scoreMatchAndPersist`,
 * which handles upsert + stale-row pruning so the leaderboard transitions
 * cleanly between an old and a corrected result.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  let body: { matchId?: string } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch (err) {
    console.error("[admin/rescore-match] invalid JSON", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!body?.matchId || !isValidUuid(body.matchId)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createServiceRoleClient();

  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", body.matchId)
    .maybeSingle();
  if (matchError) {
    console.error("[admin/rescore-match] match fetch failed", matchError);
    return NextResponse.json(
      { error: "fetch_match_failed", details: matchError.message },
      { status: 500 },
    );
  }
  if (!matchData) {
    return NextResponse.json({ error: "match_not_found" }, { status: 404 });
  }
  const match = matchData as Match;

  const scoring = await scoreMatchAndPersist(supabase, match);
  if (scoring.error) {
    console.error("[admin/rescore-match] scoring failed", scoring.error);
    // Stale-scan failures are partial-success — return 207, not 500.
    const isPartial =
      scoring.error.startsWith("stale-scan:") ||
      scoring.error.startsWith("stale-delete:");
    return NextResponse.json(
      {
        eventsWritten: scoring.eventsWritten,
        stalePruned: scoring.stalePruned ?? 0,
        warning: scoring.error,
      },
      { status: isPartial ? 207 : 500 },
    );
  }

  return NextResponse.json({
    eventsWritten: scoring.eventsWritten,
    stalePruned: scoring.stalePruned ?? 0,
  });
}
