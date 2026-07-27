import { NextResponse, type NextRequest } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { MatchStage } from "@/types/db";

const STAGES: MatchStage[] = [
  "group",
  "round_of_32",
  "round_of_16",
  "quarter",
  "semi",
  "third_place",
  "final",
];

/**
 * Force a stage's prediction window open or closed, independent of kickoff time.
 * Knockout stages flip `matches.prediction_open_override` (and unlock the
 * per-prediction `locked` flag so the forms are editable again). The group stage
 * has no per-match window — it's gated by `tournaments.group_lock_at`, so
 * opening it clears that timestamp and closing sets it to now.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  let body: { stage?: string; open?: boolean } | null;
  try {
    body = (await request.json()) as typeof body;
  } catch (err) {
    console.error("[admin/stage-lock] invalid JSON", err);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const stage = body?.stage as MatchStage | undefined;
  const open = body?.open;
  if (!stage || !STAGES.includes(stage) || typeof open !== "boolean") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: "no_active_tournament" }, { status: 400 });
  }

  const service = await createServiceRoleClient();

  if (stage === "group") {
    const { error } = await service
      .from("tournaments")
      .update({ group_lock_at: open ? null : new Date().toISOString() })
      .eq("id", tournament.id);
    if (error) {
      console.error("[admin/stage-lock] group update failed", error);
      return NextResponse.json(
        { error: "update_failed", details: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json({ stage, open, scope: "group_lock_at" });
  }

  const { data: updated, error } = await service
    .from("matches")
    .update({ prediction_open_override: open })
    .eq("tournament_id", tournament.id)
    .eq("stage", stage)
    .select("id");
  if (error) {
    console.error("[admin/stage-lock] matches update failed", error);
    return NextResponse.json(
      { error: "update_failed", details: error.message },
      { status: 400 },
    );
  }

  const matchIds = (updated ?? []).map((m) => m.id);
  // Re-opening also clears the per-prediction locked flag so existing picks
  // become editable again; closing lets the cron re-lock on its next pass.
  if (open && matchIds.length > 0) {
    const { error: unlockError } = await service
      .from("match_predictions")
      .update({ locked: false })
      .in("match_id", matchIds);
    if (unlockError) {
      console.error("[admin/stage-lock] prediction unlock failed", unlockError);
      return NextResponse.json(
        { stage, open, matches: matchIds.length, warning: "predictions_not_unlocked" },
        { status: 207 },
      );
    }
  }

  return NextResponse.json({ stage, open, matches: matchIds.length });
}
