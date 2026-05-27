import type { SupabaseClient } from "@supabase/supabase-js";
import {
  scoreGroupPrediction,
  scoreChampionPrediction,
  scoreMatchPrediction,
  type ScoreEvent,
} from "./compute";
import { REASONS } from "./rules";
import type { Match, MatchPrediction } from "@/types/db";

// The DB row shape — flat because the unique partial indexes need each FK
// in its own column. The discriminated `ScoreEvent` carries only the FKs the
// scoring kind actually needs; this flattener fans them out.
type ScoreRow = {
  user_id: string;
  tournament_id: string;
  match_id: string | null;
  group_prediction_id: string | null;
  match_prediction_id: string | null;
  champion_prediction_user_id: string | null;
  points: number;
  reason: string;
};

function toScoreRow(e: ScoreEvent, tournamentId: string): ScoreRow {
  switch (e.reason) {
    case REASONS.GROUP_ADVANCER:
      return {
        user_id: e.userId,
        tournament_id: tournamentId,
        match_id: null,
        group_prediction_id: e.groupPredictionId,
        match_prediction_id: null,
        champion_prediction_user_id: null,
        points: e.points,
        reason: e.reason,
      };
    case REASONS.KNOCKOUT_WINNER:
    case REASONS.LATE_STAGE_WINNER_SCORE:
    case REASONS.LATE_STAGE_LOSER_SCORE:
      return {
        user_id: e.userId,
        tournament_id: tournamentId,
        match_id: e.matchId,
        group_prediction_id: null,
        match_prediction_id: e.matchPredictionId,
        champion_prediction_user_id: null,
        points: e.points,
        reason: e.reason,
      };
    case REASONS.CHAMPION:
      return {
        user_id: e.userId,
        tournament_id: tournamentId,
        match_id: null,
        group_prediction_id: null,
        match_prediction_id: null,
        champion_prediction_user_id: e.championPredictionUserId,
        points: e.points,
        reason: e.reason,
      };
  }
}

/**
 * Score all match predictions for a finalized knockout match.
 * Upserts current events, then prunes stale rows so a finalize-then-correct
 * cycle doesn't leave dead points behind (a prediction that scored under
 * the OLD winner no longer scores under the NEW winner, so its row must go).
 * Called from finalize_match AND rescore-match — single source of truth.
 */
export async function scoreMatchAndPersist(
  supabase: SupabaseClient,
  match: Match,
): Promise<{ eventsWritten: number; stalePruned?: number; error?: string }> {
  const { data: preds, error: predsError } = await supabase
    .from("match_predictions")
    .select("*")
    .eq("match_id", match.id);
  if (predsError) {
    console.error("[scoreMatchAndPersist] predictions fetch failed", predsError);
    return { eventsWritten: 0, error: `fetch: ${predsError.message}` };
  }

  const allEvents: ScoreEvent[] = [];
  for (const p of (preds as MatchPrediction[]) ?? []) {
    allEvents.push(...scoreMatchPrediction(p, match));
  }

  // Valid keys = (match_prediction_id, reason) pairs the current scoring
  // produces. Anything in `scores` for this match outside this set is stale.
  const validKeys = new Set(
    allEvents
      .filter((e) => "matchPredictionId" in e)
      .map((e) => `${e.matchPredictionId}|${e.reason}`),
  );

  if (allEvents.length > 0) {
    const { error: upsertError } = await supabase
      .from("scores")
      .upsert(
        allEvents.map((e) => toScoreRow(e, match.tournament_id)),
        { onConflict: "match_prediction_id,reason", ignoreDuplicates: false },
      );
    if (upsertError) {
      return { eventsWritten: 0, error: `upsert: ${upsertError.message}` };
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from("scores")
    .select("id, match_prediction_id, reason")
    .eq("match_id", match.id);
  if (existingError) {
    console.error("[scoreMatchAndPersist] stale-scan failed", existingError);
    // Don't fail the whole call — the upsert already succeeded.
    return {
      eventsWritten: allEvents.length,
      error: `stale-scan: ${existingError.message}`,
    };
  }

  const staleIds: string[] = [];
  for (const row of existing ?? []) {
    const key = `${row.match_prediction_id}|${row.reason}`;
    if (!validKeys.has(key)) staleIds.push(row.id);
  }

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("scores")
      .delete()
      .in("id", staleIds);
    if (deleteError) {
      console.error("[scoreMatchAndPersist] stale delete failed", deleteError);
      return {
        eventsWritten: allEvents.length,
        error: `stale-delete: ${deleteError.message}`,
      };
    }
  }

  return { eventsWritten: allEvents.length, stalePruned: staleIds.length };
}

/**
 * Score all group predictions for a given (tournament, group) against the
 * provided actual advancers. Delete-then-insert so admin corrections drop
 * stale points for users who used to score but no longer do.
 */
export async function scoreGroupAndPersist(
  supabase: SupabaseClient,
  tournamentId: string,
  groupName: string,
  actualAdvancing: { team1: string; team2: string },
): Promise<{ eventsWritten: number; error?: string }> {
  const { data, error: fetchError } = await supabase.rpc(
    "get_group_predictions_for_scoring",
    { p_tournament_id: tournamentId, p_group_name: groupName },
  );
  if (fetchError) {
    console.error("[scoreGroupAndPersist] fetch RPC failed", fetchError);
    return { eventsWritten: 0, error: `fetch: ${fetchError.message}` };
  }
  if (!data) {
    console.warn(
      "[scoreGroupAndPersist] RPC returned null data without error",
      { tournamentId, groupName },
    );
  }
  const predictions = (data ?? []) as {
    id: string;
    user_id: string;
    advancing_team_1: string;
    advancing_team_2: string;
  }[];

  const allEvents: ScoreEvent[] = [];
  for (const p of predictions) {
    const events = scoreGroupPrediction(
      {
        id: p.id,
        user_id: p.user_id,
        tournament_id: tournamentId,
        group_name: groupName,
        advancing_team_1: p.advancing_team_1,
        advancing_team_2: p.advancing_team_2,
        locked: true,
        submitted_at: "",
        updated_at: "",
      },
      actualAdvancing,
    );
    allEvents.push(...events);
  }

  // Drop stale rows for predictions that previously scored but no longer do
  // (admin correcting wrong advancers). Then insert the current set.
  const predictionIds = predictions.map((p) => p.id);
  if (predictionIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("scores")
      .delete()
      .eq("reason", REASONS.GROUP_ADVANCER)
      .in("group_prediction_id", predictionIds);
    if (deleteError) {
      console.error("[scoreGroupAndPersist] stale delete failed", deleteError);
      return { eventsWritten: 0, error: `delete: ${deleteError.message}` };
    }
  }

  if (allEvents.length === 0) return { eventsWritten: 0 };

  const { error: insertError } = await supabase
    .from("scores")
    .insert(allEvents.map((e) => toScoreRow(e, tournamentId)));

  if (insertError) {
    return { eventsWritten: 0, error: `insert: ${insertError.message}` };
  }
  return { eventsWritten: allEvents.length };
}

/**
 * Score everyone's champion picks against the actual tournament champion.
 * Same delete-then-insert pattern for admin-correction safety.
 */
export async function scoreChampionsAndPersist(
  supabase: SupabaseClient,
  tournamentId: string,
  actualChampion: string,
): Promise<{ eventsWritten: number; error?: string }> {
  const { data, error: fetchError } = await supabase.rpc(
    "get_champion_predictions_for_scoring",
    { p_tournament_id: tournamentId },
  );
  if (fetchError) {
    console.error("[scoreChampionsAndPersist] fetch RPC failed", fetchError);
    return { eventsWritten: 0, error: `fetch: ${fetchError.message}` };
  }
  if (!data) {
    console.warn(
      "[scoreChampionsAndPersist] RPC returned null data without error",
      { tournamentId },
    );
  }
  const predictions = (data ?? []) as { user_id: string; team: string }[];

  const allEvents: ScoreEvent[] = [];
  for (const p of predictions) {
    const events = scoreChampionPrediction(
      { user_id: p.user_id, tournament_id: tournamentId, team: p.team },
      actualChampion,
    );
    allEvents.push(...events);
  }

  const predictionUserIds = predictions.map((p) => p.user_id);
  if (predictionUserIds.length > 0) {
    // Filter by tournament_id so a champion correction in tournament A
    // doesn't wipe champion scores from tournament B for the same user.
    const { error: deleteError } = await supabase
      .from("scores")
      .delete()
      .eq("reason", REASONS.CHAMPION)
      .eq("tournament_id", tournamentId)
      .in("champion_prediction_user_id", predictionUserIds);
    if (deleteError) {
      console.error("[scoreChampionsAndPersist] stale delete failed", deleteError);
      return { eventsWritten: 0, error: `delete: ${deleteError.message}` };
    }
  }

  if (allEvents.length === 0) return { eventsWritten: 0 };

  const { error: insertError } = await supabase
    .from("scores")
    .insert(allEvents.map((e) => toScoreRow(e, tournamentId)));

  if (insertError) {
    return { eventsWritten: 0, error: `insert: ${insertError.message}` };
  }
  return { eventsWritten: allEvents.length };
}
